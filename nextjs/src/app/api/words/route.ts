import { NextResponse } from 'next/server';
import { getDb, isUniqueConstraintError } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    const words = await db.all<{ id: number; english: string; chinese: string; pinyin: string }>(
      'SELECT id, english, chinese, pinyin FROM learned_words WHERE username = ?',
      [username]
    );

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

    const db = await getDb();
    try {
      await db.run(
        'INSERT INTO learned_words (username, english, chinese, pinyin) VALUES (?, ?, ?, ?)',
        [username, english, chinese, pinyin]
      );
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        return NextResponse.json({ error: 'Word already saved' }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
