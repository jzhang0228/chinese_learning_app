import { NextResponse } from 'next/server';
import { getDb, isUniqueConstraintError } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET: fetch all review words for the user
export async function GET() {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();
    const words = await db.all<{
      chinese: string;
      pinyin: string;
      english: string;
      consecutive_correct: number;
    }>(
      'SELECT chinese, pinyin, english, consecutive_correct FROM review_words WHERE username = ?',
      [username]
    );

    return NextResponse.json({ words });
  } catch (e) {
    console.error('Review words GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: update review words after a sky drop game
// Body: { won: [{ chinese, pinyin, english }], lost: [{ chinese, pinyin, english }] }
export async function POST(request: Request) {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { won, lost } = await request.json();
    const db = await getDb();

    // Process lost words: add to table or reset consecutive_correct to 0
    if (lost && Array.isArray(lost)) {
      for (const word of lost) {
        if (!word.chinese) continue;
        try {
          await db.run(
            'INSERT INTO review_words (username, chinese, pinyin, english, consecutive_correct) VALUES (?, ?, ?, ?, 0)',
            [username, word.chinese, word.pinyin || '', word.english || '']
          );
        } catch (e) {
          if (isUniqueConstraintError(e)) {
            // Already exists — reset consecutive_correct to 0
            await db.run(
              'UPDATE review_words SET consecutive_correct = 0 WHERE username = ? AND chinese = ?',
              [username, word.chinese]
            );
          } else {
            throw e;
          }
        }
      }
    }

    // Process won words: increment consecutive_correct, remove if >= 5
    if (won && Array.isArray(won)) {
      for (const word of won) {
        if (!word.chinese) continue;
        // Only update if the word exists in review_words
        await db.run(
          'UPDATE review_words SET consecutive_correct = consecutive_correct + 1 WHERE username = ? AND chinese = ?',
          [username, word.chinese]
        );
      }
      // Remove words that reached 5 consecutive correct
      await db.run(
        'DELETE FROM review_words WHERE username = ? AND consecutive_correct >= 5',
        [username]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Review words POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
