'use client';

import { useStockData } from '@/hooks/useStockData';
import StockTable from '@/components/market/StockTable';
import { addToWatchlist } from '@/lib/storage';

export default function MarketPage() {
  const { stocks, loading, lastUpdate } = useStockData();

  const handleAddWatchlist = (symbol: string) => {
    addToWatchlist(symbol);
    alert(`${symbol} takip listesine eklendi!`);
  };

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
        Tüm BIST Hisseleri
      </h2>
      <StockTable
        stocks={stocks}
        loading={loading}
        lastUpdate={lastUpdate}
        showActions
        onAddWatchlist={handleAddWatchlist}
      />
    </div>
  );
}
