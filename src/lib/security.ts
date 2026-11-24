// Cryptographic password hashing & input validation for JESSI

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2Hex(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltBytes = fromHex(saltHex);
  const derived = await window.crypto.subtle.deriveBits(
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

export async function hashWorkspacePassword(password: string): Promise<{ salt: string; hash: string }> {
  const clean = password.trim();
  if (clean.length < 4) {
    throw new Error('Le mot de passe doit contenir au moins 4 caractères non vides.');
  }
  const saltBytes = new Uint8Array(16);
  window.crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const hash = await derivePbkdf2Hex(password, salt);
  return { salt, hash };
}

export async function verifyWorkspacePassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!password || password.trim().length === 0) {
    return false;
  }
  if (!salt || !expectedHash) {
    return false;
  }
  const computed = await derivePbkdf2Hex(password, salt);
  return constantTimeEqual(computed, expectedHash);
}

export function isNonEmptyText(val: string | undefined | null, minLen = 1): boolean {
  return typeof val === 'string' && val.trim().length >= minLen;
}

export function validatePersonalDetails(input: {
  lastName: string;
  firstName: string;
  phone?: string;
  address?: string;
}): string | null {
  if (!isNonEmptyText(input.lastName, 2)) {
    return 'Le nom est obligatoire (minimum 2 caractères).';
  }
  if (!isNonEmptyText(input.firstName, 2)) {
    return 'Le ou les prénoms sont obligatoires (minimum 2 caractères).';
  }
  if (input.phone && input.phone.trim().length > 0) {
    const digits = input.phone.replace(/\D/g, '');
    if (digits.length < 6) {
      return 'Le numéro de téléphone saisi semble incomplet.';
    }
  }
  if (input.address && input.address.trim().length > 0 && input.address.trim().length < 3) {
    return 'L’adresse saisie est trop courte.';
  }
  return null;
}

export function validateWorkspacePasswordPair(password: string, confirm?: string): string | null {
  if (!password || password.trim().length === 0) {
    return 'Le mot de passe de l’espace de travail ne peut pas être vide.';
  }
  if (password.trim().length < 4) {
    return 'Le mot de passe doit contenir au moins 4 caractères utiles.';
  }
  if (typeof confirm === 'string' && password !== confirm) {
    return 'Les deux mots de passe saisis ne correspondent pas.';
  }
  return null;
}
