import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=rm&q=${encodedText}`;

    const raw = execSync(`curl -s "${url}"`, { encoding: 'utf-8', timeout: 15000 });
    const data = JSON.parse(raw);

    let chinese = '';
    let pinyin = '';

    if (data && data[0]) {
      for (const segment of data[0]) {
        if (segment && segment[0]) {
          chinese += segment[0];
        }
        if (segment && segment[2] && !pinyin) {
          pinyin = segment[2];
        }
      }
    }

    return NextResponse.json({ chinese, pinyin });
  } catch (e) {
    console.error('Translate API error:', e);
    return NextResponse.json({ error: 'Translation error' }, { status: 500 });
  }
}
