import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function createSession(username: string): string {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const createdAt = Date.now() / 1000;
  db.prepare('INSERT INTO sessions (token, username, created_at) VALUES (?, ?, ?)').run(token, username, createdAt);
  return token;
}

export function validateSession(token: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT username FROM sessions WHERE token = ?').get(token) as { username: string } | undefined;
  return row ? row.username : null;
}

export function deleteSession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
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
