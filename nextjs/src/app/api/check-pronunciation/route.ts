import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

function stripTones(pinyin: string): string {
  return pinyin
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'v')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getPinyin(text: string): string {
  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=rm&q=${encoded}`;
  try {
    const raw = execSync(`curl -s "${url}"`, { encoding: 'utf-8', timeout: 10000 });
    const data = JSON.parse(raw);
    // Pinyin is in data[0][0][3] for romanization
    if (data?.[0]?.[0]?.[3]) {
      return data[0][0][3];
    }
    // Fallback: check other segments
    for (const seg of (data?.[0] || [])) {
      if (seg?.[3]) return seg[3];
    }
    return '';
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const { expected, transcript, expectedPinyin } = await request.json();

    if (!expected || !transcript) {
      return NextResponse.json({ error: 'expected and transcript are required' }, { status: 400 });
    }

    // 1. Exact character match — always pass
    if (transcript.includes(expected)) {
      return NextResponse.json({ passed: true, method: 'exact' });
    }

    // 2. Compare pinyin (tone-insensitive)
    const expectedPy = stripTones(expectedPinyin || getPinyin(expected));
    const transcriptPy = stripTones(getPinyin(transcript));

    if (!expectedPy || !transcriptPy) {
      return NextResponse.json({ passed: false, method: 'pinyin_failed' });
    }

    // Check if the transcript pinyin contains the expected pinyin
    if (transcriptPy.includes(expectedPy) || expectedPy.includes(transcriptPy)) {
      return NextResponse.json({ passed: true, method: 'pinyin' });
    }

    // Check individual syllables — pass if the expected syllable appears anywhere
    const expectedSyllables = expectedPy.split(' ').filter(Boolean);
    const transcriptSyllables = transcriptPy.split(' ').filter(Boolean);
    const matchCount = expectedSyllables.filter(s => transcriptSyllables.includes(s)).length;
    if (expectedSyllables.length > 0 && matchCount / expectedSyllables.length >= 0.5) {
      return NextResponse.json({ passed: true, method: 'syllable' });
    }

    return NextResponse.json({ passed: false, method: 'no_match' });
  } catch (e) {
    console.error('Check pronunciation error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
