"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

interface TimeSeriesData {
    date: string;
    workers: number;
    employers: number;
    revenue: number;
}

interface AnalyticsChartsProps {
    data: TimeSeriesData[];
}

export function RegistrationsChart({ data }: AnalyticsChartsProps) {
    const formattedData = useMemo(() => {
        return data.map(d => ({
            ...d,
            displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        })).reverse(); // Recharts renders left-to-right, so early dates first
    }, [data]);

    return (
        <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={formattedData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorWorkers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1877f2" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#1877f2" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorEmployers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                    <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#65676b', fontSize: 12 }}
                        dy={10}
                        minTickGap={30}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#65676b', fontSize: 12 }}
                        dx={-10}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #dddfe2', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 500 }}
                        itemStyle={{ fontSize: 14, fontWeight: 600 }}
                        labelStyle={{ color: '#65676b', marginBottom: 4 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: 20 }} />
                    <Area
                        type="monotone"
                        dataKey="workers"
                        name="Workers"
                        stroke="#1877f2"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorWorkers)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="employers"
                        name="Employers"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorEmployers)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function RevenueChart({ data }: AnalyticsChartsProps) {
    const formattedData = useMemo(() => {
        return data.map(d => ({
            ...d,
            displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        })).reverse();
    }, [data]);

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={formattedData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
                    <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#65676b', fontSize: 12 }}
                        dy={10}
                        minTickGap={30}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#65676b', fontSize: 12 }}
                        dx={-10}
                        tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                        cursor={{ fill: '#f0f2f5' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #dddfe2', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        itemStyle={{ fontSize: 14, fontWeight: 600 }}
                        formatter={(value: number) => [`$${value}`, 'Revenue']}
                    />
                    <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
