"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";

interface NativeDateFieldProps {
    value: string;
    onChange: (value: string) => void;
    inputClassName: string;
    min?: string;
    max?: string;
    disabled?: boolean;
    placeholder?: string;
}

function formatDateLabel(value: string) {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) {
        return "";
    }

    return `${day}/${month}/${year}`;
}

export default function NativeDateField({
    value,
    onChange,
    inputClassName,
    min,
    max,
    disabled = false,
    placeholder = "Select date",
}: NativeDateFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const displayValue = formatDateLabel(value);

    function openNativePicker() {
        if (disabled) {
            return;
        }

        const input = inputRef.current;
        if (!input) {
            return;
        }

        input.focus({ preventScroll: true });

        if ("showPicker" in HTMLInputElement.prototype && typeof input.showPicker === "function") {
            try {
                input.showPicker();
                return;
            } catch {
                // Fall back to click for browsers that gate showPicker differently.
            }
        }

        input.click();
    }

    return (
        <div className="relative w-full min-w-0 max-w-full overflow-hidden">
            <input
                ref={inputRef}
                type="date"
                className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0"
                min={min}
                max={max}
                value={value}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => onChange(event.target.value)}
            />
            <button
                type="button"
                onClick={openNativePicker}
                disabled={disabled}
                className={`${inputClassName} flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]`}
                aria-label={displayValue || placeholder}
            >
                <span className={displayValue ? "truncate text-[#111827]" : "truncate text-[#9ca3af]"}>
                    {displayValue || placeholder}
                </span>
                <CalendarDays size={16} className="shrink-0 text-[#9ca3af]" />
            </button>
        </div>
    );
}
