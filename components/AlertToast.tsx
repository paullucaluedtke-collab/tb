'use client';

import { useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AlertEvent } from '@/hooks/useAlerts';

interface AlertToastProps {
    alerts: AlertEvent[];
    onDismiss: (id: string) => void;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    LONG: { bg: 'bg-green-500', text: 'text-white', icon: <TrendingUp size={14} /> },
    SHORT: { bg: 'bg-red-500', text: 'text-white', icon: <TrendingDown size={14} /> },
    WAIT: { bg: 'bg-gray-400', text: 'text-white', icon: <Minus size={14} /> },
};

function Toast({ alert, onDismiss }: { alert: AlertEvent; onDismiss: () => void }) {
    // Auto-dismiss after 8s
    useEffect(() => {
        const t = setTimeout(onDismiss, 8000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    const toStyle = ACTION_STYLES[alert.to] ?? ACTION_STYLES.WAIT;

    return (
        <div className="flex items-start gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl p-4 w-80 pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300">
            {/* Color strip */}
            <div className={`mt-0.5 p-1.5 rounded-lg ${toStyle.bg} ${toStyle.text} flex-shrink-0`}>
                {toStyle.icon}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-black text-gray-900 dark:text-gray-100 text-sm">{alert.symbol}</span>
                    <span className="text-xs text-gray-400">Signal changed</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-gray-500">{alert.from}</span>
                    <span className="text-gray-400">→</span>
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded ${toStyle.bg} ${toStyle.text}`}>
                        {alert.to}
                    </span>
                    <span className="text-[10px] text-gray-400">{alert.confidence}</span>
                </div>
                {alert.reason && (
                    <p className="text-[11px] text-gray-400 mt-1 truncate">{alert.reason}</p>
                )}
            </div>

            <button
                onClick={onDismiss}
                className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 flex-shrink-0 mt-0.5"
            >
                <X size={14} />
            </button>
        </div>
    );
}

export default function AlertToastContainer({ alerts, onDismiss }: AlertToastProps) {
    if (alerts.length === 0) return null;
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            {alerts.map(a => (
                <Toast key={a.id} alert={a} onDismiss={() => onDismiss(a.id)} />
            ))}
        </div>
    );
}
