import { describe, it, expect } from 'vitest';
import { encode, decode } from '../server/proxy/codec.js';
import { isPrivateIp, assertAllowedUrl } from '../server/proxy/ssrf.js';
import { rewriteCss, rewriteHtml, toProxyUrl } from '../server/proxy/rewrite.js';

describe('codec', () => {
  it('round-trips unicode URLs', () => {
    const u = 'https://example.com/päth?q=1&x=✓';
    expect(decode(encode(u))).toBe(u);
  });
  it('is path safe', () => expect(encode('https://a.com/?a=b')).toMatch(/^[A-Za-z0-9_-]+$/));
});

describe('ssrf', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])('blocks %s', (ip) => expect(isPrivateIp(ip)).toBe(true));
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows %s', (ip) => expect(isPrivateIp(ip)).toBe(false));
  it('rejects bad schemes and localhost', () => {
    expect(() => assertAllowedUrl('file:///etc/passwd')).toThrow();
    expect(() => assertAllowedUrl('http://localhost:3000')).toThrow();
    expect(() => assertAllowedUrl('http://169.254.169.254/latest')).toThrow();
    expect(() => assertAllowedUrl('https://example.com')).not.toThrow();
  });
});

describe('rewriters', () => {
  it('resolves relative URLs and keeps fragments', () => {
    const out = toProxyUrl('../a.png#x', 'https://e.com/d/p.html');
    expect(out.startsWith('/service/')).toBe(true);
    expect(out.endsWith('#x')).toBe(true);
    expect(decode(out.slice(9, -2))).toBe('https://e.com/a.png');
  });
  it('leaves data:, javascript: and anchors alone', () => {
    for (const u of ['data:image/png;base64,AA', 'javascript:void(0)', '#top']) expect(toProxyUrl(u, 'https://e.com/')).toBe(u);
  });
  it('rewrites css url() and @import', () => {
    const css = rewriteCss('a{background:url("/i.png")}@import "/b.css";', 'https://e.com/');
    expect(css).not.toContain('"/i.png"'); expect(css).not.toContain('"/b.css"');
  });
  it('rewrites html attrs, drops CSP meta/integrity, injects shim', () => {
    const html = rewriteHtml('<head><meta http-equiv="Content-Security-Policy" content="x"></head><a href="/x">a</a><script src="/s.js" integrity="abc"></script>', 'https://e.com/');
    expect(html).toContain('/js/shim.js'); expect(html).not.toContain('integrity'); expect(html).not.toContain('Content-Security-Policy');
    expect(html).not.toContain('href="/x"');
  });
});
