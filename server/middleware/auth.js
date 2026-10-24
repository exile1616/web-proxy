import crypto from 'node:crypto';
import { config } from '../config.js';

export function authGate(req, res, next) {
  if (!config.password) return next();
  const [scheme, b64] = (req.headers.authorization || '').split(' ');
  const given = scheme === 'Basic' ? Buffer.from(b64 || '', 'base64').toString().split(':').slice(1).join(':') : '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(config.password).digest();
  if (crypto.timingSafeEqual(a, b)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Exile"').status(401).send('Authentication required');
}
