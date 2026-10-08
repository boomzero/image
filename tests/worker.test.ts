import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker/index.ts';

const id = 'a1'.repeat(16);
const env = { GithubOwner: 'test', GithubRepo: 'images', GithubPAT: 'test-pat', UPLOAD_TOKEN: 'secret-token' };

function upload(body: string, headers: Record<string, string> = { Authorization: 'Bearer secret-token' }) {
    return worker.fetch(new Request('https://image.test/upload', { method: 'POST', headers, body }), env);
}

test('uploads without the bearer token are rejected before touching GitHub', async t => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('unexpected'));
    assert.equal((await upload('data:image/jpeg;base64,aGVsbG8=', {})).status, 401);
    assert.equal((await upload('data:image/jpeg;base64,aGVsbG8=', { Authorization: 'Bearer wrong' })).status, 401);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('uploads fail closed when no token is configured', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('unexpected'));
    const request = new Request('https://image.test/upload', { method: 'POST', headers: { Authorization: 'Bearer ' }, body: 'data:image/jpeg;base64,aGVsbG8=' });
    assert.equal((await worker.fetch(request, { ...env, UPLOAD_TOKEN: "" })).status, 401);
});

test('an authorized upload needs no terms header and stores the image in GitHub', async t => {
    let putPath = '';
    let putBody: { content?: string } = {};
    t.mock.method(globalThis, 'fetch', async (url: string | URL, init?: RequestInit) => {
        putPath = new URL(url).pathname;
        putBody = JSON.parse(String(init?.body));
        return Response.json({ content: { name: putPath.split('/').at(-1) } });
    });
    const response = await upload('data:image/png;base64,aGVsbG8=');
    assert.equal(response.status, 200);
    const imageId = await response.text();
    assert.match(imageId, /^[0-9a-z]{32}$/);
    assert.equal(putPath, `/repos/test/images/contents/${imageId}.png`);
    assert.equal(putBody.content, 'aGVsbG8=');
});

test('invalid and oversized uploads are rejected', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('unexpected'));
    assert.equal((await upload('not an image')).status, 400);
    assert.equal((await upload('data:image/gif;base64,aGVsbG8=')).status, 400);
    assert.equal((await upload('data:image/jpeg;base64,' + 'A'.repeat(10 * 1024 * 1024))).status, 413);
});

test('GitHub failures surface as 500', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 502 }));
    assert.equal((await upload('data:image/jpeg;base64,aGVsbG8=')).status, 500);
});

test('images are served publicly with long-lived caching and conditional requests', async t => {
    t.mock.method(globalThis, 'fetch', async (url: string | URL) =>
        new URL(url).pathname.endsWith('.png') ? new Response('png bytes') : new Response(null, { status: 404 }));
    const response = await worker.fetch(new Request(`https://image.test/${id}`), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/png');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
    assert.equal(await response.text(), 'png bytes');
    const cached = await worker.fetch(new Request(`https://image.test/${id}`, { headers: { 'If-None-Match': `"${id}"` } }), env);
    assert.equal(cached.status, 304);
});

test('missing images and invalid paths return 404', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
    assert.equal((await worker.fetch(new Request(`https://image.test/${id}`), env)).status, 404);
    assert.equal((await worker.fetch(new Request('https://image.test/no-image'), env)).status, 404);
});

test('preflight allows the headers browsers need for image reads', async () => {
    const response = await worker.fetch(new Request(`https://image.test/${id}`, { method: 'OPTIONS' }), env);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.doesNotMatch(response.headers.get('Access-Control-Allow-Headers') ?? '', /X-Terms-Version/);
});

test('there is no scheduled cleanup: images are never deleted for inactivity', () => {
    assert.equal((worker as { scheduled?: unknown }).scheduled, undefined);
});
