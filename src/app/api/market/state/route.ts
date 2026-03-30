import { NextResponse } from 'next/server';
import { getMarketFilter } from '@/lib/macro';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getMarketFilter();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({
      marketMode: 'normal', scoreAdjustment: 0,
      message: 'Makro veri alinamadi', timestamp: Date.now(),
    });
  }
}
