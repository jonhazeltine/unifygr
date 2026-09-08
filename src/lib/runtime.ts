export function isCloudflareWorker(
  userAgent = globalThis.navigator?.userAgent,
): boolean {
  return userAgent === "Cloudflare-Workers";
}
