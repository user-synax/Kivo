import dns from "node:dns/promises";
import net from "node:net";
import { badRequest, forbidden } from "../../utils/errors.js";

// In-memory cache: url -> { data, expiresAt }. TTL 1h, cap 500 entries.
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 1_500_000;

function cacheGet(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(url);
    return null;
  }
  return entry.data;
}

function cacheSet(url, data) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function isBlockedHostname(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost") return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  // Literal IPs.
  if (net.isIP(h)) return isPrivateIp(h);
  // Hex/octal/int encodings of localhost etc. are resolved via DNS below;
  // block obvious dotted numerics here too.
  if (/^[\d.]+$/.test(h)) return true;
  return false;
}

function isPrivateIp(ip) {
  // Normalize IPv4-mapped IPv6.
  let v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) v = v.slice("::ffff:".length);
  if (v === "::1" || v === "::") return true;
  if (!net.isIPv4(v)) {
    // Block non-global IPv6 (unique-local fc00::/7, link-local fe80::/10).
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    return false;
  }
  const parts = v.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw badRequest("Invalid URL", "INVALID_URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw badRequest("Only http(s) URLs can be previewed", "INVALID_URL");
  }
  if (rawUrl.length > 2048) {
    throw badRequest("URL is too long", "INVALID_URL");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw forbidden("URL host is not allowed", "URL_NOT_ALLOWED");
  }
  // Resolve DNS and reject private/loopback targets (SSRF guard).
  try {
    const addrs = await dns.lookup(parsed.hostname, { all: true });
    for (const a of addrs || []) {
      if (isPrivateIp(a.address)) {
        throw forbidden("URL host is not allowed", "URL_NOT_ALLOWED");
      }
    }
  } catch (err) {
    if (err?.code === "URL_NOT_ALLOWED") throw err;
    // DNS failure -> treat as unresolvable rather than leaking internals.
    throw badRequest("Could not resolve URL host", "UNRESOLVABLE_URL");
  }
  return parsed.toString();
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return _;
      }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(parseInt(d, 10));
      } catch {
        return _;
      }
    });
}

function attr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities((m[2] ?? m[3] ?? m[4] ?? "").trim()) || null;
}

function parseMeta(html) {
  const out = {};
  const titleMatch = html.match(/<title[^>]*>([\s\S]{1,500})<\/title>/i);
  if (titleMatch) out.title = decodeEntities(titleMatch[1].replace(/\s+/g, " ").trim()).slice(0, 200) || null;

  const tags = html.match(/<meta[^>]*>/gi) || [];
  for (const tag of tags) {
    const prop = attr(tag, "property") || attr(tag, "name");
    const content = attr(tag, "content");
    if (!prop || !content) continue;
    const key = prop.toLowerCase();
    if (!(key in out)) out[key] = content.slice(0, 500);
  }
  const linkTags = html.match(/<link[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const rel = (attr(tag, "rel") || "").toLowerCase();
    if (rel.split(/\s+/).includes("icon")) {
      const href = attr(tag, "href");
      if (href && !out.icon) out.icon = href;
    }
  }
  return out;
}

function resolveUrl(ref, base) {
  if (!ref) return null;
  try {
    const u = new URL(ref, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function fetchLinkPreview(rawUrl) {
  const normalized = await assertPublicUrl(rawUrl);
  const cached = cacheGet(normalized);
  if (cached) return { ...cached, cached: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(normalized, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Kivo-LinkPreview/1.0 (+https://kivo.chat)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.8",
      },
    });
  } catch (err) {
    if (err?.name === "AbortError") throw badRequest("Preview timed out", "PREVIEW_TIMEOUT");
    throw badRequest("Could not fetch URL", "PREVIEW_FETCH_FAILED");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw badRequest("Could not fetch URL", "PREVIEW_FETCH_FAILED");
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("html") && !contentType.includes("text")) {
    throw badRequest("URL is not a web page", "PREVIEW_NOT_HTML");
  }
  // Re-check the final URL after redirects (SSRF guard).
  let finalUrl = normalized;
  try {
    finalUrl = await assertPublicUrl(res.url || normalized);
  } catch (err) {
    throw err;
  }

  const reader = res.body?.getReader?.();
  let html = "";
  if (reader) {
    const decoder = new TextDecoder("utf-8");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.length > MAX_BODY_BYTES) break;
    }
    html += decoder.decode();
    try {
      await reader.cancel().catch(() => {});
    } catch { /* ignore */ }
    html = html.slice(0, MAX_BODY_BYTES);
  } else {
    html = (await res.text()).slice(0, MAX_BODY_BYTES);
  }

  const meta = parseMeta(html);
  const pick = (...keys) => {
    for (const k of keys) if (meta[k]) return meta[k];
    return null;
  };

  const title = pick("og:title", "twitter:title") || meta.title || null;
  const description =
    pick("og:description", "twitter:description", "description") || null;
  const siteName = pick("og:site_name") || null;
  const image = resolveUrl(pick("og:image", "twitter:image"), finalUrl);
  const favicon = resolveUrl(meta.icon, finalUrl);

  let domain = null;
  try {
    domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch { /* ignore */ }

  if (!title && !description && !image) {
    throw badRequest("No preview available for this URL", "PREVIEW_EMPTY");
  }

  const data = {
    url: finalUrl,
    siteName,
    title,
    description: description ? description.slice(0, 300) : null,
    image,
    favicon,
    domain,
  };
  cacheSet(normalized, data);
  return { ...data, cached: false };
}
