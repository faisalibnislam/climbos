/**
 * Validate a website the visitor typed (bare domain or full URL). Shared by the
 * landing form and the /api/preview route. Rejects IPs, localhost and private names.
 */
export function normalizeWebsite(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (value.length < 3) return { ok: false, message: "Enter your website address, like formkit.app." };
  if (value.length > 300) return { ok: false, message: "That address is too long. Try just your homepage, like formkit.app." };
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    return { ok: false, message: "Please enter a normal website address, like formkit.app." };
  }
  let host = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0] ?? "";
  host = host.replace(/^[^@]*@/, "").replace(/:\d+$/, "").toLowerCase();
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
  if (isIp || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, message: "Please enter a public website address, like formkit.app." };
  }
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host)) {
    return { ok: false, message: "That doesn't look like a website address. Try something like formkit.app." };
  }
  return { ok: true, value };
}
