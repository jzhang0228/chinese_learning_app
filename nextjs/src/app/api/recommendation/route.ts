import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

interface CharacterRow {
  rank: number;
  character: string;
  pinyin: string;
  english: string;
  level: number;
}

// CSV format: rank,character,pinyin,english,frequency_rank,stroke_count
function loadCharacters(): CharacterRow[] {
  const csvPath = path.join(process.cwd(), 'characters.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const characters: CharacterRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 6) {
      const rank = parseInt(parts[0], 10);
      // english field may contain commas, so take everything between pinyin and the last two numeric fields
      const english = parts.slice(3, parts.length - 2).join(',');
      characters.push({
        rank,
        character: parts[1],
        pinyin: parts[2],
        english,
        level: Math.min(250, Math.ceil(rank / 20)),
      });
    }
  }
  return characters;
}

function determineLevel(
  learnedWords: { chinese: string }[],
  manualLevel: number | null,
  characters: CharacterRow[]
): number {
  if (manualLevel !== null && manualLevel !== undefined && manualLevel > 0) {
    return manualLevel;
  }

  if (learnedWords.length === 0) return 1;

  const learnedChars = new Set(learnedWords.map((w) => w.chinese));

  // Start from level 1, only advance when all 20 words at the level are learned
  for (let lvl = 1; lvl <= 250; lvl++) {
    const charsAtLevel = characters.filter((c) => c.level === lvl);
    const allLearned = charsAtLevel.every((c) => learnedChars.has(c.character));
    if (!allLearned) return lvl;
  }

  return 250;
}

export async function GET() {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await getDb();

    const learnedWords = await db.all<{ chinese: string }>(
      'SELECT chinese FROM learned_words WHERE username = ?',
      [username]
    );
    const learnedChars = new Set(learnedWords.map((w) => w.chinese));

    const settings = await db.get<{ manual_level: number | null }>(
      'SELECT manual_level FROM settings WHERE username = ?',
      [username]
    );
    const manualLevel = settings?.manual_level ?? null;

    const characters = loadCharacters();
    const currentLevel = determineLevel(learnedWords, manualLevel, characters);

    // Save current level to DB
    await db.run(
      'INSERT INTO settings (username, current_level) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET current_level = ?',
      [username, currentLevel, currentLevel]
    );

    const unlearnedAtLevel = characters.filter((c) => c.level === currentLevel && !learnedChars.has(c.character));

    if (unlearnedAtLevel.length > 0) {
      const pick = unlearnedAtLevel[Math.floor(Math.random() * unlearnedAtLevel.length)];
      return NextResponse.json({
        character: pick.character,
        pinyin: pick.pinyin,
        english: pick.english,
        level: pick.level,
        rank: pick.rank,
        current_level: currentLevel,
      });
    }

    for (let lvl = currentLevel + 1; lvl <= 250; lvl++) {
      const unlearnedHigher = characters.filter((c) => c.level === lvl && !learnedChars.has(c.character));
      if (unlearnedHigher.length > 0) {
        const pick = unlearnedHigher[Math.floor(Math.random() * unlearnedHigher.length)];
        return NextResponse.json({
          character: pick.character,
          pinyin: pick.pinyin,
          english: pick.english,
          level: pick.level,
          rank: pick.rank,
          current_level: currentLevel,
        });
      }
    }

    return NextResponse.json({ character: null, current_level: currentLevel });
  } catch (e) {
    console.error('Recommendation error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
