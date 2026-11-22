declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    RELEASE_ADMIN_TOKEN?: string;
    RELEASE_SIGNING_PKCS8?: string;
  }
}
