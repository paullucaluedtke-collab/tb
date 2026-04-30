'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Area,
    ReferenceLine,
} from 'recharts';
import { StockDataPoint } from '@/lib/technical-analysis';
import { format } from 'date-fns';

interface StockChartProps {
    data: StockDataPoint[];
    mode?: 'swing' | 'scalp' | 'long_term';
}

const StockChart = ({ data, mode = 'swing' }: StockChartProps) => {
    // Defensive: never crash on missing/malformed data
    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="h-72 md:h-96 w-full flex items-center justify-center text-gray-400 text-sm">
                No chart data available.
            </div>
        );
    }

    const recentData = data.slice(-100);

    const chartData = recentData.map(d => ({
        ...d,
        bbUpper: d.bb?.upper,
        bbLower: d.bb?.lower,
        bbMiddle: d.bb?.middle,
        macdMACD: d.macd?.MACD,
        macdSignal: d.macd?.signal,
        macdHistogram: d.macd?.histogram,
        stochK: d.stochRsi?.k !== undefined ? d.stochRsi.k * 100 : undefined,
        stochD: d.stochRsi?.d !== undefined ? d.stochRsi.d * 100 : undefined,
    }));

    const volumeData = chartData.map(d => ({
        ...d,
        volumeColor: d.close >= d.open ? '#22c55e' : '#ef4444',
    }));

    return (
        <div className="space-y-4 md:space-y-8">
            {/* Price, SMA & Bollinger Bands Chart */}
            <div className="w-full p-0 sm:p-2 md:p-4 bg-white dark:bg-gray-800 rounded-lg">
                <h3 className="text-base md:text-lg font-bold mb-2 md:mb-4 px-2 sm:px-0 dark:text-gray-100">
                    {mode === 'scalp' ? 'Price & EMA 9/21' : 'Price, SMA & Bollinger Bands'}
                </h3>
                <div className="h-72 md:h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} minTickGap={30} />
                        <YAxis domain={['auto', 'auto']} tickFormatter={(v) => String(v)} />
                        <Tooltip
                            labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                            formatter={(value: any, name: any) => {
                                if (typeof value === 'number') return [value.toFixed(2), name];
                                return [value, name];
                            }}
                        />
                        <Legend />
                        {mode !== 'scalp' && (
                            <>
                                <Area type="monotone" dataKey="bbUpper" stroke="#9333ea" strokeWidth={1} strokeDasharray="4 4" fill="transparent" name="BB Upper" dot={false} />
                                <Area type="monotone" dataKey="bbLower" stroke="#9333ea" strokeWidth={1} strokeDasharray="4 4" fill="#9333ea" fillOpacity={0.05} name="BB Lower" dot={false} />
                            </>
                        )}
                        <Line type="monotone" dataKey="close" stroke="#6366f1" dot={false} strokeWidth={2} name="Price" />
                        {mode === 'scalp' ? (
                            <>
                                <Line type="monotone" dataKey="ema9" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="EMA 9" />
                                <Line type="monotone" dataKey="ema21" stroke="#8b5cf6" dot={false} strokeWidth={1.5} name="EMA 21" />
                                <Line type="monotone" dataKey="ema50" stroke="#3b82f6" dot={false} strokeWidth={1} name="EMA 50" />
                            </>
                        ) : (
                            <>
                                <Line type="monotone" dataKey="sma20" stroke="#ef4444" dot={false} strokeWidth={1} name="SMA 20" />
                                <Line type="monotone" dataKey="sma50" stroke="#3b82f6" dot={false} strokeWidth={1} name="SMA 50" />
                                <Line type="monotone" dataKey="sma200" stroke="#22c55e" dot={false} strokeWidth={1} name="SMA 200" />
                            </>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
                </div>
            </div>

            {/* Volume Chart */}
            <div className="w-full p-0 sm:p-2 md:p-4 bg-white dark:bg-gray-800 rounded-lg">
                <h3 className="text-base md:text-lg font-bold mb-2 md:mb-4 px-2 sm:px-0 dark:text-gray-100">Volume</h3>
                <div className="h-32 md:h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={volumeData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} minTickGap={30} />
                        <YAxis tickFormatter={(v) => {
                            if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                            if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                            if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
                            return String(v);
                        }} />
                        <Tooltip
                            labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                            formatter={(value: any) => {
                                if (typeof value === 'number') return [value.toLocaleString(), 'Volume'];
                                return [value, 'Volume'];
                            }}
                        />
                        <Bar dataKey="volume" fill="#6366f1" opacity={0.6} name="Volume" />
                        <Line type="monotone" dataKey="volumeSma20" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="Vol SMA 20" />
                    </ComposedChart>
                </ResponsiveContainer>
                </div>
            </div>

            {/* RSI Chart */}
            <div className="w-full p-0 sm:p-2 md:p-4 bg-white dark:bg-gray-800 rounded-lg">
                <h3 className="text-base md:text-lg font-bold mb-2 md:mb-4 px-2 sm:px-0 dark:text-gray-100">RSI (14)</h3>
                <div className="h-40 md:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} minTickGap={30} />
                        <YAxis domain={[0, 100]} ticks={[0, 30, 70, 100]} tickFormatter={(v) => String(v)} />
                        <Tooltip labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')} />
                        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Overbought", position: "right", fill: "#ef4444", fontSize: 10 }} />
                        <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Oversold", position: "right", fill: "#22c55e", fontSize: 10 }} />
                        <Line type="monotone" dataKey="rsi14" stroke="#8884d8" dot={false} strokeWidth={2} name="RSI" />
                    </LineChart>
                </ResponsiveContainer>
                </div>
            </div>

            {/* Stochastic RSI Chart */}
            <div className="w-full p-0 sm:p-2 md:p-4 bg-white dark:bg-gray-800 rounded-lg">
                <h3 className="text-base md:text-lg font-bold mb-2 md:mb-4 px-2 sm:px-0 dark:text-gray-100">Stochastic RSI</h3>
                <div className="h-40 md:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} minTickGap={30} />
                        <YAxis domain={[0, 100]} ticks={[0, 20, 80, 100]} tickFormatter={(v) => String(v)} />
                        <Tooltip labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')} />
                        <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Overbought", position: "right", fill: "#ef4444", fontSize: 10 }} />
                        <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Oversold", position: "right", fill: "#22c55e", fontSize: 10 }} />
                        <Line type="monotone" dataKey="stochK" stroke="#3b82f6" dot={false} strokeWidth={2} name="%K" />
                        <Line type="monotone" dataKey="stochD" stroke="#ef4444" dot={false} strokeWidth={1.5} name="%D" />
                    </LineChart>
                </ResponsiveContainer>
                </div>
            </div>

            {/* MACD Chart */}
            <div className="w-full p-0 sm:p-2 md:p-4 bg-white dark:bg-gray-800 rounded-lg">
                <h3 className="text-base md:text-lg font-bold mb-2 md:mb-4 px-2 sm:px-0 dark:text-gray-100">MACD</h3>
                <div className="h-48 md:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} minTickGap={30} />
                        <YAxis tickFormatter={(v) => String(v)} />
                        <Tooltip labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')} />
                        <Legend />
                        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                        <Bar dataKey="macdHistogram" name="Histogram" fill="#82ca9d" />
                        <Line type="monotone" dataKey="macdMACD" stroke="#3b82f6" dot={false} name="MACD" />
                        <Line type="monotone" dataKey="macdSignal" stroke="#ef4444" dot={false} name="Signal" />
                    </ComposedChart>
                </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default StockChart;
