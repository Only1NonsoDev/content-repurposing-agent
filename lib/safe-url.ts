import { isIP } from "node:net";

export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.internal.",
]);

export function isBlockedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIp(normalized.slice(7));
  }

  const version = isIP(normalized);
  if (version === 4) {
    const [a, b] = normalized.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (version === 6) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80") || normalized.startsWith("ff")) return true;
    return false;
  }

  return true;
}

export function parsePublicUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new UserInputError("That link is not a valid web address. Paste the article text instead.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserInputError("Only public http and https links can be read. Paste the article text instead.");
  }
  if (url.username || url.password) {
    throw new UserInputError("Links with a username or password are blocked. Paste the article text instead.");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) {
    throw new UserInputError("That link points at a local address. Paste the article text instead.");
  }
  if (isIP(host) && isBlockedIp(host)) {
    throw new UserInputError("That link points at a private network. Paste the article text instead.");
  }
  return url;
}
