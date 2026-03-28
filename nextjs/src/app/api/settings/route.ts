import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = getDb();
    const row = db.prepare('SELECT manual_level FROM settings WHERE username = ?').get(username) as { manual_level: number | null } | undefined;

    return NextResponse.json({ manual_level: row?.manual_level ?? null });
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

    const db = getDb();
    db.prepare(
      'INSERT INTO settings (username, manual_level) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET manual_level = ?'
    ).run(username, manual_level, manual_level);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
