import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
  try {
    const username = await getAuthenticatedUser();

    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ username });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
