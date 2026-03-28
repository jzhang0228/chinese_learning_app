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
      system: 'You are a native Mandarin Chinese speaker helping beginners learn. Your job is to write sentences that sound EXACTLY like something a real person would say — not textbook examples.',
      messages: [{
        role: 'user',
        content: `Write 4 examples using "${chinese_text}" (${english_word}).
Exactly in this order:
1. A SHORT PHRASE (2-4 characters, no verb required)
2. A SHORT PHRASE (2-4 characters, different context)
3. A FULL SENTENCE — casual daily life (NOT starting with 我)
4. A FULL SENTENCE — question, reaction, or exclamation

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
