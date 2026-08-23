export type NavigationSafety = 'standard' | 'custom' | 'blocked';

const STANDARD_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'chrome:', 'about:']);
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:']);
const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  'ac.uk', 'appspot.com', 'blogspot.com', 'cloudfront.net', 'co.in', 'co.jp', 'co.kr', 'co.nz',
  'co.uk', 'com.au', 'com.br', 'com.cn', 'com.hk', 'com.mx', 'com.sg', 'com.tw', 'github.io',
  'gov.uk', 'net.au', 'net.cn', 'netlify.app', 'org.au', 'org.cn', 'org.uk', 'pages.dev',
  'vercel.app', 'wordpress.com',
]);

export function getNavigationSafety(rawUrl: string): NavigationSafety {
  try {
    const protocol = new URL(rawUrl).protocol.toLowerCase();
    if (BLOCKED_PROTOCOLS.has(protocol)) return 'blocked';
    return STANDARD_PROTOCOLS.has(protocol) ? 'standard' : 'custom';
  } catch {
    return 'blocked';
  }
}

export function isSameWebsiteFamily(firstUrl: string, secondUrl: string): boolean {
  try {
    const first = new URL(firstUrl);
    const second = new URL(secondUrl);
    if (!['http:', 'https:'].includes(first.protocol) || !['http:', 'https:'].includes(second.protocol)) {
      return false;
    }
    const firstHost = normalizeHostname(first.hostname);
    const secondHost = normalizeHostname(second.hostname);
    if (firstHost === secondHost) return true;
    return registrableDomain(firstHost) === registrableDomain(secondHost);
  } catch {
    return false;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

function registrableDomain(hostname: string): string {
  if (hostname === 'localhost' || hostname.includes(':') || /^\d+(?:\.\d+){3}$/.test(hostname)) {
    return hostname;
  }
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) return hostname;
  const lastTwo = labels.slice(-2).join('.');
  const suffixLength = MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo) ? 2 : 1;
  return labels.slice(-(suffixLength + 1)).join('.');
}
