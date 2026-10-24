import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { authGate } from './middleware/auth.js';
import { requestLog } from './middleware/log.js';
import { proxyHandler } from './proxy/engine.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const APP_HOST = new URL(config.appOrigin).host;
const CONTENT_HOST = new URL(config.contentOrigin).host;
const split = APP_HOST !== CONTENT_HOST;
const onContent = (req) => split && req.headers.host === CONTENT_HOST;
if (!split) console.warn('[exile] APP_ORIGIN == CONTENT_ORIGIN: proxied pages share the UI origin. Dev only.');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.get('/healthz', (_req, res) => res.type('text').send('ok')); // for load balancers
app.use(requestLog(config.logRequests));
app.use(rateLimit({
  windowMs: 60_000,
  limit: (req) => onContent(req) ? config.proxyRateLimit : config.rateLimit,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Host routing. Content origin serves ONLY /service/* and the shim; the UI origin never proxies.
app.use((req, res, next) => {
  if (onContent(req)) {
    if (req.path === '/js/shim.js') return res.sendFile(path.join(publicDir, 'js', 'shim.js'), { maxAge: '1h' });
    return req.path.startsWith('/service/') ? next() : res.status(404).type('text').send('Not found');
  }
  if (split && req.path.startsWith('/service/')) return res.status(404).type('text').send('Not found');
  next();
});
app.use((req, res, next) => (onContent(req) ? next() : authGate(req, res, next)));

// Proxied content: NO helmet, headers are controlled by the engine.
app.all('/service/:token', proxyHandler);

// UI origin gets full helmet; it may frame only the content origin.
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"],
    styleSrc: ["'self'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:'], frameSrc: ["'self'", config.contentOrigin], upgradeInsecureRequests: null,
  } },
}));
app.get('/api/config', (_req, res) => res.json({ key: config.key, contentOrigin: config.contentOrigin }));
app.use(express.static(publicDir));

process.on('unhandledRejection', () => {}); // never crash on a bad upstream
app.listen(config.port, () => console.log(`Exile listening on :${config.port}`));
