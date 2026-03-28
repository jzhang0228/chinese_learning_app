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
    const words = db.prepare('SELECT id, english, chinese, pinyin FROM learned_words WHERE username = ?').all(username);

    return NextResponse.json({ words });
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

    const { english, chinese, pinyin } = await request.json();

    if (!english || !chinese || !pinyin) {
      return NextResponse.json({ error: 'english, chinese, and pinyin are required' }, { status: 400 });
    }

    const db = getDb();
    try {
      db.prepare('INSERT INTO learned_words (username, english, chinese, pinyin) VALUES (?, ?, ?, ?)').run(username, english, chinese, pinyin);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
        return NextResponse.json({ error: 'Word already saved' }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
