'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PortfolioAlert {
  symbol: string;
  type: 'emergency' | 'critical' | 'warning' | 'info' | 'profit' | 'profit_strong';
  title: string;
  message: string;
  price: number;
  changePercent: number;
  stopLoss: number;
  timestamp: number;
}

// Sesli bildirim icin AudioContext
let audioCtx: AudioContext | null = null;

function playAlertSound(type: 'emergency' | 'critical' | 'warning' | 'info' | 'profit' | 'profit_strong') {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;

    if (type === 'emergency') {
      // Acil alarm - yuksek tonlu tekrarlayan bip
      for (let i = 0; i < 5; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'square';
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.15);
      }
    } else if (type === 'critical') {
      // Kritik - 3 bip
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 660;
        osc.type = 'triangle';
        gain.gain.value = 0.25;
        osc.start(ctx.currentTime + i * 0.4);
        osc.stop(ctx.currentTime + i * 0.4 + 0.2);
      }
    } else if (type === 'warning') {
      // Uyari - 2 bip
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.value = 0.2;
        osc.start(ctx.currentTime + i * 0.5);
        osc.stop(ctx.currentTime + i * 0.5 + 0.25);
      }
    } else if (type === 'profit_strong') {
      // Guclu kar - yukari arpej (mutlu ses)
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.2;
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.2);
      });
    } else if (type === 'profit') {
      // Kar al - 2 yukari bip
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 600 + i * 200;
        osc.type = 'sine';
        gain.gain.value = 0.18;
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.15);
      }
    } else {
      // Info - 1 kisa bip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 520;
      osc.type = 'sine';
      gain.gain.value = 0.15;
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {}
}

