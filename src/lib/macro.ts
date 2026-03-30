/**
 * MAKRO FİLTRE (ENDEKS ŞALTERİ)
 *
 * Ray Dalio yaklaşımı: Piyasa geneli düşerken bireysel hisse AL sinyali tehlikelidir.
 *
 * Kurallar:
 * 1. BIST100 -%2'den fazla düşerse → TÜM AL sinyallerini NÖTR'e çek
 * 2. BIST100 -%3'den fazla düşerse → NÖTR sinyalleri SAT'a çek
 * 3. Dolar %3+ yükselirse → Piyasa riskli, AL sinyallerini zayıflat
 * 4. BIST100 hacmi %200+ normalin üstündeyse → Panik satışı, dikkat
 */

import { fetchStockIndicators } from './tradingview';
import { cacheMarketState, getMarketState, getMacroOverride } from './redis';

export interface MarketState {
  bist100Change: number;
  bist100Price: number;
  usdTryChange: number;
  marketMode: 'normal' | 'caution' | 'panic' | 'crash';
  scoreAdjustment: number; // AL sinyallerinden düşülecek puan
  message: string;
  timestamp: number;
}

export async function getMarketFilter(): Promise<MarketState> {
  // 1. Önce test override kontrol (mock-macro simülasyonu)
  const override = await getMacroOverride();
  if (override && override.timestamp) {
    return override;
  }

  // 2. Redis cache kontrol
  const cached = await getMarketState();
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached;
  }

  try {
    // BIST100 ve USDTRY verisi çek
    const bist100 = await fetchStockIndicators('XU100', ['name', 'close', 'change']);
    const usdtry = await fetchStockIndicators('USDTRY', ['name', 'close', 'change']);

    const bist100Change = bist100?.[2] || 0;
    const bist100Price = bist100?.[1] || 0;
    const usdTryChange = usdtry?.[2] || 0;

    let marketMode: MarketState['marketMode'] = 'normal';
    let scoreAdjustment = 0;
    let message = '';

    if (bist100Change <= -3) {
      marketMode = 'crash';
      scoreAdjustment = -10; // Eski: -15 (cok agresifti, NOTR bolgesini asiyordu)
      message = `CRASH MODU: BIST100 %${bist100Change.toFixed(2)} dususte! Yeni pozisyon ACMAYIN.`;
    } else if (bist100Change <= -2) {
      marketMode = 'panic';
      scoreAdjustment = -7; // Eski: -10
      message = `PANIK: BIST100 %${bist100Change.toFixed(2)} dususte. AL sinyalleri zayiflatildi.`;
    } else if (bist100Change <= -1 || usdTryChange >= 2) {
      marketMode = 'caution';
      scoreAdjustment = -3; // Eski: -5
      message = `DIKKAT: ${bist100Change < -1 ? 'BIST100 %' + bist100Change.toFixed(2) + ' dususte' : 'Dolar %' + usdTryChange.toFixed(2) + ' yukseldi'}.`;
    } else {
      message = 'Piyasa normal. Sinyaller tam guvenilir.';
    }

    const state: MarketState = {
      bist100Change,
      bist100Price,
      usdTryChange,
      marketMode,
      scoreAdjustment,
      message,
      timestamp: Date.now(),
    };

    await cacheMarketState(state);
    return state;
  } catch {
    return {
      bist100Change: 0, bist100Price: 0, usdTryChange: 0,
      marketMode: 'normal', scoreAdjustment: 0,
      message: 'Makro veri alinamadi', timestamp: Date.now(),
    };
  }
}
