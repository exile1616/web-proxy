import * as cheerio from 'cheerio';
import { encode } from './codec.js';
import { config } from '../config.js';

export const PREFIX = '/service/';
const SKIP = /^(#|data:|blob:|javascript:|mailto:|tel:|about:)/i;

/** Turn any (possibly relative) URL into a proxied URL. Returns input untouched if not proxyable. */
export function toProxyUrl(raw, base) {
  if (!raw) return raw;
  const s = raw.trim();
  if (!s || SKIP.test(s) || s.startsWith(PREFIX)) return raw;
  try {
    const abs = new URL(s, base);
    if (!/^https?:$/.test(abs.protocol)) return raw;
    const hash = abs.hash;
    abs.hash = '';
    return PREFIX + encode(abs.href) + hash;
  } catch { return raw; }
}

export function rewriteCss(css, base) {
  return css
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_, q, u) => `url(${q}${toProxyUrl(u, base)}${q})`)
    .replace(/@import\s+(['"])(.*?)\1/gi, (_, q, u) => `@import ${q}${toProxyUrl(u, base)}${q}`);
}

function rewriteSrcset(v, base) {
  return v.split(',').map((part) => {
    const [u, ...d] = part.trim().split(/\s+/);
    return [toProxyUrl(u, base), ...d].join(' ');
  }).join(', ');
}

const ATTRS = ['href', 'src', 'action', 'poster', 'data-src', 'data-href'];

export function rewriteHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  // <base> changes how relative URLs resolve: honour it, then drop it.
  let base = pageUrl;
  const baseEl = $('base[href]').first();
  if (baseEl.length) { try { base = new URL(baseEl.attr('href'), pageUrl).href; } catch {} baseEl.remove(); }

  $('*').each((_, el) => {
    for (const a of ATTRS) if (el.attribs?.[a] != null) $(el).attr(a, toProxyUrl(el.attribs[a], base));
    if (el.attribs?.srcset != null) $(el).attr('srcset', rewriteSrcset(el.attribs.srcset, base));
    if (el.tagName === 'object' && el.attribs?.data) $(el).attr('data', toProxyUrl(el.attribs.data, base));
    if (el.attribs?.style) $(el).attr('style', rewriteCss(el.attribs.style, base));
    // Integrity hashes and nonces break once we alter or re-serve resources.
    if (el.attribs) { delete el.attribs.integrity; delete el.attribs.nonce; }
    if (el.tagName === 'form') $(el).removeAttr('target');
  });
  $('style').each((_, el) => { $(el).text(rewriteCss($(el).text(), base)); });
  $('meta[http-equiv]').each((_, el) => {
    const he = (el.attribs['http-equiv'] || '').toLowerCase();
    if (he === 'content-security-policy') return $(el).remove();
    if (he === 'refresh') {
      $(el).attr('content', (el.attribs.content || '').replace(/(url=)\s*(.+)$/i, (_m, p, u) => p + toProxyUrl(u.replace(/^['"]|['"]$/g, ''), base)));
    }
  });
  const shim = $('<script></script>').attr({ src: '/js/shim.js', 'data-base': pageUrl, 'data-key': config.key, 'data-app': config.appOrigin });
  $('head').prepend(shim);
  return $.html();
}
