import { NextRequest, NextResponse } from 'next/server';
import { addToWaitlist, getWaitlistCount } from '@/lib/db';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = (body as { email?: unknown })?.email;

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { created } = await addToWaitlist(normalizedEmail);

  return NextResponse.json({
    ok: true,
    alreadyJoined: !created,
  });
}

export async function GET() {
  return NextResponse.json({ count: await getWaitlistCount() });
}
