"use client";

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
    const displayValue = formatDateLabel(value);

    return (
        <div className="relative w-full min-w-0 max-w-full overflow-hidden">
            <input
                type="date"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                min={min}
                max={max}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
            <div className={`${inputClassName} pointer-events-none flex items-center justify-between gap-3`}>
                <span className={displayValue ? "truncate text-[#111827]" : "truncate text-[#9ca3af]"}>
                    {displayValue || placeholder}
                </span>
                <CalendarDays size={16} className="shrink-0 text-[#9ca3af]" />
            </div>
        </div>
    );
}
