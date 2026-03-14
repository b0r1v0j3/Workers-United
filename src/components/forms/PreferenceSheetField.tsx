"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

export const ALL_OPTION_VALUE = "Any";

export interface PreferenceSheetOption {
    value: string;
    label: string;
    description?: string;
}

type PanelTone = "neutral" | "stone";

interface BaseSheetFieldProps {
    buttonClassName: string;
    disabled?: boolean;
    panelTone?: PanelTone;
    sheetDescription?: string;
    sheetTitle: string;
    triggerLabel: string;
}

interface SingleChoiceSheetFieldProps extends BaseSheetFieldProps {
    onChange: (value: string) => void;
    options: PreferenceSheetOption[];
    value: string;
}

interface MultiChoiceSheetFieldProps extends BaseSheetFieldProps {
    allLabel: string;
    onChange: (values: string[]) => void;
    options: PreferenceSheetOption[];
    values: string[];
}

function normalizeTextValue(value: string | null | undefined) {
    if (typeof value !== "string") {
        return "";
    }

    const trimmed = value.trim();
    return trimmed === "All" ? ALL_OPTION_VALUE : trimmed;
}

export function normalizePreferredJobValue(value: string | null | undefined, fallbackToAll = false) {
    const normalized = normalizeTextValue(value);
    if (!normalized) {
        return fallbackToAll ? ALL_OPTION_VALUE : "";
    }

    return normalized;
}

export function normalizeDesiredCountryValues(values: string[] | null | undefined) {
    if (!Array.isArray(values)) {
        return [];
    }

    const normalized = values
        .map((value) => normalizeTextValue(value))
        .filter(Boolean);

    if (normalized.includes(ALL_OPTION_VALUE)) {
        return [ALL_OPTION_VALUE];
    }

    return Array.from(new Set(normalized));
}

export function getPreferredJobLabel(value: string | null | undefined) {
    const normalized = normalizePreferredJobValue(value, true);
    return normalized === ALL_OPTION_VALUE ? "All industries" : normalized;
}

export function getDesiredCountriesLabel(values: string[] | null | undefined) {
    const normalized = normalizeDesiredCountryValues(values);
    if (normalized.includes(ALL_OPTION_VALUE)) {
        return "All destinations";
    }
    if (normalized.length === 0) {
        return "Select destinations";
    }
    if (normalized.length <= 2) {
        return normalized.join(", ");
    }

    return `${normalized.length} destinations selected`;
}

