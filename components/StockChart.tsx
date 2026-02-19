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
} from 'recharts';
import { StockDataPoint } from '@/lib/technical-analysis';
import { format } from 'date-fns';

interface StockChartProps {
    data: StockDataPoint[];
}

const StockChart = ({ data }: StockChartProps) => {
    // We need to slice data to not show too much history by default, or just show last 100 days
    const recentData = data.slice(-100);

    return (
        <div className="space-y-8">
            {/* Price and SMA Chart */}
            <div className="h-96 w-full p-4 bg-white rounded-lg shadow">
                <h3 className="text-lg font-bold mb-4">Price & SMA</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={recentData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                            minTickGap={30}
                        />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip
                            labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="close" stroke="#000000" dot={false} strokeWidth={2} name="Price" />
                        <Line type="monotone" dataKey="sma20" stroke="#ef4444" dot={false} strokeWidth={1} name="SMA 20" />
                        <Line type="monotone" dataKey="sma50" stroke="#3b82f6" dot={false} strokeWidth={1} name="SMA 50" />
                        <Line type="monotone" dataKey="sma200" stroke="#22c55e" dot={false} strokeWidth={1} name="SMA 200" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* RSI Chart */}
            <div className="h-48 w-full p-4 bg-white rounded-lg shadow">
                <h3 className="text-lg font-bold mb-4">RSI (14)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={recentData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                            minTickGap={30}
                        />
                        <YAxis domain={[0, 100]} ticks={[0, 30, 70, 100]} />
                        <Tooltip labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')} />
                        {/* RSI Overbought/Oversold zones */}
                        <Line type="monotone" dataKey="rsi14" stroke="#8884d8" dot={false} strokeWidth={2} name="RSI" />
                        {/* Reference lines (30 and 70) usually added but simple lines work too */}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* MACD Chart */}
            <div className="h-64 w-full p-4 bg-white rounded-lg shadow">
                <h3 className="text-lg font-bold mb-4">MACD</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={recentData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                            minTickGap={30}
                        />
                        <YAxis />
                        <Tooltip labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')} />
                        <Legend />
                        <Line type="monotone" dataKey="macd.MACD" stroke="#3b82f6" dot={false} name="MACD" />
                        <Line type="monotone" dataKey="macd.signal" stroke="#ef4444" dot={false} name="Signal" />
                        <Bar dataKey="macd.histogram" fill="#82ca9d" name="Histogram" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default StockChart;
