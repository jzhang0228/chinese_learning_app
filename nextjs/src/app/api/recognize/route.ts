import { NextResponse } from 'next/server';
import { execSync } from 'node:child_process';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const expectedText = formData.get('expected') as string | null;

    if (!imageFile || !expectedText) {
      return NextResponse.json({ error: 'image and expected text are required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        passed: true,
        feedback: 'Handwriting recognition requires ANTHROPIC_API_KEY. Marking as passed by default.',
      });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mediaType = imageFile.type || 'image/png';

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `A beginner is learning to write the Chinese character(s): ${expectedText}
Look at their handwritten attempt. This is a beginner using a mouse or finger, so be forgiving of messy strokes, bad proportions, and wobbly lines. PASS if you can tell they were attempting to write "${expectedText}" — even if some strokes are missing or imperfect, as long as the general shape is there. Only FAIL if they wrote a clearly different character, or the attempt has no recognisable resemblance to "${expectedText}". Stroke order does not matter.
Reply with exactly one line:
PASS: <brief encouraging feedback>
or
FAIL: <one simple tip>`,
            },
          ],
        },
      ],
    });

    const raw = execSync(
      `curl -s https://api.anthropic.com/v1/messages -H "x-api-key: ${apiKey}" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d @-`,
      { input: body, encoding: 'utf-8', timeout: 30000 }
    );

    const data = JSON.parse(raw);
    const text = (data.content?.[0]?.text || '').trim();
    const passed = text.toUpperCase().startsWith('PASS');
    const feedback = text.replace(/^(PASS|FAIL)[:\s]*/i, '').trim() || (passed ? 'Good job!' : 'Try again.');
    return NextResponse.json({ passed, feedback });
  } catch (e) {
    console.error('Recognize API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
