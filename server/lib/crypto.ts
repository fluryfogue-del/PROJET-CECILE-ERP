// Web-Standard Crypto utilities compatible with both Cloudflare Workers and Node 22+

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  if (!clean || clean.length % 2 !== 0) return new Uint8Array(0);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

async function derivePbkdf2Hex(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltBytes = fromHex(saltHex);
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(derived);
}

export async function hashSecret(password: string, minLen = 4): Promise<{ salt: string; hash: string }> {
  const clean = password.trim();
  if (clean.length < minLen) {
    throw new Error(`Le mot de passe doit contenir au moins ${minLen} caractères non vides.`);
  }
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const hash = await derivePbkdf2Hex(password, salt);
  return { salt, hash };
}

export async function verifySecret(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!password || password.trim().length === 0 || !salt || !expectedHash) {
    return false;
  }
  const computed = await derivePbkdf2Hex(password, salt);
  return constantTimeEqual(computed, expectedHash);
}

// Ephemeral fallback secret ONLY if SESSION_SECRET env var is unset (e.g. fresh local dev)
const ephemeralBytes = new Uint8Array(32);
crypto.getRandomValues(ephemeralBytes);
const EPHEMERAL_FALLBACK_SECRET = toHex(ephemeralBytes);

export function resolveSessionSecret(envSecret?: string): string {
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }
  return EPHEMERAL_FALLBACK_SECRET;
}

async function signHmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

export interface SessionTokenPayload {
  kind: 'user';
  uid: string;
  email: string;
  iat: number;
  exp: number;
}

export interface WorkspaceTokenPayload {
  kind: 'workspace';
  uid: string;
  companyId: string;
  iat: number;
  exp: number;
}

export async function issueSignedToken<T extends SessionTokenPayload | WorkspaceTokenPayload>(
  payload: T,
  secret: string
): Promise<string> {
  const headerB64 = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;
  const sig = await signHmac(unsigned, secret);
  return `${unsigned}.${sig}`;
}

export async function verifySignedToken<T extends SessionTokenPayload | WorkspaceTokenPayload>(
  token: string,
  secret: string,
  expectedKind: T['kind']
): Promise<T | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const expectedSig = await signHmac(`${headerB64}.${payloadB64}`, secret);
  if (!constantTimeEqual(sigB64, expectedSig)) return null;

  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(payloadB64))) as T;
    if (parsed.kind !== expectedKind) return null;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
