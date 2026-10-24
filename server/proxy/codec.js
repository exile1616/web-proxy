// Swappable URL codec: XOR with a key, then base64url. Obfuscation, not encryption.
import { config } from '../config.js';

export function encode(url, key = config.key) {
  const buf = Buffer.from(url, 'utf8');
  const k = Buffer.from(key, 'utf8');
  for (let i = 0; i < buf.length; i++) buf[i] ^= k[i % k.length];
  return buf.toString('base64url');
}

export function decode(token, key = config.key) {
  const buf = Buffer.from(token, 'base64url');
  const k = Buffer.from(key, 'utf8');
  for (let i = 0; i < buf.length; i++) buf[i] ^= k[i % k.length];
  return buf.toString('utf8');
}
