'use client';

import { useState } from 'react';
import { Bell, X, ArrowUp, ArrowDown, Check, PowerOff, Power } from 'lucide-react';
import { PriceAlert } from '@/hooks/usePriceAlerts';
import { cur, type Lang } from '@/lib/format';

interface Props {
    symbol: string;
    currentPrice?: number;
    alerts: PriceAlert[];
    onAdd: (symbol: string, direction: 'above' | 'below', price: number) => void;
    onRemove: (id: string) => void;
    onToggle: (id: string) => void;
    lang?: Lang;
}

export default function PriceAlertsPanel({
    symbol,
    currentPrice,
    alerts,
    onAdd,
    onRemove,
    onToggle,
    lang = 'en',
}: Props) {
    const c = cur(lang, symbol);
    const [direction, setDirection] = useState<'above' | 'below'>('above');
    const [priceStr, setPriceStr] = useState('');

    const handleAdd = () => {
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) {
            onAdd(symbol, direction, price);
            setPriceStr('');
        }
    };

    const formatPrice = (n: number) => {
        if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (n >= 1) return n.toFixed(2);
        return n.toFixed(4);
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <Bell size={16} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Price Alerts</h3>
                {currentPrice !== undefined && (
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                        Current: <span className="font-bold text-gray-900 dark:text-gray-100">{c}{formatPrice(currentPrice)}</span>
                    </span>
                )}
            </div>

            {/* Add alert form */}
            <div className="flex gap-2 mb-3">
                <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => setDirection('above')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors ${direction === 'above'
                            ? 'bg-green-500 text-white'
                            : 'text-gray-500 dark:text-gray-400'
                            }`}
                    >
                        <ArrowUp size={12} /> Above
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirection('below')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors ${direction === 'below'
                            ? 'bg-red-500 text-white'
                            : 'text-gray-500 dark:text-gray-400'
                            }`}
                    >
                        <ArrowDown size={12} /> Below
                    </button>
                </div>
                <input
                    type="number"
                    step="any"
                    placeholder="Price"
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                    className="flex-1 px-3 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-100"
                />
                <button
                    onClick={handleAdd}
                    disabled={!priceStr}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors"
                >
                    Add
                </button>
            </div>

            {/* Alert list */}
            {alerts.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                    No alerts set. Add one above to get notified when the price crosses a level.
                </p>
            ) : (
                <div className="space-y-1.5">
                    {alerts.map((a) => (
                        <div
                            key={a.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${a.triggeredAt
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900'
                                : a.active
                                    ? 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                                    : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 opacity-50'
                                }`}
                        >
                            {a.triggeredAt ? (
                                <Check size={12} className="text-yellow-600" />
                            ) : a.direction === 'above' ? (
                                <ArrowUp size={12} className="text-green-500" />
                            ) : (
                                <ArrowDown size={12} className="text-red-500" />
                            )}
                            <span className="font-bold text-gray-700 dark:text-gray-200">
                                {a.direction === 'above' ? '≥' : '≤'} {c}{formatPrice(a.price)}
                            </span>
                            {a.triggeredAt && (
                                <span className="text-yellow-600 font-medium">triggered</span>
                            )}
                            <button
                                onClick={() => onToggle(a.id)}
                                title={a.active ? 'Disable' : 'Enable'}
                                className="ml-auto text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                disabled={!!a.triggeredAt}
                            >
                                {a.active ? <Power size={12} /> : <PowerOff size={12} />}
                            </button>
                            <button
                                onClick={() => onRemove(a.id)}
                                className="text-gray-400 hover:text-red-500"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
