import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user });
}
