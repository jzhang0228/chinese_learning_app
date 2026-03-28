import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function createSession(username: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString('hex');
  const createdAt = Date.now() / 1000;
  await db.run(
    'INSERT INTO sessions (token, username, created_at) VALUES (?, ?, ?)',
    [token, username, createdAt]
  );
  return token;
}

export async function validateSession(token: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ username: string }>(
    'SELECT username FROM sessions WHERE token = ?',
    [token]
  );
  return row ? row.username : null;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

export async function getSessionFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session_token');
  return sessionCookie ? sessionCookie.value : null;
}

export async function getAuthenticatedUser(): Promise<string | null> {
  const token = await getSessionFromCookies();
  if (!token) return null;
  return validateSession(token);
}
