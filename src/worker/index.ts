import type { Env } from './types.ts';
import { corsHeaders } from './constants.ts';
import { handleUpload, handleImageRequest } from './handlers/images.ts';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
        const url = new URL(request.url);
        if (request.method === 'POST' && url.pathname === '/upload') return handleUpload(request, env);
        if (request.method === 'GET') return handleImageRequest(request, env);
        return new Response('404', { status: 404 });
    },
} satisfies ExportedHandler<Env>;
