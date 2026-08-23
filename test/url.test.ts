import { getNavigationSafety, isSameWebsiteFamily } from '../src/utils/url';

describe('bookmark navigation safety', () => {
  it('allows normal web and browser URLs', () => {
    expect(getNavigationSafety('https://example.com')).toBe('standard');
    expect(getNavigationSafety('chrome://bookmarks')).toBe('standard');
  });

  it('requires confirmation for custom protocols', () => {
    expect(getNavigationSafety('notion://open?id=1')).toBe('custom');
  });

  it('blocks code, embedded data, and malformed URLs', () => {
    expect(getNavigationSafety('javascript:alert(1)')).toBe('blocked');
    expect(getNavigationSafety('data:text/html,hello')).toBe('blocked');
    expect(getNavigationSafety('not a url')).toBe('blocked');
  });
});

describe('website family matching', () => {
  it('allows pages and sibling subdomains from the same website family', () => {
    expect(isSameWebsiteFamily('https://google.com', 'https://mail.google.com/mail/u/0/#inbox')).toBe(true);
    expect(isSameWebsiteFamily('https://www.example.com/start', 'https://shop.example.com/product/1')).toBe(true);
  });

  it('blocks unrelated websites and separate hosted-site tenants', () => {
    expect(isSameWebsiteFamily('https://example.com', 'https://example.org')).toBe(false);
    expect(isSameWebsiteFamily('https://first.github.io', 'https://second.github.io')).toBe(false);
    expect(isSameWebsiteFamily('https://first.vercel.app', 'https://second.vercel.app')).toBe(false);
  });

  it('handles multi-label country suffixes without treating every tenant as one website', () => {
    expect(isSameWebsiteFamily('https://news.bbc.co.uk', 'https://www.bbc.co.uk')).toBe(true);
    expect(isSameWebsiteFamily('https://bbc.co.uk', 'https://example.co.uk')).toBe(false);
  });
});
