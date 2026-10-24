// SSRF guard. Two layers:
//  1. assertAllowedUrl(): scheme, blocklist/allowlist, and literal-IP checks before we connect.
//  2. safeLookup(): used as the socket's DNS lookup, so the IP we validate is the IP we connect to
//     (no gap for DNS rebinding).
import dns from 'node:dns';
import net from 'node:net';
import { config } from '../config.js';

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7)); // IPv4-mapped
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff');
  }
  return true; // unknown format: refuse
}

export function safeLookup(hostname, opts, cb) {
  dns.lookup(hostname, { ...opts, all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (addrs.some((a) => isPrivateIp(a.address))) {
      const e = new Error('Blocked address'); e.code = 'EXILE_SSRF'; return cb(e);
    }
    if (opts && opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

export function assertAllowedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { const e = new Error('Invalid URL'); e.code = 'EXILE_BAD_URL'; throw e; }
  const fail = (m) => { const e = new Error(m); e.code = 'EXILE_SSRF'; throw e; };
  if (!['http:', 'https:'].includes(u.protocol)) fail('Unsupported scheme');
  // Only web ports: stops Exile being used for port scanning, SMTP, etc.
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  if (!config.allowedPorts.includes(port)) fail('Port not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) fail('Blocked host');
  if (net.isIP(host) && isPrivateIp(host)) fail('Blocked address');
  const matches = (list) => list.some((d) => host === d || host.endsWith('.' + d));
  if (matches(config.blocklist)) fail('Domain blocked by policy');
  if (config.allowlist.length && !matches(config.allowlist)) fail('Domain not on allowlist');
  return u;
}
