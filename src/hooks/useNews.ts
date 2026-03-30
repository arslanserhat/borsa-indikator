'use client';

import { useState, useEffect, useCallback } from 'react';
import { NewsItem, TickerItem } from '@/types/news';

// Genel haberler hook'u
export function useNews(source: string = 'all') {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchNews = useCallback(async (p: number, append: boolean = false) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/news?page=${p}&limit=30&source=${source}`);
      const data = await res.json();
      if (append) {
        setNews((prev) => [...prev, ...(data.data || [])]);
      } else {
        setNews(data.data || []);
      }
      setHasMore(data.hasMore || false);
      setTotal(data.total || 0);
    } catch {
      if (!append) setNews([]);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    setPage(1);
    fetchNews(1);
    const interval = setInterval(() => fetchNews(1), 60_000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchNews(next, true);
  }, [page, fetchNews]);

  return { news, loading, hasMore, total, loadMore, refresh: () => fetchNews(1) };
}

// Hisse bazlı haberler hook'u
export function useStockNews(symbol: string) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    if (!symbol) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/news/${symbol}?limit=10`);
      const data = await res.json();
      setNews(data.data || []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 30_000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return { news, loading, refresh: fetchNews };
}

// Ticker (kayan yazı) hook'u
export function useNewsTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch('/api/news/ticker');
        const data = await res.json();
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTicker();
    const interval = setInterval(fetchTicker, 15_000); // 15 saniyede bir güncelle
    return () => clearInterval(interval);
  }, []);

  return { items, loading };
}
