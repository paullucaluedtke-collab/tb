'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log for debugging (visible in browser console)
        // eslint-disable-next-line no-console
        console.error('ErrorBoundary caught:', error, info);
    }

    reset = () => this.setState({ hasError: false, error: undefined });

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="min-h-[200px] flex flex-col items-center justify-center p-8 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-center">
                    <AlertTriangle size={32} className="text-red-500 mb-3" />
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-300 mb-1">
                        Something went wrong
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-4 max-w-md">
                        {this.state.error?.message || 'A client-side error occurred. Please try again.'}
                    </p>
                    <button
                        onClick={this.reset}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition"
                    >
                        <RefreshCw size={14} /> Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
