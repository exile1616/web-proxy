import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { Agent, request } from 'undici';
import { decode } from './codec.js';
import { assertAllowedUrl, safeLookup } from './ssrf.js';
import { rewriteHtml, rewriteCss, toProxyUrl } from './rewrite.js';
import * as jar from './cookiejar.js';
import { config } from '../config.js';

const agent = new Agent({
  connect: { lookup: safeLookup, timeout: config.timeoutMs },
  headersTimeout: config.timeoutMs,
  bodyTimeout: 0, // allow long media streams
});

const DROP_RES = new Set([
  'x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
  'strict-transport-security', 'set-cookie', 'content-length', 'transfer-encoding',
  'connection', 'keep-alive', 'location', 'report-to', 'nel', 'cross-origin-opener-policy',
  'cross-origin-embedder-policy', 'cross-origin-resource-policy',
]);
const FWD_REQ = ['accept', 'accept-language', 'range', 'content-type', 'content-length', 'user-agent'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function errorPage(res, status, title, msg) {
  res.status(status).set('content-type', 'text/html; charset=utf-8').send(
    `<!doctype html><meta charset=utf-8><title>${esc(title)}</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#07070a;color:#ececf1;font:16px Inter,system-ui,sans-serif"><div style="text-align:center;max-width:420px;padding:24px"><div style="font-size:48px;color:#7c5cff">&#9888;</div><h1 style="font-weight:600">${esc(title)}</h1><p style="color:#8b8b99">${esc(msg)}</p><button onclick="location.reload()" style="margin-top:12px;padding:10px 20px;border:0;border-radius:999px;background:#7c5cff;color:#fff;cursor:pointer">Try again</button></div></body>`);
}

function mapError(res, e) {
  const c = e.code || '';
  if (c === 'EXILE_SSRF') return errorPage(res, 403, 'Blocked', 'This destination is not allowed on this instance.');
  if (c === 'EXILE_BAD_URL') return errorPage(res, 400, 'Invalid address', 'That address could not be understood.');
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return errorPage(res, 502, 'Site not found', 'DNS lookup failed for this address.');
  if (/TIMEOUT/.test(c)) return errorPage(res, 504, 'Timed out', 'The site took too long to respond.');
  if (/CERT|SSL|TLS|SELF_SIGNED/.test(c)) return errorPage(res, 502, 'Secure connection failed', "The site's certificate could not be verified.");
  return errorPage(res, 502, 'Could not load page', 'Something went wrong reaching the site.');
}

async function readAll(stream, max) {
  const chunks = []; let n = 0;
  for await (const c of stream) { n += c.length; if (n > max) throw Object.assign(new Error('Too large'), { code: 'EXILE_TOO_LARGE' }); chunks.push(c); }
  return Buffer.concat(chunks);
}

const decoders = { gzip: zlib.createGunzip, 'x-gzip': zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress };

function getSid(req, res) {
  const m = /(?:^|;\s*)exile_sid=([a-f0-9]{32})/.exec(req.headers.cookie || '');
  if (m) return m[1];
  const sid = crypto.randomBytes(16).toString('hex');
  res.append('Set-Cookie', `exile_sid=${sid}; Path=/; HttpOnly; ${config.contentOrigin.startsWith('https') ? 'SameSite=None; Secure' : 'SameSite=Lax'}`);
  return sid;
}

export async function proxyHandler(req, res) {
  try {
    const target = assertAllowedUrl(decode(req.params.token));
    const sid = getSid(req, res);
    const headers = { 'accept-encoding': 'gzip, deflate, br', origin: target.origin, referer: target.origin + '/' };
    for (const h of FWD_REQ) if (req.headers[h]) headers[h] = req.headers[h];
    const cookie = jar.header(sid, target.host);
    if (cookie) headers.cookie = cookie;
    const hasBody = !['GET', 'HEAD'].includes(req.method);

    const up = await request(target.href, { method: req.method, headers, body: hasBody ? req : undefined, dispatcher: agent });

    const sc = up.headers['set-cookie'];
    if (sc) jar.store(sid, target.host, Array.isArray(sc) ? sc : [sc]);

    const ct = String(up.headers['content-type'] || '');
    const isHtml = /text\/html|application\/xhtml/i.test(ct);
    const isCss = /text\/css/i.test(ct);
    const rewriting = (isHtml || isCss) && up.statusCode !== 206;

    for (const [k, v] of Object.entries(up.headers)) {
      if (DROP_RES.has(k)) continue;
      if (rewriting && k === 'content-encoding') continue;
      res.setHeader(k, v);
    }
    if (up.headers.location) res.setHeader('location', toProxyUrl(String(up.headers.location), target.href));
    res.status(up.statusCode);

    if (!rewriting) {
      // Stream untouched (media, images, fonts, JS, downloads). Keep length so Range/seek works.
      if (up.headers['content-length']) res.setHeader('content-length', up.headers['content-length']);
      up.body.on('error', () => res.destroy());
      return up.body.pipe(res);
    }

    let stream = up.body;
    const enc = String(up.headers['content-encoding'] || '').toLowerCase();
    if (decoders[enc]) stream = up.body.pipe(decoders[enc]());
    const text = (await readAll(stream, config.maxRewriteBytes)).toString('utf8');
    res.send(isHtml ? rewriteHtml(text, target.href) : rewriteCss(text, target.href));
  } catch (e) {
    if (res.headersSent) return res.destroy();
    mapError(res, e);
  }
}
