import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-cbc';
// Derive 32-byte key from JWT secret
const KEY = crypto.createHash('sha256').update(config.jwt.secret).digest();

export function encryptText(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptText(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return '';
  const [ivHex, cipherHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
