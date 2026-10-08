export interface Env {
    GithubOwner: string;
    GithubRepo: string;
    GithubPAT: string;
    /** Shared secret required as `Authorization: Bearer <token>` on POST /upload. */
    UPLOAD_TOKEN: string;
}
