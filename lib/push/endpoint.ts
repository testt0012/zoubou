// The push services browsers use (Chrome/Android, Firefox, Safari/iOS, Edge).
// A subscription's endpoint is a URL the server will call, so only these
// hosts are accepted for the customers' subscriptions.
const PUSH_HOST_SUFFIXES = [
  "googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isPushServiceEndpoint(endpoint: string): boolean {
  if (endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return PUSH_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}
