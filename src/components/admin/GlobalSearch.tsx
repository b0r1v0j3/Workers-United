"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, User, Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SearchResult {
    id: string;
    type: "Worker" | "Employer";
    title: string;
    subtitle: string;
    link: string;
}

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close dropdown on navigation
    useEffect(() => {
        setIsOpen(false);
        setQuery("");
    }, [pathname]);

    // Keyboard shortcut (Ctrl+K or Cmd+K)
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            } else if (e.key === "Escape") {
                setIsOpen(false);
                inputRef.current?.blur();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Perform search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query || query.length < 2) {
                setResults([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.success) {
                    setResults(data.results);
                }
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setIsLoading(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div ref={wrapperRef} className="relative w-full flex-1 max-w-md mx-4">
            <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400">
                    <Search size={16} />
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(query.length > 0)}
                    placeholder="Search users, emails, passports... (Ctrl+K)"
                    className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-10 text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all shadow-inner outline-none"
                    autoComplete="off"
                />

                {query ? (
                    <button
                        onClick={() => {
                            setQuery("");
                            setIsOpen(false);
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <div className="absolute right-3 hidden lg:flex items-center gap-1">
                        <kbd className="font-mono text-[9px] font-bold text-slate-400 bg-white border border-slate-200 px-1 rounded">Ctrl K</kbd>
                    </div>
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden z-50 animate-fade-in-up">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <span>Search Results</span>
                        {isLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-1">
                        {!isLoading && results.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs">
                                No results found for &quot;{query}&quot;
                            </div>
                        ) : (
                            <ul className="space-y-0.5">
                                {results.map((result, idx) => (
                                    <li key={`${result.id}-${idx}`}>
                                        <Link
                                            href={result.link}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm shrink-0 ${result.type === 'Employer' ? 'bg-violet-500' : 'bg-blue-500'}`}>
                                                {result.type === "Employer" ? <Building2 size={14} /> : <User size={14} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                                                    {result.title}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${result.type === 'Employer' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {result.type}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500 truncate">
                                                        {result.subtitle}
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
