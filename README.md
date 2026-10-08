# Image (single-user fork)

A stripped-down fork of [langningchen/Image](https://github.com/langningchen/Image) for one trusted uploader — the [ftle](https://github.com/boomzero/ftle) blog editor. Image bytes live in a private GitHub repository; this Worker uploads and serves them.

Removed from upstream: the Terms-of-Service consent gate (`X-Terms-Version`), Workers AI moderation, IP controls, traffic stats, the admin UI, the public React uploader, D1, and the daily inactivity cleanup. **Images are never deleted automatically.**

## API

- `POST /upload` — body is a `data:image/(jpeg|png|webp);base64,…` URL (≤ 10 MiB). Requires `Authorization: Bearer <UPLOAD_TOKEN>`; returns the 32-character image id as `text/plain`. Unset `UPLOAD_TOKEN` rejects every upload.
- `GET /:id` — serves the image publicly with `Cache-Control: public, max-age=31536000, immutable` and ETag/304 support.

## Deploy

```sh
npm install
npx wrangler secret put GithubPAT     # fine-grained PAT with contents:write on the image repo
npx wrangler secret put GithubOwner
npx wrangler secret put GithubRepo
npx wrangler secret put UPLOAD_TOKEN  # e.g. `openssl rand -hex 32`; give the same value to ftle
npm run deploy
```

Attach a custom domain or route in the Cloudflare dashboard (`workers_dev` is off). For local development put the same names in a Git-ignored `.dev.vars`.

```sh
npm test && npm run typecheck
```

## License

GPL-3.0, as upstream. Thanks to Langning Chen for the original project.
