'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnalysisResult } from '@/types/analysis';

export function useAnalysis(symbol: string) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (!symbol) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/analysis/${symbol}`);
      const json = await res.json();
      if (json.data) { setAnalysis(json.data); setError(null); }
      else { setError(json.error || 'Analiz yapilamadi'); }
    } catch { setError('Baglanti hatasi'); }
    finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => {
    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 60_000);
    return () => clearInterval(interval);
  }, [fetchAnalysis]);

  return { analysis, loading, error, refresh: fetchAnalysis };
}
