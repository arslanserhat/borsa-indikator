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

export function usePortfolioAlerts() {
  const [alerts, setAlerts] = useState<PortfolioAlert[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  // Bildirim izni iste
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
  }, []);

  // Push bildirim gönder
  const sendNotification = useCallback((alert: PortfolioAlert) => {
    // Aynı bildirimi tekrar gönderme (5 dakikada bir max)
    const key = `${alert.symbol}-${alert.type}`;
    if (notifiedRef.current.has(key)) return;
    notifiedRef.current.add(key);
    setTimeout(() => notifiedRef.current.delete(key), 300000); // 5 dk sonra tekrar bildir

    if (permissionGranted && typeof window !== 'undefined' && 'Notification' in window) {
      const icon = alert.type === 'emergency' ? '🔴' : alert.type === 'critical' ? '🟠' : '🟡';
      new Notification(`${icon} ${alert.title}`, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: key,
        requireInteraction: alert.type === 'emergency',
      });
    }
  }, [permissionGranted]);

  // Portföy + scan verilerini kontrol et
  const checkAlerts = useCallback(async () => {
    try {
      // Portföy verisi
      const portRes = await fetch('/api/user/portfolio');
      if (!portRes.ok) return;
      const portData = await portRes.json();
      const portfolio = portData.portfolio || [];
      if (portfolio.length === 0) return;

      // Scan verisi (sinyaller)
      const scanRes = await fetch('/api/analysis/scan');
      const scanData = await scanRes.json();
      const scanMap: Record<string, any> = {};
      for (const item of (scanData.data || [])) {
        scanMap[item.symbol] = item;
      }

      // Makro durum
      const macroRes = await fetch('/api/market/state');
      const macroData = await macroRes.json();

      const newAlerts: PortfolioAlert[] = [];

      // Makro uyarı
      if (macroData.marketMode === 'crash' || macroData.marketMode === 'panic') {
        newAlerts.push({
          symbol: 'BIST100',
          type: 'emergency',
          title: 'PIYASA CRASH!',
          message: macroData.message,
          price: macroData.bist100Price,
          changePercent: macroData.bist100Change,
          timestamp: Date.now(),
        });
      }

      for (const pos of portfolio) {
        const sig = scanMap[pos.symbol];
        if (!sig) continue;

        const pnlPercent = pos.avg_cost > 0 ? ((sig.price - pos.avg_cost) / pos.avg_cost) * 100 : 0;

        // ACIL: -%10 düşüş
        if (pnlPercent <= -10) {
          const alert: PortfolioAlert = {
            symbol: pos.symbol,
            type: 'emergency',
            title: `ACIL SAT: ${pos.symbol}`,
            message: `${pos.symbol} %${Math.abs(pnlPercent).toFixed(1)} dususte! Hemen satin. Fiyat: ${sig.price} TL`,
            price: sig.price,
            changePercent: pnlPercent,
            timestamp: Date.now(),
          };
          newAlerts.push(alert);
          sendNotification(alert);
        }
        // KRİTİK: -%7 düşüş veya GUCLU_SAT sinyali
        else if (pnlPercent <= -7 || sig.signal === 'GUCLU_SAT') {
          const alert: PortfolioAlert = {
            symbol: pos.symbol,
            type: 'critical',
            title: `${pos.symbol} Tehlikede`,
            message: `${pos.symbol} %${Math.abs(pnlPercent).toFixed(1)} zarar. Sinyal: ${sig.signalText}. Satis dusunun.`,
            price: sig.price,
            changePercent: pnlPercent,
            timestamp: Date.now(),
          };
          newAlerts.push(alert);
          sendNotification(alert);
        }
        // UYARI: SAT sinyali
        else if (sig.signal === 'SAT') {
          newAlerts.push({
            symbol: pos.symbol,
            type: 'warning',
            title: `${pos.symbol} SAT Sinyali`,
            message: `${pos.symbol} SAT sinyali veriyor (skor: ${sig.score}). Pozisyonu gozden gecirin.`,
            price: sig.price,
            changePercent: pnlPercent,
            timestamp: Date.now(),
          });
        }
        // BİLGİ: Güçlü AL sinyali (fırsat)
        else if (sig.signal === 'GUCLU_AL') {
          newAlerts.push({
            symbol: pos.symbol,
            type: 'info',
            title: `${pos.symbol} GUCLU AL`,
            message: `${pos.symbol} guclu alis sinyali (skor: ${sig.score}). Pozisyon artirilabilir.`,
            price: sig.price,
            changePercent: pnlPercent,
            timestamp: Date.now(),
          });
        }
      }

      setAlerts(newAlerts.sort((a, b) => {
        const order = { emergency: 0, critical: 1, warning: 2, info: 3 };
        return order[a.type] - order[b.type];
      }));
    } catch {}
  }, [sendNotification]);

  // Sayfa yüklendiğinde izin iste + periyodik kontrol
  useEffect(() => {
    requestPermission();
    checkAlerts();
    const interval = setInterval(checkAlerts, 30000); // 30 saniyede bir kontrol
    return () => clearInterval(interval);
  }, [requestPermission, checkAlerts]);

  return { alerts, permissionGranted, requestPermission, checkAlerts };
}
