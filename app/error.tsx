'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.error('Global error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 text-center">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
                    Oops, something went wrong
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    {error?.message || 'An unexpected client-side error occurred.'}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
                    >
                        <RefreshCw size={14} /> Try again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                        Reload page
                    </button>
                </div>
            </div>
        </div>
    );
}
