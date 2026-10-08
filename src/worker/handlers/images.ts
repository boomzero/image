import type { Env } from '../types.ts';
import { IMAGE_ID_PATTERN, MAX_UPLOAD_BYTES, corsHeaders } from '../constants.ts';
import { githubApiUrl, githubHeaders, type GithubContentResponse } from '../repositories/github.ts';

function imageResponseHeaders(imageId: string, extension: string): HeadersInit {
    return {
        'Content-Type': `image/${extension}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${imageId}"`,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        ...corsHeaders,
    };
}

// Compare SHA-256 digests byte by byte so the comparison time does not
// depend on how much of the token an attacker has guessed.
async function tokenMatches(provided: string, expected: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const [a, b] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(provided)),
        crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    ]);
    const x = new Uint8Array(a);
    const y = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
}

export async function handleUpload(request: Request, env: Env): Promise<Response> {
    const failure = (message: string, status: number) => new Response(message, { status, headers: corsHeaders });
    const auth = request.headers.get('Authorization') ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    // An unset token must never mean "open to everyone".
    if (!env.UPLOAD_TOKEN || !(await tokenMatches(provided, env.UPLOAD_TOKEN))) return failure('Unauthorized', 401);

    const image = await request.text();
    if (image.length > MAX_UPLOAD_BYTES) return failure('Image too large', 413);
    const match = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || match[2].length % 4 !== 0) return failure('Invalid image data', 400);
    const [, extension, imageData] = match;

    let imageId = '';
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
        imageId += String.fromCharCode(byte % 26 + 97);
    }

    try {
        const response = await fetch(githubApiUrl(env, `/contents/${imageId}.${extension}`), {
            method: 'PUT',
            headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Upload ${imageId}.${extension}`, content: imageData }),
        });
        if (!response.ok) {
            console.error('GitHub API error:', response.status, await response.text());
            return failure('Upload failed', 500);
        }
        const jsonResponse = await response.json() as GithubContentResponse;
        if (jsonResponse.content?.name !== `${imageId}.${extension}`) {
            console.error('Unexpected upload response:', jsonResponse);
            return failure('Upload failed', 500);
        }
        return new Response(imageId, { headers: { 'Content-Type': 'text/plain', ...corsHeaders } });
    } catch (error) {
        console.error('Upload error:', error);
        return failure('Upload failed', 500);
    }
}

export async function handleImageRequest(request: Request, env: Env): Promise<Response> {
    const imageId = new URL(request.url).pathname.substring(1);
    if (!IMAGE_ID_PATTERN.test(imageId)) {
        return new Response('Image not found', { status: 404, headers: corsHeaders });
    }

    try {
        let extension = 'jpeg';
        let githubResponse: Response | undefined;
        for (const candidate of ['jpeg', 'png', 'webp']) {
            extension = candidate;
            githubResponse = await fetch(githubApiUrl(env, `/contents/${imageId}.${extension}`), {
                method: 'GET',
                headers: githubHeaders(env, 'application/vnd.github.raw+json'),
            });
            if (githubResponse.status !== 404) break;
            await githubResponse.body?.cancel();
        }

        if (!githubResponse?.ok) {
            return new Response('Image not found', { status: 404, headers: corsHeaders });
        }

        const headers = imageResponseHeaders(imageId, extension);
        if (request.headers.get('If-None-Match') === `"${imageId}"`) {
            await githubResponse.body?.cancel();
            return new Response(null, { status: 304, headers });
        }
        return new Response(githubResponse.body, { headers });
    } catch (error) {
        console.error('Image fetch error:', imageId, error);
        return new Response('Image not found', { status: 404, headers: corsHeaders });
    }
}
