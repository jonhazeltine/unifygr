/// <reference types="astro/client" />

type CloudflareRuntime = import("@astrojs/cloudflare").Runtime<{
  BLOB_READ_WRITE_TOKEN?: string;
}>;

declare namespace App {
  interface Locals extends CloudflareRuntime {}
}
