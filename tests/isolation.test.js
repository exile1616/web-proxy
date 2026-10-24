import { describe, it, expect } from 'vitest';
import * as jar from '../server/proxy/cookiejar.js';
import { formatLog, anonymizeIp } from '../server/middleware/log.js';
import { assertAllowedUrl } from '../server/proxy/ssrf.js';

describe('visitor isolation', () => {
  it('never shares cookies across sessions', () => {
    jar.store('visitorA', 'bank.example', ['auth=SECRET; Path=/']);
    expect(jar.header('visitorB', 'bank.example')).toBe('');
    expect(jar.header('visitorA', 'bank.example')).toBe('auth=SECRET');
  });
  it('never shares cookies across hosts within a session', () => {
    jar.store('visitorC', 'a.example', ['k=v']);
    expect(jar.header('visitorC', 'b.example')).toBe('');
  });
});

describe('logging redaction', () => {
  it('records no URL, token, query or cookie', () => {
    const req = { ip: '203.0.113.77', path: '/service/TOKEN123', originalUrl: '/service/TOKEN123?pw=hunter2', headers: { cookie: 'a=b' } };
    const line = formatLog(req, { statusCode: 200, getHeader: () => 10 }, 5);
    for (const s of ['TOKEN123', 'hunter2', 'a=b', '203.0.113.77']) expect(line).not.toContain(s);
    expect(anonymizeIp('203.0.113.77')).toBe('203.0.113.0');
  });
});

describe('port policy', () => {
  it('allows only 80/443', () => {
    expect(() => assertAllowedUrl('http://example.com:25')).toThrow();
    expect(() => assertAllowedUrl('https://example.com:8443')).toThrow();
    expect(() => assertAllowedUrl('https://example.com')).not.toThrow();
  });
});
