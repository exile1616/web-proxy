// Privacy-first request log (opt-in via LOG_REQUESTS=1). Never records URLs, tokens, query strings,
// bodies, headers or cookies: only time, truncated IP, status, size, latency and route class.
export function anonymizeIp(ip = '') {
  ip = ip.replace(/^::ffff:/, '');
  if (ip.includes('.')) return ip.split('.').slice(0, 3).join('.') + '.0';
  return ip.split(':').slice(0, 3).join(':') + '::';
}
export function formatLog(req, res, ms) {
  return JSON.stringify({
    ts: new Date().toISOString(), ip: anonymizeIp(req.ip), status: res.statusCode,
    bytes: Number(res.getHeader('content-length') || 0), ms,
    route: req.path.startsWith('/service/') ? 'service' : 'shell',
  });
}
export const requestLog = (enabled) => (req, res, next) => {
  if (!enabled) return next();
  const t = Date.now();
  res.on('finish', () => console.log(formatLog(req, res, Date.now() - t)));
  next();
};
