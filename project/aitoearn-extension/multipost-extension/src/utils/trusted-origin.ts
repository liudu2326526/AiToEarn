export interface TrustedDomain {
  domain: string;
}

const BUILT_IN_TRUSTED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "aitobee.muskapis.com"]);

export function isLocalTrustedHost(hostname: string) {
  return BUILT_IN_TRUSTED_HOSTS.has(hostname);
}

export function isTrustedOrigin(hostname: string, trustedDomains: TrustedDomain[] = []) {
  if (isLocalTrustedHost(hostname)) return true;

  return trustedDomains.some(({ domain }) => {
    if (domain.startsWith("*.")) {
      const wildCardDomain = domain.slice(2);
      return hostname.endsWith(wildCardDomain);
    }
    return hostname === domain;
  });
}
