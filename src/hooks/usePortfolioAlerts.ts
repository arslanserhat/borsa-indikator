'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PortfolioAlert {
  symbol: string;
  type: 'emergency' | 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  price: number;
  changePercent: number;
  timestamp: number;
}

// Sesli bildirim icin AudioContext
let audioCtx: AudioContext | null = null;

function playAlertSound(type: 'emergency' | 'critical' | 'warning' | 'info') {
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
    // Emergency: 2dk, Critical: 5dk, Warning: 10dk cooldown
    const cooldown = alert.type === 'emergency' ? 120000 : alert.type === 'critical' ? 300000 : 600000;
    setTimeout(() => notifiedRef.current.delete(key), cooldown);

    // Sesli bildirim
    if (soundEnabled) {
      playAlertSound(alert.type);
    }

    // Browser notification
    if (permissionGranted && typeof window !== 'undefined' && 'Notification' in window) {
      const icon = alert.type === 'emergency' ? '🔴' : alert.type === 'critical' ? '🟠' : '🟡';
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

      // Ani dusus: Son 5sn'de %2+ dusus
      if (priceChange <= -2) {
        const alert: PortfolioAlert = {
          symbol: pos.symbol, type: 'emergency',
          title: `ANI DUSUS: ${pos.symbol}`,
          message: `${pos.symbol} son guncelleme'de %${Math.abs(priceChange).toFixed(1)} dustu! Fiyat: ${stock.fiyat.toFixed(2)} TL. Toplam zarar: %${Math.abs(pnlPercent).toFixed(1)}`,
          price: stock.fiyat, changePercent: pnlPercent, timestamp: Date.now(),
        };
        newAlerts.push(alert);
        sendNotification(alert);
      }
      // ACIL SAT: -%10 toplam zarar
      else if (pnlPercent <= -10) {
        const alert: PortfolioAlert = {
          symbol: pos.symbol, type: 'emergency',
          title: `ACIL SAT: ${pos.symbol}`,
          message: `${pos.symbol} %${Math.abs(pnlPercent).toFixed(1)} zararda! Fiyat: ${stock.fiyat.toFixed(2)} TL. Maliyet: ${pos.avgCost.toFixed(2)} TL`,
          price: stock.fiyat, changePercent: pnlPercent, timestamp: Date.now(),
        };
        newAlerts.push(alert);
        sendNotification(alert);
      }
      // KRITIK: -%7 zarar veya gunde -%5 dusus
      else if (pnlPercent <= -7 || stock.degisimYuzde <= -5) {
        const alert: PortfolioAlert = {
          symbol: pos.symbol, type: 'critical',
          title: `${pos.symbol} Tehlikede`,
          message: `Zarar: %${Math.abs(pnlPercent).toFixed(1)} | Gun ici: %${stock.degisimYuzde.toFixed(1)} | Fiyat: ${stock.fiyat.toFixed(2)} TL`,
          price: stock.fiyat, changePercent: pnlPercent, timestamp: Date.now(),
        };
        newAlerts.push(alert);
        sendNotification(alert);
      }
      // UYARI: -%5 zarar veya gunde -%3 dusus
      else if (pnlPercent <= -5 || stock.degisimYuzde <= -3) {
        newAlerts.push({
          symbol: pos.symbol, type: 'warning',
          title: `${pos.symbol} Uyari`,
          message: `Zarar: %${Math.abs(pnlPercent).toFixed(1)} | Gun ici: %${stock.degisimYuzde.toFixed(1)} | Fiyat: ${stock.fiyat.toFixed(2)} TL`,
          price: stock.fiyat, changePercent: pnlPercent, timestamp: Date.now(),
        });
      }
      // BILGI: Guclu yukselis (portfoydeki hisse %5+ kar'da)
      else if (pnlPercent >= 10 && stock.degisimYuzde >= 3) {
        newAlerts.push({
          symbol: pos.symbol, type: 'info',
          title: `${pos.symbol} Kar Al?`,
          message: `%${pnlPercent.toFixed(1)} karda + bugunku yukselis %${stock.degisimYuzde.toFixed(1)}. Kismi kar alis dusunun.`,
          price: stock.fiyat, changePercent: pnlPercent, timestamp: Date.now(),
        });
      }

      prevPricesRef.current[pos.symbol] = stock.fiyat;
    }

    if (newAlerts.length > 0) {
      setAlerts(newAlerts.sort((a, b) => {
        const order = { emergency: 0, critical: 1, warning: 2, info: 3 };
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
