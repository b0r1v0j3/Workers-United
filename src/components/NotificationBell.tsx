"use client";

import { useState, useEffect, useRef } from "react";

interface Notification {
    id: string;
    type: string;
    title: string;
    icon: string;
    time: string;
    read: boolean;
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const loadNotifications = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        if (!isOpen) loadNotifications();
        setIsOpen(!isOpen);
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);

        if (diffMin < 1) return "Just now";
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    };

    return (
        <div ref={dropdownRef} className="relative">
            {/* Bell Button */}
            <button
                onClick={handleToggle}
                className="w-9 h-9 bg-[#f0f2f5] rounded-full flex items-center justify-center text-[#050505] hover:bg-[#e4e6eb] transition-colors relative"
                title="Notifications"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
                </svg>
                {notifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {notifications.length > 9 ? "9+" : notifications.length}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-12 w-[360px] bg-white rounded-xl shadow-xl border border-[#dddfe2] z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-[#dddfe2] flex items-center justify-between">
                        <h3 className="font-bold text-[#050505] text-lg">Notifications</h3>
                        <span className="text-xs text-[#65676b]">{notifications.length} recent</span>
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-[#65676b] text-sm">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <span className="text-3xl">🔔</span>
                                <p className="text-[#65676b] text-sm mt-2">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className="flex items-start gap-3 px-4 py-3 hover:bg-[#f0f2f5] transition-colors cursor-pointer border-b border-[#f0f2f5] last:border-0"
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#e7f3ff] flex items-center justify-center text-lg flex-shrink-0">
                                        {n.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[#050505] font-medium leading-snug">
                                            {n.title}
                                        </p>
                                        <p className="text-xs text-[#65676b] mt-0.5">
                                            {formatTime(n.time)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
