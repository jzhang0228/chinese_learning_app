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

function loadCharacters(): CharacterRow[] {
  const csvPath = path.join(process.cwd(), 'characters.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  // Skip header: rank,character,pinyin,english,level
  const characters: CharacterRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 5) {
      characters.push({
        rank: parseInt(parts[0], 10),
        character: parts[1],
        pinyin: parts[2],
        english: parts.slice(3, parts.length - 1).join(','), // english may contain commas
        level: parseInt(parts[parts.length - 1], 10),
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

  // Auto level calculation
  if (learnedWords.length === 0) return 1;

  const learnedChars = new Set(learnedWords.map((w) => w.chinese));

  // Find max level among learned characters
  let maxLearnedLevel = 1;
  for (const char of characters) {
    if (learnedChars.has(char.character) && char.level > maxLearnedLevel) {
      maxLearnedLevel = char.level;
    }
  }

  // Check if >=70% of current max level is learned
  const charsAtLevel = characters.filter((c) => c.level === maxLearnedLevel);
  const learnedAtLevel = charsAtLevel.filter((c) => learnedChars.has(c.character));

  if (charsAtLevel.length > 0 && learnedAtLevel.length / charsAtLevel.length >= 0.7 && maxLearnedLevel < 10) {
    return maxLearnedLevel + 1;
  }

  return maxLearnedLevel;
}

export async function GET() {
  try {
    const username = await getAuthenticatedUser();
    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = getDb();

    // Get learned words
    const learnedWords = db.prepare('SELECT chinese FROM learned_words WHERE username = ?').all(username) as { chinese: string }[];
    const learnedChars = new Set(learnedWords.map((w) => w.chinese));

    // Get settings
    const settings = db.prepare('SELECT manual_level FROM settings WHERE username = ?').get(username) as { manual_level: number | null } | undefined;
    const manualLevel = settings?.manual_level ?? null;

    // Load characters
    const characters = loadCharacters();

    // Determine level
    const currentLevel = determineLevel(learnedWords, manualLevel, characters);

    // Find unlearned characters at current level
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

    // Try higher levels
    for (let lvl = currentLevel + 1; lvl <= 10; lvl++) {
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

    // All characters learned
    return NextResponse.json({ character: null, current_level: currentLevel });
  } catch (e) {
    console.error('Recommendation error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
