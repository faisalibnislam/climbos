/** Explicit opt-in on an exact loopback origin; prefix matching accepts hostile hostnames. */
export function localDevLoginEnabled(flag: string | undefined, siteUrl: string | undefined): boolean {
  if (flag !== "true" || !siteUrl) return false;
  return isLoopbackHttpOrigin(siteUrl);
}

export function isLoopbackHttpOrigin(siteUrl: string): boolean {
  try {
    const url = new URL(siteUrl);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** Operator-granted workspace-count exemption for the dedicated real-data local account only. */
export function localWorkspaceTestingEnabled(accountOptIn: boolean | undefined, env: Record<string, string | undefined>): boolean {
  return accountOptIn === true && env.CLIMBOS_LOCAL_REAL_RESEARCH === "true" && env.SITE_URL === "http://127.0.0.1:3430" && !env.CLIMBOS_FAKE_LLM;
}