export function usePortfolioAlerts() {
  const [alerts, setAlerts] = useState<PortfolioAlert[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const notifiedRef = useRef<Set<string>>(new Set());
  const prevPricesRef = useRef<Record<string, number>>({});

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      setPermissionGranted(true);
      return;
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      setPermissionGranted(perm === 'granted');
    }
    // AudioContext unlock (kullanici etkilesimi gerekli)
    if (!audioCtx) audioCtx = new AudioContext();
  }, []);

  const sendNotification = useCallback((alert: PortfolioAlert) => {
    const key = `${alert.symbol}-${alert.type}`;
    if (notifiedRef.current.has(key)) return;
    notifiedRef.current.add(key);
    // Emergency: 2dk, Critical: 5dk, Profit: 10dk, Warning: 10dk cooldown
    const cooldown = alert.type === 'emergency' ? 120000 : alert.type === 'critical' ? 300000
      : alert.type === 'profit_strong' ? 600000 : alert.type === 'profit' ? 900000 : 600000;
    setTimeout(() => notifiedRef.current.delete(key), cooldown);

    // Sesli bildirim
    if (soundEnabled) {
      playAlertSound(alert.type);
    }

    // Browser notification
    if (permissionGranted && typeof window !== 'undefined' && 'Notification' in window) {
      const icon = alert.type === 'emergency' ? '🔴' : alert.type === 'critical' ? '🟠'
        : alert.type === 'profit_strong' ? '💰' : alert.type === 'profit' ? '💵' : '🟡';
      new Notification(`${icon} ${alert.title}`, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: key,
        requireInteraction: alert.type === 'emergency' || alert.type === 'critical',
      });
    }
  }, [permissionGranted, soundEnabled]);

  // ANLIK fiyat kontrolu - stocks verisine bagla (5sn guncelleme)
  const checkPriceAlerts = useCallback((stocks: { kod: string; fiyat: number; degisimYuzde: number }[]) => {
    if (typeof window === 'undefined') return;

    // localStorage'dan portfolio al
    const portfolioRaw = localStorage.getItem('borsa_portfolio');
    if (!portfolioRaw) return;

    let portfolio: { symbol: string; quantity: number; avgCost: number }[];
    try { portfolio = JSON.parse(portfolioRaw); } catch { return; }
    if (!portfolio || portfolio.length === 0) return;

    const stockMap: Record<string, { fiyat: number; degisimYuzde: number }> = {};
    for (const s of stocks) stockMap[s.kod] = { fiyat: s.fiyat, degisimYuzde: s.degisimYuzde };

    const newAlerts: PortfolioAlert[] = [];

    for (const pos of portfolio) {
      const stock = stockMap[pos.symbol];
      if (!stock || stock.fiyat <= 0) continue;

      const pnlPercent = pos.avgCost > 0 ? ((stock.fiyat - pos.avgCost) / pos.avgCost) * 100 : 0;
      const prevPrice = prevPricesRef.current[pos.symbol] || stock.fiyat;
      const priceChange = prevPrice > 0 ? ((stock.fiyat - prevPrice) / prevPrice) * 100 : 0;

      // Stop-loss seviyesi: maliyetin %7 altinda
      const stopLoss = Math.round(pos.avgCost * 0.93 * 100) / 100;

      // === ZARAR UYARILARI ===

      // Ani dusus: Son guncelleme'de %2+ dusus
      if (priceChange <= -2) {
        const a: PortfolioAlert = {
          symbol: pos.symbol, type: 'emergency',
          title: `ANI DUSUS: ${pos.symbol}`,
          message: `Son guncelleme'de %${Math.abs(priceChange).toFixed(1)} dustu! Fiyat: ${stock.fiyat.toFixed(2)} TL | Zarar: %${Math.abs(pnlPercent).toFixed(1)}`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        };
        newAlerts.push(a);
        sendNotification(a);
      }
      // Stop-loss tetiklendi
      else if (stock.fiyat <= stopLoss && pnlPercent < 0) {
        const a: PortfolioAlert = {
          symbol: pos.symbol, type: 'emergency',
          title: `STOP-LOSS: ${pos.symbol}`,
          message: `Fiyat (${stock.fiyat.toFixed(2)}) stop-loss seviyesinin (${stopLoss.toFixed(2)}) altinda! HEMEN SATIN.`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        };
        newAlerts.push(a);
        sendNotification(a);
      }
      // ACIL SAT: -%10 toplam zarar
      else if (pnlPercent <= -10) {
        const a: PortfolioAlert = {
          symbol: pos.symbol, type: 'emergency',
          title: `ACIL SAT: ${pos.symbol}`,
          message: `%${Math.abs(pnlPercent).toFixed(1)} zararda! Fiyat: ${stock.fiyat.toFixed(2)} TL | Maliyet: ${pos.avgCost.toFixed(2)} TL | Stop: ${stopLoss.toFixed(2)} TL`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        };
        newAlerts.push(a);
        sendNotification(a);
      }
      // KRITIK: -%7 zarar veya gunde -%5 dusus
      else if (pnlPercent <= -7 || stock.degisimYuzde <= -5) {
        const a: PortfolioAlert = {
          symbol: pos.symbol, type: 'critical',
          title: `${pos.symbol} Tehlikede`,
          message: `Zarar: %${Math.abs(pnlPercent).toFixed(1)} | Gun ici: %${stock.degisimYuzde.toFixed(1)} | Stop: ${stopLoss.toFixed(2)} TL`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        };
        newAlerts.push(a);
        sendNotification(a);
      }
      // UYARI: -%5 zarar veya gunde -%3 dusus
      else if (pnlPercent <= -5 || stock.degisimYuzde <= -3) {
        newAlerts.push({
          symbol: pos.symbol, type: 'warning',
          title: `${pos.symbol} Uyari`,
          message: `Zarar: %${Math.abs(pnlPercent).toFixed(1)} | Stop: ${stopLoss.toFixed(2)} TL`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        });
      }

      // === KAR AL BILDIRIMLERI (KADEMELI) ===

      // %10+ kar - GUCLU KAR AL (sesli)
      else if (pnlPercent >= 10) {
        const karTL = ((stock.fiyat - pos.avgCost) * pos.quantity).toFixed(2);
        const a: PortfolioAlert = {
          symbol: pos.symbol, type: 'profit_strong',
          title: `GUCLU KAR AL: ${pos.symbol} +%${pnlPercent.toFixed(1)}`,
          message: `Kar: ${karTL} TL | Fiyat: ${stock.fiyat.toFixed(2)} TL | Maliyet: ${pos.avgCost.toFixed(2)} TL | %50-70 kismi satis onerisi`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        };
        newAlerts.push(a);
        sendNotification(a);
      }
      // %8+ kar - KAR AL
      else if (pnlPercent >= 8) {
        const karTL = ((stock.fiyat - pos.avgCost) * pos.quantity).toFixed(2);
        const a: PortfolioAlert = {
          symbol: pos.symbol, type: 'profit',
          title: `KAR AL: ${pos.symbol} +%${pnlPercent.toFixed(1)}`,
          message: `Kar: ${karTL} TL | Stop-loss'u maliyete cekin (breakeven). %30-50 kismi satis dusunun.`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        };
        newAlerts.push(a);
        sendNotification(a);
      }
      // %5+ kar - KISMI KAR AL bildirimi
      else if (pnlPercent >= 5) {
        const karTL = ((stock.fiyat - pos.avgCost) * pos.quantity).toFixed(2);
        newAlerts.push({
          symbol: pos.symbol, type: 'profit',
          title: `${pos.symbol} +%${pnlPercent.toFixed(1)} karda`,
          message: `Kar: ${karTL} TL | Stop-loss'u yukseltin. Hedef: +%8-10 icin bekleyin veya %20 satin.`,
          price: stock.fiyat, changePercent: pnlPercent, stopLoss, timestamp: Date.now(),
        });
      }

      prevPricesRef.current[pos.symbol] = stock.fiyat;
    }

    if (newAlerts.length > 0) {
      setAlerts(newAlerts.sort((a, b) => {
        const order: Record<string, number> = { emergency: 0, critical: 1, warning: 2, profit_strong: 3, profit: 4, info: 5 };
        return order[a.type] - order[b.type];
      }));
    } else {
      setAlerts([]);
    }
  }, [sendNotification]);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return { alerts, permissionGranted, soundEnabled, setSoundEnabled, requestPermission, checkPriceAlerts };
}
