'use client';

import { useState } from 'react';
import { X, TrendingUp, TrendingDown, Plus, Trash2, DollarSign, Target } from 'lucide-react';
import { usePaperTrades } from '@/hooks/usePaperTrades';

interface Props {
    summaries: Record<string, { price: number }>;
    watchlistSymbols: string[];
    onClose: () => void;
}

function formatMoney(n: number) {
    const sign = n >= 0 ? '+' : '';
    return `${sign}$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatPct(n: number) {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
}

export default function PaperTradesPanel({ summaries, watchlistSymbols, onClose }: Props) {
    const { openTrades, closedTrades, stats, openTrade, closeTrade, deleteTrade, clearAll } = usePaperTrades(summaries);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        symbol: watchlistSymbols[0] || '',
        side: 'LONG' as 'LONG' | 'SHORT',
        entryPrice: '',
        quantity: '',
        note: '',
    });
    const [tab, setTab] = useState<'open' | 'closed'>('open');
    const [confirmClear, setConfirmClear] = useState(false);

    const handleOpen = () => {
        const entry = parseFloat(form.entryPrice);
        const qty = parseFloat(form.quantity);
        if (!form.symbol || isNaN(entry) || entry <= 0 || isNaN(qty) || qty <= 0) return;
        openTrade({ symbol: form.symbol, side: form.side, entryPrice: entry, quantity: qty, note: form.note });
        setShowForm(false);
        setForm({ symbol: form.symbol, side: 'LONG', entryPrice: '', quantity: '', note: '' });
    };

    const useMarket = () => {
        const p = summaries[form.symbol]?.price;
        if (typeof p === 'number') setForm(f => ({ ...f, entryPrice: p.toString() }));
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <Target size={18} className="text-indigo-500" />
                        <h2 className="text-base font-black text-gray-900 dark:text-gray-100">Paper Trading Tracker</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        <X size={18} />
                    </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Total P&L</div>
                        <div className={`text-sm font-black ${stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {formatMoney(stats.totalPnl)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Open P&L</div>
                        <div className={`text-sm font-black ${stats.openPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {formatMoney(stats.openPnl)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Win Rate</div>
                        <div className="text-sm font-black text-gray-900 dark:text-gray-100">
                            {stats.winRate.toFixed(0)}%
                            <span className="text-gray-400 text-xs font-normal ml-1">({stats.wins}W / {stats.losses}L)</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Open / Closed</div>
                        <div className="text-sm font-black text-gray-900 dark:text-gray-100">
                            {stats.openCount} / {stats.closedCount}
                        </div>
                    </div>
                </div>

                {/* Tabs + Actions */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                    <button
                        onClick={() => setTab('open')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg ${tab === 'open' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Open ({stats.openCount})
                    </button>
                    <button
                        onClick={() => setTab('closed')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg ${tab === 'closed' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Closed ({stats.closedCount})
                    </button>
                    <div className="ml-auto flex gap-2">
                        {stats.totalTrades > 0 && (
                            <button
                                onClick={() => {
                                    if (confirmClear) { clearAll(); setConfirmClear(false); }
                                    else setConfirmClear(true);
                                }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${confirmClear ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-red-500 border border-gray-200 dark:border-gray-700'}`}
                            >
                                {confirmClear ? 'Confirm clear' : 'Clear all'}
                            </button>
                        )}
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1"
                        >
                            <Plus size={12} /> New trade
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {showForm && (
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Symbol</label>
                                    <select
                                        value={form.symbol}
                                        onChange={(e) => setForm(f => ({ ...f, symbol: e.target.value }))}
                                        className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-gray-100"
                                    >
                                        {watchlistSymbols.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Side</label>
                                    <div className="flex gap-1 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, side: 'LONG' }))}
                                            className={`flex-1 px-2 py-1.5 text-xs font-bold rounded-lg ${form.side === 'LONG' ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700'}`}
                                        >
                                            LONG
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, side: 'SHORT' }))}
                                            className={`flex-1 px-2 py-1.5 text-xs font-bold rounded-lg ${form.side === 'SHORT' ? 'bg-red-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700'}`}
                                        >
                                            SHORT
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Entry Price</label>
                                    <div className="flex gap-1 mt-1">
                                        <input
                                            type="number"
                                            step="any"
                                            value={form.entryPrice}
                                            onChange={(e) => setForm(f => ({ ...f, entryPrice: e.target.value }))}
                                            className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-gray-100"
                                        />
                                        <button type="button" onClick={useMarket} className="px-2 py-1 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg">
                                            MKT
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Quantity</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={form.quantity}
                                        onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                                        className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-gray-100"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Note (optional)</label>
                                <input
                                    type="text"
                                    value={form.note}
                                    onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                                    placeholder="Thesis, target, stop..."
                                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-gray-100"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700">
                                    Cancel
                                </button>
                                <button onClick={handleOpen} className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                                    Open trade
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'open' ? (
                        openTrades.length === 0 ? (
                            <div className="text-center py-10 text-sm text-gray-400">
                                <DollarSign size={28} className="mx-auto mb-2 opacity-40" />
                                No open paper trades. Click "New trade" to start tracking one.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {openTrades.map(t => (
                                    <div key={t.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5">
                                        <div className={`p-1.5 rounded-lg ${t.side === 'LONG' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-500'}`}>
                                            {t.side === 'LONG' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-sm text-gray-900 dark:text-gray-100">{t.symbol}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.side === 'LONG' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                                    {t.side}
                                                </span>
                                                <span className="text-[11px] text-gray-500">
                                                    {t.quantity} @ ${t.entryPrice.toFixed(2)} → ${typeof t.currentPrice === 'number' ? t.currentPrice.toFixed(2) : '—'}
                                                </span>
                                            </div>
                                            {t.note && <p className="text-[11px] text-gray-400 truncate mt-0.5">{t.note}</p>}
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-black ${(t.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {t.pnl !== null ? formatMoney(t.pnl) : '—'}
                                            </div>
                                            <div className={`text-[10px] font-bold ${(t.pnlPct ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {t.pnlPct !== null ? formatPct(t.pnlPct) : ''}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const p = t.currentPrice;
                                                if (typeof p === 'number') closeTrade(t.id, p);
                                            }}
                                            disabled={typeof t.currentPrice !== 'number'}
                                            className="px-2 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg"
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={() => deleteTrade(t.id)}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        closedTrades.length === 0 ? (
                            <div className="text-center py-10 text-sm text-gray-400">
                                No closed trades yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {closedTrades.map(t => (
                                    <div key={t.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5 opacity-90">
                                        <div className={`p-1.5 rounded-lg ${t.side === 'LONG' ? 'bg-green-50 dark:bg-green-900/20 text-green-500' : 'bg-red-50 dark:bg-red-900/20 text-red-400'}`}>
                                            {t.side === 'LONG' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-sm text-gray-900 dark:text-gray-100">{t.symbol}</span>
                                                <span className="text-[11px] text-gray-500">
                                                    {t.quantity} @ ${t.entryPrice.toFixed(2)} → ${(t.closePrice ?? 0).toFixed(2)}
                                                </span>
                                            </div>
                                            {t.note && <p className="text-[11px] text-gray-400 truncate mt-0.5">{t.note}</p>}
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-black ${(t.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {formatMoney(t.pnl ?? 0)}
                                            </div>
                                            <div className={`text-[10px] font-bold ${(t.pnlPct ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {formatPct(t.pnlPct ?? 0)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteTrade(t.id)}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
