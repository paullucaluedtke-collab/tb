import { Asset } from '@/config/assets';

/**
 * Returns the appropriate benchmark symbol for a given asset.
 * - Crypto compared against BTC-USD
 * - Everything else against SPY (S&P 500)
 */
export function getBenchmark(asset: Asset | { symbol: string; category?: string }): string {
    if (asset.category === 'Crypto') return 'BTC-USD';
    return 'SPY';
}

export const BENCHMARK_SYMBOLS = ['SPY', 'BTC-USD'] as const;

/**
 * Computes relative strength (%) = asset % change - benchmark % change over the window.
 * Positive means the asset outperformed the benchmark.
 */
export function relativeStrength(
    assetChangePct: number | undefined,
    benchmarkChangePct: number | undefined
): number | null {
    if (typeof assetChangePct !== 'number' || typeof benchmarkChangePct !== 'number') return null;
    if (isNaN(assetChangePct) || isNaN(benchmarkChangePct)) return null;
    return assetChangePct - benchmarkChangePct;
}
