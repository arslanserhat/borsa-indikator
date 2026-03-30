'use client';

import { useState, useEffect, useCallback } from 'react';
import { Stock } from '@/types/stock';

const REFRESH_INTERVAL = 5000; // 5 saniye - anlık güncelleme

export function useStockData() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks');
      if (!res.ok) throw new Error('API hatası');
      const json = await res.json();
      setStocks(json.data || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Veri alınamadı');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { stocks, loading, lastUpdate, error, refresh: fetchData };
}

export function useMarketSummary() {
  const [summary, setSummary] = useState<{ endeksler: any[]; doviz: any[] }>({ endeksler: [], doviz: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks?type=summary');
      if (!res.ok) throw new Error('API hatası');
      const json = await res.json();
      setSummary({ endeksler: json.endeksler || [], doviz: json.doviz || [] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { summary, loading, refresh: fetchData };
}
