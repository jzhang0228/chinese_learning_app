import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

function anthropicRequest(apiKey: string, body: object): string {
  const jsonBody = JSON.stringify(body);
  const result = execSync(
    `curl -s https://api.anthropic.com/v1/messages -H "x-api-key: ${apiKey}" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d @-`,
    { input: jsonBody, encoding: 'utf-8', timeout: 30000 }
  );
  return result;
}

export async function POST(request: Request) {
  try {
    const { english_word, chinese_text } = await request.json();

    if (!english_word || !chinese_text) {
      return NextResponse.json({ error: 'english_word and chinese_text are required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const fallback = [
        { chinese: `${chinese_text}`, pinyin: '', english: `${english_word}` },
        { chinese: `很${chinese_text}`, pinyin: '', english: `very ${english_word}` },
        { chinese: `这个${chinese_text}很好`, pinyin: '', english: `This ${english_word} is good` },
        { chinese: `你喜欢${chinese_text}吗？`, pinyin: '', english: `Do you like ${english_word}?` },
      ];
      return NextResponse.json({ sentences: fallback });
    }

    const raw = anthropicRequest(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are a friendly Mandarin Chinese teacher for young children (ages 5-10). Write sentences that are simple enough for kids to understand but educational. You can include idioms, abstract concepts, and cultural expressions — these are great for learning. Use everyday topics like family, animals, food, school, playing, nature, and feelings.',
      messages: [{
        role: 'user',
        content: `Write 4 simple examples using "${chinese_text}" (${english_word}) that a child would understand.
Exactly in this order:
1. A REAL CHINESE PHRASE or compound word that contains "${chinese_text}" (2-4 characters). Must be an actual common phrase or word combination used in Chinese, NOT a made-up sentence. Examples of good phrases: 大人, 大家, 小心, 水果, 上学.
2. A DIFFERENT REAL CHINESE PHRASE or compound word that contains "${chinese_text}" (2-4 characters). Must also be a real phrase, different meaning from #1.
3. A FULL SENTENCE — about daily life a child knows (family, food, animals, school, play)
4. A FULL SENTENCE — a fun question or exclamation a kid would say

Keep sentences short and easy. Use only common, simple words alongside "${chinese_text}".

CRITICAL: You MUST use exactly the character "${chinese_text}" — do NOT substitute visually similar characters. For example, 己 (jǐ, self) and 已 (yǐ, already) are DIFFERENT characters. Double-check every character in your output matches "${chinese_text}" exactly.

IMPORTANT: Only use standard Mandarin Chinese. Do NOT use dialectal forms, non-standard usage, or force the character into words where it doesn't belong in standard Chinese. If "${chinese_text}" does not naturally appear in a common phrase, use it correctly in a sentence instead. For example, 己 belongs in 自己 (zìjǐ, oneself), NOT in 己经 (which is wrong — the correct word is 已经 using 已).

Return ONLY a JSON array of exactly 4 objects:
[{"chinese":"...","pinyin":"...","english":"..."}]`,
      }],
    });

    const data = JSON.parse(raw);
    const text = data.content?.[0]?.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse sentences' }, { status: 500 });
    }

    const sentences = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ sentences });
  } catch (e) {
    console.error('Sentences API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
