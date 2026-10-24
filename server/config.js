import 'dotenv/config';
const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const config = {
  port: Number(process.env.PORT || 8080),
  key: process.env.EXILE_KEY || 'exile',
  password: process.env.EXILE_PASSWORD || '',
  rateLimit: Number(process.env.RATE_LIMIT_PER_MIN || 240),
  proxyRateLimit: Number(process.env.PROXY_RATE_LIMIT_PER_MIN || 1200),
  timeoutMs: Number(process.env.TIMEOUT_MS || 15000),
  maxRewriteBytes: Number(process.env.MAX_REWRITE_BYTES || 20_000_000),
  blocklist: list(process.env.BLOCKLIST),
  allowlist: list(process.env.ALLOWLIST),
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  // UI and proxied content live on different origins so proxied JS can never touch the UI's storage.
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:8080',
  contentOrigin: process.env.CONTENT_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:8080',
  allowedPorts: list(process.env.ALLOWED_PORTS || '80,443'),
  logRequests: process.env.LOG_REQUESTS === '1',
};
