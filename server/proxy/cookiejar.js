// Minimal per-session, per-host cookie jar (host-only cookies; Domain/Path ignored by design).
const jars = new Map(); // sid -> Map<host, Map<name, value>>
const MAX_SESSIONS = 5000;

export function store(sid, host, setCookies = []) {
  if (!jars.has(sid)) {
    if (jars.size >= MAX_SESSIONS) jars.delete(jars.keys().next().value);
    jars.set(sid, new Map());
  }
  const hosts = jars.get(sid);
  if (!hosts.has(host)) hosts.set(host, new Map());
  const jar = hosts.get(host);
  for (const c of setCookies) {
    const [pair, ...attrs] = c.split(';');
    const i = pair.indexOf('=');
    if (i < 1) continue;
    const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
    const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === '';
    if (expired) jar.delete(name); else jar.set(name, value);
  }
}

export function header(sid, host) {
  const jar = jars.get(sid)?.get(host);
  if (!jar || !jar.size) return '';
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}
