// Injected into every proxied page. Re-routes dynamic URL use through the proxy.
(() => {
  const s = document.currentScript, BASE = s.dataset.base, KEY = new TextEncoder().encode(s.dataset.key);
  const enc = (u) => {
    const b = new TextEncoder().encode(u).map((x, i) => x ^ KEY[i % KEY.length]);
    let bin = ''; b.forEach((c) => (bin += String.fromCharCode(c)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const px = (u) => {
    try {
      u = String(u);
      if (/^(#|data:|blob:|javascript:|about:|mailto:)/i.test(u) || u.startsWith('/service/')) return u;
      const a = new URL(u, BASE);
      if (!/^https?:$/.test(a.protocol)) return u;
      const h = a.hash; a.hash = '';
      return '/service/' + enc(a.href) + h;
    } catch { return u; }
  };
  const origFetch = window.fetch;
  window.fetch = (i, o) => origFetch(typeof i === 'string' || i instanceof URL ? px(i) : i, o);
  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u, ...r) { return xo.call(this, m, px(u), ...r); };
  const wo = window.open;
  window.open = (u, ...r) => wo.call(window, u ? px(u) : u, ...r);
  for (const k of ['pushState', 'replaceState']) {
    const o = history[k];
    history[k] = function (st, t, u) { return o.call(this, st, t, u == null ? u : px(u)); };
  }
  // Catch URLs set from JS (el.src = ..., innerHTML, appended nodes).
  const fix = (el) => {
    if (el.nodeType !== 1) return;
    for (const a of ['href', 'src', 'action']) {
      const v = el.getAttribute(a);
      if (v && !v.startsWith('/service/') && !/^(#|data:|blob:|javascript:)/i.test(v)) el.setAttribute(a, px(v));
    }
    el.querySelectorAll?.('[href],[src],[action]').forEach(fix);
  };
  new MutationObserver((ms) => ms.forEach((m) => (m.type === 'attributes' ? fix(m.target) : m.addedNodes.forEach(fix))))
    .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'src', 'action'] });
  // Tell the shell what page this is.
  // The UI lives on another origin: talk to it only via postMessage, pinned to its origin.
  const APP = s.dataset.app;
  const notify = () => parent.postMessage({ type: 'exile:nav', url: BASE, title: document.title }, APP);
  addEventListener('DOMContentLoaded', notify); addEventListener('load', notify);
  addEventListener('message', (e) => {
    if (e.origin !== APP || e.data?.type !== 'exile:cmd') return;
    if (e.data.cmd === 'back') history.back();
    else if (e.data.cmd === 'fwd') history.forward();
    else if (e.data.cmd === 'reload') location.reload();
  });
})();
