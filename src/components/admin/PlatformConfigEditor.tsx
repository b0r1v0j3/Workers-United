"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, RefreshCw, Database } from "lucide-react";

interface ConfigItem {
    key: string;
    value: string;
    description: string | null;
    updated_at: string;
}

export default function PlatformConfigEditor() {
    const [config, setConfig] = useState<ConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Record<string, string>>({});

    async function fetchConfig() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/platform-config");
            if (!res.ok) throw new Error("Failed to load config");
            const data = await res.json();
            setConfig(data.config || []);
            const values: Record<string, string> = {};
            for (const item of data.config || []) {
                values[item.key] = item.value;
            }
            setEditValues(values);
        } catch {
            toast.error("Failed to load platform config");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchConfig(); }, []);

    async function saveValue(key: string) {
        const newValue = editValues[key];
        const original = config.find(c => c.key === key);
        if (original && original.value === newValue) {
            toast.info("No changes to save");
            return;
        }

        setSaving(key);
        try {
            const res = await fetch("/api/admin/platform-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value: newValue }),
            });
            if (!res.ok) throw new Error("Failed to save");
            toast.success(`Updated "${key}"`);
            // Refresh the list
            await fetchConfig();
        } catch {
            toast.error(`Failed to save "${key}"`);
        } finally {
            setSaving(null);
        }
    }

    // Group config by category
    const categories: Record<string, { label: string; emoji: string; keys: string[] }> = {
        pricing: {
            label: "Pricing & Fees",
            emoji: "💰",
            keys: ["entry_fee", "entry_fee_currency", "placement_fee_serbia", "employer_fee"],
        },
        refund: {
            label: "Refund Policy",
            emoji: "🛡️",
            keys: ["refund_period_days", "refund_policy_en", "refund_policy_sr"],
        },
        bot: {
            label: "Bot Messages",
            emoji: "🤖",
            keys: ["bot_greeting_en", "bot_greeting_sr"],
        },
        platform: {
            label: "Platform Info",
            emoji: "🌍",
            keys: ["platform_name", "website_url", "contact_email", "supported_documents", "processing_time"],
        },
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Database className="text-blue-500" size={20} />
                    <h2 className="text-lg font-bold text-slate-900">Platform Config</h2>
                </div>
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-12 bg-slate-100 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                        <Database className="text-blue-500" size={20} />
                        <h2 className="text-lg font-bold text-slate-900">Platform Config</h2>
                    </div>
                    <button
                        onClick={fetchConfig}
                        className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    Business facts used by WhatsApp bot, Brain Monitor, and n8n AI. Change here → all systems update automatically.
                </p>
            </div>

            {Object.entries(categories).map(([catKey, cat]) => {
                const items = config.filter(c => cat.keys.includes(c.key));
                if (items.length === 0) return null;

                return (
                    <div key={catKey} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span>{cat.emoji}</span> {cat.label}
                        </h3>
                        <div className="space-y-4">
                            {items.map(item => (
                                <div key={item.key} className="group">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <label className="text-sm font-semibold text-slate-700 block mb-1">
                                                {item.description || item.key}
                                            </label>
                                            <code className="text-[11px] text-slate-400 font-mono">{item.key}</code>
                                            {item.value.length > 60 ? (
                                                <textarea
                                                    value={editValues[item.key] || ""}
                                                    onChange={e => setEditValues(prev => ({ ...prev, [item.key]: e.target.value }))}
                                                    className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 resize-y min-h-[60px]"
                                                    rows={2}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={editValues[item.key] || ""}
                                                    onChange={e => setEditValues(prev => ({ ...prev, [item.key]: e.target.value }))}
                                                    className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                                                />
                                            )}
                                        </div>
                                        <button
                                            onClick={() => saveValue(item.key)}
                                            disabled={saving === item.key || editValues[item.key] === item.value}
                                            className="mt-8 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                                        >
                                            {saving === item.key ? (
                                                <RefreshCw size={14} className="animate-spin" />
                                            ) : (
                                                <Save size={14} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Uncategorized items */}
            {config.filter(c => !Object.values(categories).some(cat => cat.keys.includes(c.key))).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-900 mb-4">⚙️ Other</h3>
                    <div className="space-y-4">
                        {config
                            .filter(c => !Object.values(categories).some(cat => cat.keys.includes(c.key)))
                            .map(item => (
                                <div key={item.key} className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="text-sm font-semibold text-slate-700">{item.key}</label>
                                        <input
                                            type="text"
                                            value={editValues[item.key] || ""}
                                            onChange={e => setEditValues(prev => ({ ...prev, [item.key]: e.target.value }))}
                                            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => saveValue(item.key)}
                                        disabled={saving === item.key}
                                        className="mt-6 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 disabled:opacity-30"
                                    >
                                        <Save size={14} />
                                    </button>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
