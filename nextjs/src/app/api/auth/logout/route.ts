import { NextResponse } from 'next/server';
import { getSessionFromCookies, deleteSession } from '@/lib/auth';

export async function POST() {
  try {
    const token = await getSessionFromCookies();

    if (token) {
      deleteSession(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
