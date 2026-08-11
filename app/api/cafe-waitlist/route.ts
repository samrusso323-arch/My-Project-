import { NextRequest, NextResponse } from 'next/server';
import { addCafeToWaitlist, getCafeWaitlistCount } from '@/lib/db';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const cafeName = (body as { cafeName?: unknown })?.cafeName;
  const email = (body as { email?: unknown })?.email;

  if (typeof cafeName !== 'string' || cafeName.trim().length === 0) {
    return NextResponse.json(
      { error: 'Please enter your cafe name.' },
      { status: 400 }
    );
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { created } = await addCafeToWaitlist(cafeName.trim(), normalizedEmail);

  return NextResponse.json({
    ok: true,
    alreadyJoined: !created,
  });
}

export async function GET() {
  return NextResponse.json({ count: await getCafeWaitlistCount() });
}