function SelectionSheet({
    children,
    description,
    onClose,
    open,
    title,
    tone = "neutral",
}: {
    children: ReactNode;
    description?: string;
    onClose: () => void;
    open: boolean;
    title: string;
    tone?: PanelTone;
}) {
    useEffect(() => {
        if (!open || typeof document === "undefined") {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleEscape);
        };
    }, [onClose, open]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    const panelBorderClass = tone === "stone" ? "border-[#e7e0d4]" : "border-[#e5e7eb]";
    const headerAccentClass = tone === "stone" ? "text-[#6b6357]" : "text-[#6b7280]";

    return createPortal(
        <div
            className="fixed inset-0 z-[180] flex items-end bg-[rgba(15,23,42,0.16)] backdrop-blur-[2px] sm:items-center sm:justify-center sm:px-4 sm:py-6"
            onClick={onClose}
        >
            <div
                className={`w-full max-h-[85vh] overflow-hidden rounded-t-[28px] border bg-white shadow-[0_32px_100px_-48px_rgba(15,23,42,0.45)] sm:max-w-xl sm:rounded-[28px] ${panelBorderClass}`}
                onClick={(event) => event.stopPropagation()}
            >
                <div className={`flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5 ${panelBorderClass}`}>
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold tracking-tight text-[#111827]">{title}</h3>
                        {description ? <p className={`mt-1 text-sm leading-relaxed ${headerAccentClass}`}>{description}</p> : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#111827] transition hover:bg-[#fafafa]"
                        aria-label={`Close ${title}`}
                    >
                        <X size={18} />
                    </button>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}

export function SingleChoiceSheetField({
    buttonClassName,
    disabled = false,
    onChange,
    options,
    panelTone = "neutral",
    sheetDescription,
    sheetTitle,
    triggerLabel,
    value,
}: SingleChoiceSheetFieldProps) {
    const [open, setOpen] = useState(false);

    const optionBaseClass = panelTone === "stone"
        ? "border-[#e7e0d4] bg-[#faf8f3] text-[#18181b] hover:bg-white"
        : "border-[#e5e7eb] bg-[#fafafa] text-[#111827] hover:bg-white";
    const optionActiveClass = panelTone === "stone"
        ? "border-[#d8cfbf] bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.3)]"
        : "border-[#111111] bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.26)]";

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className={`${buttonClassName} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <span className="min-w-0 flex-1 text-left leading-snug">{triggerLabel}</span>
                <ChevronDown size={18} className="shrink-0 text-[#9ca3af]" />
            </button>

            <SelectionSheet
                open={open}
                onClose={() => setOpen(false)}
                title={sheetTitle}
                description={sheetDescription}
                tone={panelTone}
            >
                <div className="max-h-[58vh] space-y-3 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
                    {options.map((option) => {
                        const active = value === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${optionBaseClass} ${active ? optionActiveClass : ""}`}
                            >
                                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#111111] bg-[#111111] text-white" : "border-[#d1d5db] bg-white text-transparent"}`}>
                                    <Check size={12} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{option.label}</span>
                                    {option.description ? <span className="mt-1 block text-xs leading-relaxed text-[#6b7280]">{option.description}</span> : null}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </SelectionSheet>
        </>
    );
}

export function MultiChoiceSheetField({
    allLabel,
    buttonClassName,
    disabled = false,
    onChange,
    options,
    panelTone = "neutral",
    sheetDescription,
    sheetTitle,
    triggerLabel,
    values,
}: MultiChoiceSheetFieldProps) {
    const [open, setOpen] = useState(false);
    const normalizedValues = normalizeDesiredCountryValues(values);
    const hasAllSelected = normalizedValues.includes(ALL_OPTION_VALUE);
    const optionBaseClass = panelTone === "stone"
        ? "border-[#e7e0d4] bg-[#faf8f3] text-[#18181b] hover:bg-white"
        : "border-[#e5e7eb] bg-[#fafafa] text-[#111827] hover:bg-white";
    const optionActiveClass = panelTone === "stone"
        ? "border-[#d8cfbf] bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.3)]"
        : "border-[#111111] bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.26)]";

    function toggleValue(nextValue: string) {
        if (nextValue === ALL_OPTION_VALUE) {
            onChange([ALL_OPTION_VALUE]);
            return;
        }

        const withoutAll = normalizedValues.filter((value) => value !== ALL_OPTION_VALUE);
        const nextValues = withoutAll.includes(nextValue)
            ? withoutAll.filter((value) => value !== nextValue)
            : [...withoutAll, nextValue];

        onChange(nextValues);
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className={`${buttonClassName} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <span className="min-w-0 flex-1 text-left leading-snug">{triggerLabel}</span>
                <ChevronDown size={18} className="shrink-0 text-[#9ca3af]" />
            </button>

            <SelectionSheet
                open={open}
                onClose={() => setOpen(false)}
                title={sheetTitle}
                description={sheetDescription}
                tone={panelTone}
            >
                <div className="max-h-[52vh] space-y-3 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
                    <button
                        type="button"
                        onClick={() => toggleValue(ALL_OPTION_VALUE)}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${optionBaseClass} ${hasAllSelected ? optionActiveClass : ""}`}
                    >
                        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${hasAllSelected ? "border-[#111111] bg-[#111111] text-white" : "border-[#d1d5db] bg-white text-transparent"}`}>
                            <Check size={12} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold">{allLabel}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-[#6b7280]">Keep this worker open to every destination in Europe.</span>
                        </span>
                    </button>

                    {options.map((option) => {
                        const active = normalizedValues.includes(option.value) && !hasAllSelected;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleValue(option.value)}
                                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${optionBaseClass} ${active ? optionActiveClass : ""} ${hasAllSelected ? "opacity-50" : ""}`}
                            >
                                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#111111] bg-[#111111] text-white" : "border-[#d1d5db] bg-white text-transparent"}`}>
                                    <Check size={12} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{option.label}</span>
                                    {option.description ? <span className="mt-1 block text-xs leading-relaxed text-[#6b7280]">{option.description}</span> : null}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="border-t border-[#e5e7eb] px-5 py-4 sm:px-6">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2b2b]"
                    >
                        Done
                    </button>
                </div>
            </SelectionSheet>
        </>
    );
}
