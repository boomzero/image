import type { Env } from '../types.ts';
const GITHUB_API_VERSION = '2022-11-28';

export interface GithubContentResponse {
    sha?: string;
    content?: {
        name?: string;
    };
}

export function githubHeaders(env: Env, accept = 'application/vnd.github+json'): HeadersInit {
    return {
        'Authorization': `Bearer ${env.GithubPAT}`,
        'Accept': accept,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': 'langningchen-image',
    };
}

export function githubApiUrl(env: Env, path: string): URL {
    return new URL(
        `https://api.github.com/repos/${encodeURIComponent(env.GithubOwner)}/${encodeURIComponent(env.GithubRepo)}${path}`,
    );
}
