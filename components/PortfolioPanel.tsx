'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    X, Plus, Trash2, Upload, Brain, Briefcase, AlertTriangle,
    TrendingUp, TrendingDown, Shield, Sparkles, Loader2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { usePortfolio, type Holding } from '@/hooks/usePortfolio';
import { enrichHoldings, summarizePortfolio, type HoldingSnapshot, type EnrichedHolding } from '@/lib/portfolioAnalysis';
import { cur, formatPrice, localeFor, type Lang } from '@/lib/format';

const DONUT_COLORS = [
    '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
    '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#64748b',
];

interface Summary {
    price: number;
    changePercent?: number;
    sector?: string;
    // Real summaries from useMarketData carry the signal inside `recommendation`.
    recommendation?: { action?: 'LONG' | 'SHORT' | 'WAIT'; confidence?: 'HIGH' | 'MEDIUM' | 'LOW' };
}

interface Props {
    onClose: () => void;
    onSelectSymbol?: (symbol: string) => void;
    summaries: Record<string, Summary>;
    lang?: Lang;
}

interface CoachResult {
    overallScore: number;
    headline: string;
    strengths: string;
    risks: string;
    actions: string;
    hedgeSuggestion?: string;
    rebalancing?: string;
    sectorComment?: string;
}

const SIGNAL_COLORS: Record<string, string> = {
    LONG: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    SHORT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    WAIT: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

export default function PortfolioPanel({ onClose, onSelectSymbol, summaries, lang = 'en' }: Props) {
    const { holdings, loading, error, addHolding, removeHolding, clearAll, importCsv, refresh } = usePortfolio();
    const [tab, setTab] = useState<'holdings' | 'allocation' | 'add' | 'import' | 'coach'>('holdings');
    const [confirmClear, setConfirmClear] = useState(false);

    const numLocale = localeFor(lang);
    const c = cur(lang);

    const t = {
        title: lang === 'de' ? 'Portfolio' : 'Portfolio',
        tabHoldings: lang === 'de' ? 'Positionen' : 'Holdings',
        tabAllocation: lang === 'de' ? 'Verteilung' : 'Allocation',
        tabAdd: lang === 'de' ? 'Hinzufügen' : 'Add',
        tabImport: lang === 'de' ? 'CSV Import' : 'CSV Import',
        tabCoach: lang === 'de' ? 'KI-Coach' : 'AI Coach',
        empty: lang === 'de' ? 'Noch keine Positionen. Füge eine hinzu oder importiere eine CSV.' : 'No holdings yet. Add one or import a CSV.',
        totalValue: lang === 'de' ? 'Wert' : 'Value',
        totalPnl: lang === 'de' ? 'Gesamt P&L' : 'Total P&L',
        dayPnl: lang === 'de' ? 'Heute' : 'Today',
        positions: lang === 'de' ? 'Positionen' : 'Positions',
        diversification: lang === 'de' ? 'Diversifikation' : 'Diversification',
        concentration: lang === 'de' ? 'Konz.-Risiko' : 'Concentration',
        topConcentration: lang === 'de' ? 'Größte Positionen' : 'Top Concentration',
        sectorMix: lang === 'de' ? 'Sektor-Verteilung' : 'Sector Mix',
        signals: lang === 'de' ? 'Signale' : 'Signals',
        clearAll: lang === 'de' ? 'Alle löschen' : 'Clear all',
        confirm: lang === 'de' ? 'Sicher?' : 'Sure?',
    };

    // Sectors fetched lazily from /api/portfolio/sectors (cached server-side).
    const [sectors, setSectors] = useState<Record<string, string>>({});
    useEffect(() => {
        const syms = holdings.map(h => h.symbol);
        if (syms.length === 0) return;
        const missing = syms.filter(s => !(s in sectors));
        if (missing.length === 0) return;
        fetch('/api/portfolio/sectors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: missing }),
        })
            .then(r => r.json())
            .then(d => { if (d.sectors) setSectors(prev => ({ ...prev, ...d.sectors })); })
            .catch(() => {});
    }, [holdings]); // eslint-disable-line react-hooks/exhaustive-deps

    // Build snapshots from passed-in summaries + resolved sectors
    const snapshots: Record<string, HoldingSnapshot> = useMemo(() => {
        const out: Record<string, HoldingSnapshot> = {};
        holdings.forEach(h => {
            const s = summaries[h.symbol];
            if (s) {
                out[h.symbol] = {
                    symbol: h.symbol,
                    price: s.price,
                    changePercent: s.changePercent,
                    sector: sectors[h.symbol] || s.sector,
                    technicalAction: s.recommendation?.action,
                    technicalConfidence: s.recommendation?.confidence,
                };
            } else if (sectors[h.symbol]) {
                out[h.symbol] = { symbol: h.symbol, sector: sectors[h.symbol] };
            }
        });
        return out;
    }, [holdings, summaries, sectors]);

    const enriched = useMemo(() => enrichHoldings(holdings, snapshots), [holdings, snapshots]);
    const summary = useMemo(() => summarizePortfolio(enriched), [enriched]);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600">
                            <Briefcase size={18} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                {/* Summary strip */}
                {holdings.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-xs">
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">{t.totalValue}</div>
                            <div className="text-base font-black text-gray-900 dark:text-gray-100">{formatPrice(summary.totalValue, lang)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">{t.totalPnl}</div>
                            <div className={`text-base font-black ${summary.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {summary.totalPnl >= 0 ? '+' : ''}{formatPrice(summary.totalPnl, lang)} ({summary.totalPnlPct.toFixed(2)}%)
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">{t.dayPnl}</div>
                            <div className={`text-base font-black ${summary.dayPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {summary.dayPnl >= 0 ? '+' : ''}{summary.dayPnlPct.toFixed(2)}%
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">{t.positions}</div>
                            <div className="text-base font-black text-gray-900 dark:text-gray-100">{summary.positions}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">{t.diversification}</div>
                            <div className="text-base font-black text-gray-900 dark:text-gray-100">{summary.diversificationScore}/100</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">{t.concentration}</div>
                            <div className={`text-base font-black ${
                                summary.concentrationRisk === 'HIGH' ? 'text-red-500'
                                : summary.concentrationRisk === 'MEDIUM' ? 'text-amber-500'
                                : 'text-green-600'}`}>
                                {summary.concentrationRisk}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 px-5 py-2 border-b border-gray-100 dark:border-gray-800">
                    {(['holdings', 'allocation', 'add', 'import', 'coach'] as const).map(key => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                                tab === key
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                        >
                            {key === 'holdings' ? t.tabHoldings
                                : key === 'allocation' ? t.tabAllocation
                                : key === 'add' ? t.tabAdd
                                : key === 'import' ? t.tabImport
                                : t.tabCoach}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loading && holdings.length === 0 && (
                        <div className="text-center text-gray-400 py-12">
                            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                            Loading…
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm mb-3">
                            <AlertTriangle size={14} className="inline mr-1" /> {error}
                        </div>
                    )}

                    {tab === 'holdings' && (
                        <HoldingsTab
                            enriched={enriched}
                            lang={lang}
                            onRemove={(id) => removeHolding(id).catch(() => {})}
                            onSelect={onSelectSymbol}
                        />
                    )}
                    {tab === 'allocation' && <AllocationTab enriched={enriched} summary={summary} lang={lang} />}
                    {tab === 'add' && <AddTab lang={lang} onAdded={async (input) => { await addHolding(input); setTab('holdings'); }} />}
                    {tab === 'import' && <ImportTab lang={lang} onImport={async (csv) => { const r = await importCsv(csv); setTab('holdings'); return r; }} />}
                    {tab === 'coach' && <CoachTab lang={lang} snapshots={snapshots} holdingsCount={holdings.length} />}
                </div>

                {/* Footer */}
                {tab === 'holdings' && holdings.length > 0 && (
                    <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={async () => {
                                if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; }
                                await clearAll(); setConfirmClear(false);
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                                confirmClear
                                    ? 'bg-red-500 text-white'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-red-500 border border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            <Trash2 size={12} className="inline mr-1" />
                            {confirmClear ? t.confirm : t.clearAll}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function HoldingsTab({
    enriched, lang, onRemove, onSelect,
}: {
    enriched: ReturnType<typeof enrichHoldings>;
    lang: Lang;
    onRemove: (id: number) => void;
    onSelect?: (sym: string) => void;
}) {
    if (enriched.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <Briefcase size={32} className="mx-auto mb-2 opacity-40" />
                {lang === 'de' ? 'Noch keine Positionen. Füge eine hinzu oder importiere eine CSV.' : 'No holdings yet. Add one or import a CSV.'}
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-gray-400 px-3 py-1">
                <div className="col-span-2">{lang === 'de' ? 'Symbol' : 'Symbol'}</div>
                <div className="col-span-1 text-right">{lang === 'de' ? 'Stück' : 'Qty'}</div>
                <div className="col-span-2 text-right">{lang === 'de' ? 'Einstand' : 'Avg Cost'}</div>
                <div className="col-span-2 text-right">{lang === 'de' ? 'Preis' : 'Price'}</div>
                <div className="col-span-2 text-right">{lang === 'de' ? 'Wert' : 'Value'}</div>
                <div className="col-span-2 text-right">P&L</div>
                <div className="col-span-1 text-right">{lang === 'de' ? 'Signal' : 'Signal'}</div>
            </div>
            {enriched.map(h => (
                <div
                    key={h.id}
                    className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs"
                >
                    <button
                        onClick={() => onSelect?.(h.symbol)}
                        className="col-span-2 font-black text-sm text-left text-gray-900 dark:text-gray-100 hover:text-indigo-600"
                    >
                        {h.symbol}
                        {h.sector && <div className="text-[9px] font-normal text-gray-400 truncate">{h.sector}</div>}
                    </button>
                    <div className="col-span-1 text-right text-gray-700 dark:text-gray-300">{h.quantity}</div>
                    <div className="col-span-2 text-right text-gray-500 tabular-nums">{formatPrice(h.avgCost, lang, { symbol: h.symbol })}</div>
                    <div className="col-span-2 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                        {h.currentPrice != null ? formatPrice(h.currentPrice, lang, { symbol: h.symbol }) : '—'}
                    </div>
                    <div className="col-span-2 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                        {h.marketValue != null ? formatPrice(h.marketValue, lang, { symbol: h.symbol }) : '—'}
                    </div>
                    <div className={`col-span-2 text-right font-bold tabular-nums ${
                        (h.unrealizedPnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                        {h.unrealizedPnl != null
                            ? `${h.unrealizedPnl >= 0 ? '+' : ''}${(h.unrealizedPnlPct ?? 0).toFixed(2)}%`
                            : '—'}
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                        {h.technicalAction && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SIGNAL_COLORS[h.technicalAction]}`}>
                                {h.technicalAction}
                            </span>
                        )}
                        <button onClick={() => onRemove(h.id)} className="text-gray-300 hover:text-red-500">
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function AllocationTab({
    enriched, summary, lang,
}: {
    enriched: EnrichedHolding[];
    summary: ReturnType<typeof summarizePortfolio>;
    lang: Lang;
}) {
    const valued = enriched.filter(h => typeof h.marketValue === 'number' && (h.marketValue || 0) > 0);

    if (valued.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400 text-sm">
                {lang === 'de'
                    ? 'Keine Live-Preise verfügbar. Verteilung erscheint, sobald Kursdaten geladen sind.'
                    : 'No live prices yet. Allocation appears once quotes load.'}
            </div>
        );
    }

    const total = summary.totalValue || 1;
    const positionData = valued
        .map(h => ({ name: h.symbol, value: h.marketValue || 0, pct: ((h.marketValue || 0) / total) * 100 }))
        .sort((a, b) => b.value - a.value);
    const sectorData = summary.sectorAllocation.map(s => ({ name: s.sector, value: s.value, pct: s.pct }));

    const renderTip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const p = payload[0].payload;
        return (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs shadow">
                <span className="font-bold">{p.name}</span> — {formatPrice(p.value, lang)} ({p.pct.toFixed(1)}%)
            </div>
        );
    };

    const Donut = ({ data, title }: { data: { name: string; value: number; pct: number }[]; title: string }) => (
        <div>
            <h4 className="text-xs font-bold uppercase text-gray-400 mb-2 text-center">{title}</h4>
            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                            {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                        </Pie>
                        <RTooltip content={renderTip} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-2">
                {data.slice(0, 8).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{d.name}</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{d.pct.toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Donut data={positionData} title={lang === 'de' ? 'Nach Position' : 'By Position'} />
            <Donut data={sectorData} title={lang === 'de' ? 'Nach Sektor' : 'By Sector'} />
        </div>
    );
}

function AddTab({ lang, onAdded }: { lang: Lang; onAdded: (input: { symbol: string; quantity: number; avgCost: number; notes?: string }) => Promise<void> }) {
    const [symbol, setSymbol] = useState('');
    const [quantity, setQuantity] = useState('');
    const [avgCost, setAvgCost] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async () => {
        setErr(null);
        const qty = parseFloat(quantity.replace(',', '.'));
        const cost = parseFloat(avgCost.replace(',', '.'));
        if (!symbol.trim()) return setErr('Symbol required');
        if (!Number.isFinite(qty) || qty <= 0) return setErr('Quantity must be > 0');
        if (!Number.isFinite(cost) || cost <= 0) return setErr('Avg cost must be > 0');
        setSubmitting(true);
        try {
            await onAdded({ symbol: symbol.trim().toUpperCase(), quantity: qty, avgCost: cost, notes: notes.trim() || undefined });
            setSymbol(''); setQuantity(''); setAvgCost(''); setNotes('');
        } catch (e: any) {
            setErr(e.message || 'Failed');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="max-w-md mx-auto space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {lang === 'de'
                    ? 'Wenn das Symbol schon existiert, wird der Einstandspreis gewichtet gemittelt.'
                    : 'If the symbol already exists, the avg cost is weighted-averaged across both lots.'}
            </p>
            <Field label={lang === 'de' ? 'Symbol' : 'Symbol'}>
                <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="AAPL" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
                <Field label={lang === 'de' ? 'Stück' : 'Quantity'}>
                    <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="10" inputMode="decimal" className={inputCls} />
                </Field>
                <Field label={lang === 'de' ? 'Einstandspreis' : 'Avg Cost'}>
                    <input value={avgCost} onChange={e => setAvgCost(e.target.value)} placeholder="190.50" inputMode="decimal" className={inputCls} />
                </Field>
            </div>
            <Field label={lang === 'de' ? 'Notiz (optional)' : 'Notes (optional)'}>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={lang === 'de' ? 'Trade Republic' : 'Trade Republic'} className={inputCls} />
            </Field>
            {err && <div className="text-xs text-red-500"><AlertTriangle size={12} className="inline" /> {err}</div>}
            <button
                onClick={submit}
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2"
            >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {lang === 'de' ? 'Position hinzufügen' : 'Add holding'}
            </button>
        </div>
    );
}

function ImportTab({ lang, onImport }: { lang: Lang; onImport: (csv: string) => Promise<{ imported: any[]; errors: { line: number; message: string }[] }> }) {
    const [csv, setCsv] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ imported: number; errors: { line: number; message: string }[] } | null>(null);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => setCsv(String(e.target?.result || ''));
        reader.readAsText(file);
    };

    const submit = async () => {
        if (!csv.trim()) return;
        setSubmitting(true);
        try {
            const r = await onImport(csv);
            setResult({ imported: r.imported.length, errors: r.errors });
            if (r.errors.length === 0) setCsv('');
        } catch (e: any) {
            setResult({ imported: 0, errors: [{ line: 0, message: e.message || 'Failed' }] });
        } finally { setSubmitting(false); }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>
                    {lang === 'de'
                        ? 'Format: Spaltenüberschriften symbol, quantity, avg_cost. Optional: currency, broker, notes.'
                        : 'Format: header row with symbol, quantity, avg_cost. Optional columns: currency, broker, notes.'}
                </p>
                <p>
                    {lang === 'de'
                        ? 'Zahlen werden sowohl im "1.234,56" als auch im "1234.56" Format akzeptiert.'
                        : 'Numbers accepted in both "1,234.56" and "1.234,56" formats.'}
                </p>
            </div>

            <div>
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-100">
                    <Upload size={14} /> {lang === 'de' ? 'CSV-Datei wählen' : 'Choose CSV file'}
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
            </div>

            <textarea
                value={csv}
                onChange={e => setCsv(e.target.value)}
                rows={8}
                placeholder={`symbol,quantity,avg_cost\nAAPL,10,190.50\nNVDA,5,560.25`}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-mono dark:text-gray-100"
            />

            {result && (
                <div className={`text-xs rounded-lg p-3 border ${
                    result.errors.length === 0
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-300'
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-300'
                }`}>
                    <strong>{result.imported} imported.</strong>
                    {result.errors.length > 0 && (
                        <ul className="mt-1 list-disc list-inside">
                            {result.errors.slice(0, 8).map((e, i) => (
                                <li key={i}>Line {e.line}: {e.message}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <button
                onClick={submit}
                disabled={submitting || !csv.trim()}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2"
            >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {lang === 'de' ? 'Importieren' : 'Import'}
            </button>
        </div>
    );
}

function CoachTab({ lang, snapshots, holdingsCount }: { lang: Lang; snapshots: Record<string, HoldingSnapshot>; holdingsCount: number }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<CoachResult | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const run = async () => {
        if (holdingsCount === 0) return;
        setLoading(true); setErr(null); setResult(null);
        try {
            const res = await fetch('/api/portfolio/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshots, lang }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setResult(data.coach as CoachResult);
        } catch (e: any) { setErr(e.message || 'Failed'); }
        finally { setLoading(false); }
    };

    if (holdingsCount === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                {lang === 'de' ? 'Füge Positionen hinzu, bevor du den KI-Coach startest.' : 'Add holdings before running the AI coach.'}
            </div>
        );
    }

    const scoreColor = (s: number) =>
        s >= 7 ? 'text-green-500' : s >= 4 ? 'text-amber-400' : 'text-red-500';

    return (
        <div className="space-y-4">
            {!result && !loading && (
                <div className="text-center py-8">
                    <Brain size={40} className="mx-auto mb-3 text-indigo-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
                        {lang === 'de'
                            ? 'Die KI analysiert dein gesamtes Portfolio auf Konzentrations-, Sektor- und Korrelationsrisiken und schlägt konkrete Aktionen vor.'
                            : 'Claude analyzes your entire portfolio for concentration, sector and correlation risks and recommends concrete actions.'}
                    </p>
                    <button
                        onClick={run}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl inline-flex items-center gap-2"
                    >
                        <Sparkles size={14} /> {lang === 'de' ? 'KI-Analyse starten' : 'Run AI analysis'}
                    </button>
                </div>
            )}

            {loading && (
                <div className="text-center py-12">
                    <Loader2 size={28} className="animate-spin mx-auto text-indigo-400 mb-3" />
                    <p className="text-sm text-gray-500">{lang === 'de' ? 'Analysiere Portfolio…' : 'Analyzing portfolio…'}</p>
                </div>
            )}

            {err && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                    <AlertTriangle size={14} className="inline mr-1" /> {err}
                </div>
            )}

            {result && (
                <div className="space-y-3 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/30">
                    <div className="flex items-end gap-3">
                        <span className={`text-5xl font-black ${scoreColor(result.overallScore)}`}>
                            {result.overallScore}<span className="text-xl text-gray-400">/10</span>
                        </span>
                        <div className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 pb-1">
                            {result.headline}
                        </div>
                        <button onClick={run} className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
                            ↻ {lang === 'de' ? 'Erneut' : 'Re-run'}
                        </button>
                    </div>

                    {result.strengths && (
                        <Section icon={<TrendingUp size={12} />} title={lang === 'de' ? 'Stärken' : 'Strengths'} color="green">
                            {result.strengths}
                        </Section>
                    )}
                    {result.risks && (
                        <Section icon={<AlertTriangle size={12} />} title={lang === 'de' ? 'Risiken' : 'Risks'} color="red">
                            {result.risks}
                        </Section>
                    )}
                    {result.actions && (
                        <Section icon={<Sparkles size={12} />} title={lang === 'de' ? 'Aktionen' : 'Actions'} color="indigo">
                            {result.actions}
                        </Section>
                    )}
                    {result.hedgeSuggestion && (
                        <Section icon={<Shield size={12} />} title={lang === 'de' ? 'Hedge-Idee' : 'Hedge Suggestion'} color="blue">
                            {result.hedgeSuggestion}
                        </Section>
                    )}
                    {result.rebalancing && (
                        <Section icon={<TrendingDown size={12} />} title={lang === 'de' ? 'Rebalancing' : 'Rebalancing'} color="amber">
                            {result.rebalancing}
                        </Section>
                    )}
                    {result.sectorComment && (
                        <Section icon={<Briefcase size={12} />} title={lang === 'de' ? 'Sektor-Kommentar' : 'Sector Comment'} color="purple">
                            {result.sectorComment}
                        </Section>
                    )}
                </div>
            )}
        </div>
    );
}

const COLOR_MAP: Record<string, string> = {
    green:  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-300',
    red:    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-300',
    blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30 text-blue-700 dark:text-blue-300',
    amber:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/30 text-purple-700 dark:text-purple-300',
};

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: keyof typeof COLOR_MAP; children: string }) {
    return (
        <div className={`rounded-lg p-3 border ${COLOR_MAP[color]}`}>
            <div className="text-[10px] font-bold uppercase mb-1 flex items-center gap-1">{icon} {title}</div>
            <div className="text-xs leading-relaxed whitespace-pre-line">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">{label}</label>
            {children}
        </div>
    );
}

const inputCls = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50';
