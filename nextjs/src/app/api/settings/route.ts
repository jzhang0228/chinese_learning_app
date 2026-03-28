import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    const row = await db.get<{ manual_level: number | null; current_level: number }>(
      'SELECT manual_level, current_level FROM settings WHERE username = ?',
      [username]
    );

    return NextResponse.json({
      manual_level: row?.manual_level ?? null,
      current_level: row?.current_level ?? 1,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { manual_level } = await request.json();

    const db = await getDb();
    await db.run(
      'INSERT INTO settings (username, manual_level) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET manual_level = ?',
      [username, manual_level, manual_level]
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
