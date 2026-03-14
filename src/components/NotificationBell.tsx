"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface NotificationBellProps {
    variant?: "dashboard" | "admin";
    onOpen?: () => void;
}

interface Notification {
    id: string;
    type: string;
    title: string;
    icon: string;
    time: string;
    read: boolean;
}

const DRAWER_ANIMATION_MS = 260;

export default function NotificationBell({
    variant = "dashboard",
    onOpen,
}: NotificationBellProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isDrawerMounted, setIsDrawerMounted] = useState(false);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const closeTimerRef = useRef<number | null>(null);
    const mobileOffsetClass = variant === "admin" ? "top-[60px]" : "top-[56px]";
    const desktopOffsetClass = variant === "admin" ? "lg:top-[80px]" : "lg:top-[74px]";
    const isOpen = isDrawerMounted && isDrawerVisible;

    const clearCloseTimer = () => {
        if (typeof window === "undefined" || closeTimerRef.current === null) return;
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    };

    const closeDrawer = useEffectEvent(() => {
        if (typeof window === "undefined") {
            setIsDrawerVisible(false);
            setIsDrawerMounted(false);
            return;
        }

        clearCloseTimer();
        setIsDrawerVisible(false);
        closeTimerRef.current = window.setTimeout(() => {
            setIsDrawerMounted(false);
            closeTimerRef.current = null;
        }, DRAWER_ANIMATION_MS);
    });

    const openDrawer = () => {
        clearCloseTimer();
        setIsDrawerMounted(true);

        if (typeof window === "undefined") {
            setIsDrawerVisible(true);
            return;
        }

        window.requestAnimationFrame(() => {
            setIsDrawerVisible(true);
        });
    };

    useEffect(() => {
        if (!isDrawerMounted) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeDrawer();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isDrawerMounted]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleCloseNotifications = () => {
            closeDrawer();
        };

        window.addEventListener("workersunited:close-notifications", handleCloseNotifications);
        return () => window.removeEventListener("workersunited:close-notifications", handleCloseNotifications);
    }, []);

    useEffect(() => {
        return () => {
            clearCloseTimer();
        };
    }, []);

    // Load unread count on mount
    useEffect(() => {
        fetch("/api/notifications")
            .then((res) => res.json())
            .then((data) => {
                if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount);
            })
            .catch(() => { });
    }, []);

    const loadNotifications = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        if (!isOpen) {
            onOpen?.();
            loadNotifications();
            openDrawer();
            return;
        }

        closeDrawer();
    };

    const markAsRead = async (id: string) => {
        try {
            await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
            // silently fail
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markAll: true }),
            });
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch {
            // silently fail
        }
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
        <>
            {/* Bell Button */}
            <button
                type="button"
                onClick={handleToggle}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f2f5] text-[#050505] transition-colors hover:bg-[#e4e6eb]"
                title="Notifications"
                aria-label={isOpen ? "Close notifications" : "Open notifications"}
                aria-expanded={isOpen}
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {isDrawerMounted && typeof document !== "undefined"
                ? createPortal(
                    <>
                        <button
                            type="button"
                            className={`fixed inset-x-0 bottom-0 ${mobileOffsetClass} ${desktopOffsetClass} z-[54] bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ease-out ${isDrawerVisible ? "opacity-100" : "opacity-0"}`}
                            onClick={() => closeDrawer()}
                            aria-label="Close notifications panel"
                        />
                        <aside className={`fixed right-0 bottom-0 ${mobileOffsetClass} ${desktopOffsetClass} z-[55] w-[calc(100vw-0.75rem)] max-w-[390px] transform transition-[transform,opacity] duration-300 ease-out ${isDrawerVisible ? "translate-x-0 opacity-100" : "translate-x-[112%] opacity-0"}`}>
                            <div className="flex h-full max-h-full flex-col overflow-hidden border-l border-gray-200 bg-white shadow-[-24px_0_70px_-42px_rgba(15,23,42,0.35)] lg:rounded-[14px] lg:border lg:border-white/60 lg:bg-white/95 lg:shadow-sm lg:backdrop-blur-sm">
                                <div className="border-b border-[#dddfe2] px-4 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">
                                                Notifications
                                            </div>
                                            <h3 className="mt-2 text-xl font-bold text-[#050505]">Updates</h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-[#65676b]">
                                                {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
                                            </span>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={markAllAsRead}
                                                    className="text-xs font-medium text-[#1877f2] hover:underline"
                                                >
                                                    Mark all read
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-[#fafafa]">
                                    {loading ? (
                                        <div className="p-8 text-center text-sm text-[#65676b]">Loading...</div>
                                    ) : notifications.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <span className="text-3xl">🔔</span>
                                            <p className="mt-2 text-sm text-[#65676b]">No notifications yet</p>
                                        </div>
                                    ) : (
                                        notifications.map((n) => (
                                            <div
                                                key={n.id}
                                                onClick={() => !n.read && markAsRead(n.id)}
                                                className={`flex cursor-pointer items-start gap-3 border-b border-[#f0f2f5] px-4 py-3 transition-colors last:border-0 ${n.read
                                                        ? "bg-white hover:bg-[#f7f8fa]"
                                                        : "bg-[#e7f3ff] hover:bg-[#dbeafe]"
                                                    }`}
                                            >
                                                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg ${n.read ? "bg-[#f0f2f5]" : "bg-[#1877f2]/10"
                                                    }`}>
                                                    {n.icon}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-sm leading-snug ${n.read
                                                            ? "font-normal text-[#65676b]"
                                                            : "font-medium text-[#050505]"
                                                        }`}>
                                                        {n.title}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-[#65676b]">
                                                        {formatTime(n.time)}
                                                    </p>
                                                </div>
                                                {!n.read && (
                                                    <div className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#1877f2]" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </aside>
                    </>,
                    document.body
                )
                : null}
        </>
    );
}
