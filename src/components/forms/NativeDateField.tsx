"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import AdaptiveSelect from "./AdaptiveSelect";

interface NativeDateFieldProps {
    value: string;
    onChange: (value: string) => void;
    inputClassName: string;
    min?: string;
    max?: string;
    disabled?: boolean;
    placeholder?: string;
}

type CalendarCell = {
    iso: string;
    label: number;
    inMonth: boolean;
    disabled: boolean;
};

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_LABELS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

function parseIsoDate(value?: string | null) {
    if (!value) {
        return null;
    }

    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
        return null;
    }

    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
    const parsed = parseIsoDate(value);
    if (!parsed) {
        return "";
    }

    return parsed.toLocaleDateString("en-GB");
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function sameMonth(left: Date, right: Date) {
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function clampMonth(date: Date, minDate: Date | null, maxDate: Date | null) {
    const month = startOfMonth(date);
    if (minDate) {
        const minMonth = startOfMonth(minDate);
        if (month < minMonth) {
            return minMonth;
        }
    }

    if (maxDate) {
        const maxMonth = startOfMonth(maxDate);
        if (month > maxMonth) {
            return maxMonth;
        }
    }

    return month;
}

function buildCalendarCells(displayMonth: Date, minDate: Date | null, maxDate: Date | null): CalendarCell[] {
    const firstDay = startOfMonth(displayMonth);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        date.setHours(12, 0, 0, 0);

        const iso = formatIsoDate(date);
        const disabled = Boolean(
            (minDate && date < minDate)
            || (maxDate && date > maxDate)
        );

        return {
            iso,
            label: date.getDate(),
            inMonth: sameMonth(date, displayMonth),
            disabled,
        };
    });
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
    const triggerRef = useRef<HTMLButtonElement>(null);

    const minDate = useMemo(() => parseIsoDate(min), [min]);
    const maxDate = useMemo(() => parseIsoDate(max), [max]);
    const selectedDate = useMemo(() => parseIsoDate(value), [value]);
    const displayValue = formatDateLabel(value);

    const [useNativePicker, setUseNativePicker] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [displayMonth, setDisplayMonth] = useState(() => clampMonth(selectedDate || maxDate || new Date(), minDate, maxDate));
    const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number; width: number } | null>(null);

    const yearOptions = useMemo(() => {
        const startYear = minDate?.getFullYear() ?? (new Date().getFullYear() - 120);
        const endYear = maxDate?.getFullYear() ?? (new Date().getFullYear() + 20);
        return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
    }, [maxDate, minDate]);

    const calendarCells = useMemo(
        () => buildCalendarCells(displayMonth, minDate, maxDate),
        [displayMonth, maxDate, minDate]
    );

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const sync = () => setUseNativePicker(mediaQuery.matches);

        sync();

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", sync);
            return () => mediaQuery.removeEventListener("change", sync);
        }

        mediaQuery.addListener(sync);
        return () => mediaQuery.removeListener(sync);
    }, []);

    useEffect(() => {
        setDisplayMonth((current) => {
            if (isOpen) {
                return current;
            }

            return clampMonth(selectedDate || current || maxDate || new Date(), minDate, maxDate);
        });
    }, [isOpen, maxDate, minDate, selectedDate]);

    useEffect(() => {
        if (!isOpen || useNativePicker || typeof window === "undefined") {
            return;
        }

        function updatePosition() {
            const trigger = triggerRef.current;
            if (!trigger) {
                return;
            }

            const rect = trigger.getBoundingClientRect();
            const preferredWidth = Math.max(rect.width, 320);
            const maxWidth = Math.min(preferredWidth, window.innerWidth - 24);
            const left = Math.min(
                Math.max(12, rect.left),
                Math.max(12, window.innerWidth - maxWidth - 12)
            );
            const panelHeight = 356;
            const roomBelow = window.innerHeight - rect.bottom - 12;
            const top = roomBelow >= panelHeight
                ? rect.bottom + 8
                : Math.max(12, rect.top - panelHeight - 8);

            setPopoverStyle({
                top,
                left,
                width: maxWidth,
            });
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, useNativePicker]);

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

    function handleTriggerClick() {
        if (disabled) {
            return;
        }

        if (useNativePicker) {
            openNativePicker();
            return;
        }

        setDisplayMonth(clampMonth(selectedDate || displayMonth || maxDate || new Date(), minDate, maxDate));
        setIsOpen((current) => !current);
    }

    function handleSelectDate(nextValue: string) {
        onChange(nextValue);
        setIsOpen(false);
    }

    function handleClearDate() {
        onChange("");
        setIsOpen(false);
    }

    function shiftMonth(delta: number) {
        setDisplayMonth((current) => clampMonth(
            new Date(current.getFullYear(), current.getMonth() + delta, 1, 12, 0, 0, 0),
            minDate,
            maxDate
        ));
    }

    function updateMonth(monthIndex: number) {
        setDisplayMonth((current) => clampMonth(
            new Date(current.getFullYear(), monthIndex, 1, 12, 0, 0, 0),
            minDate,
            maxDate
        ));
    }

    function updateYear(year: number) {
        setDisplayMonth((current) => clampMonth(
            new Date(year, current.getMonth(), 1, 12, 0, 0, 0),
            minDate,
            maxDate
        ));
    }

    const canGoPrev = !minDate || displayMonth > startOfMonth(minDate);
    const canGoNext = !maxDate || displayMonth < startOfMonth(maxDate);

    return (
        <div className="relative w-full min-w-0 max-w-full">
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
                ref={triggerRef}
                type="button"
                onClick={handleTriggerClick}
                disabled={disabled}
                className={`${inputClassName} flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]`}
                aria-haspopup={useNativePicker ? undefined : "dialog"}
                aria-expanded={useNativePicker ? undefined : isOpen}
                aria-label={displayValue || placeholder}
            >
                <span className={displayValue ? "truncate text-[#111827]" : "truncate text-[#9ca3af]"}>
                    {displayValue || placeholder}
                </span>
                <CalendarDays size={16} className="shrink-0 text-[#9ca3af]" />
            </button>

            {!useNativePicker && isOpen && popoverStyle && typeof document !== "undefined"
                ? createPortal(
                    <>
                        <button
                            type="button"
                            aria-label="Close calendar"
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-[159] cursor-default bg-transparent"
                        />
                        <div
                            className="fixed z-[160] overflow-hidden rounded-[24px] border border-[#e5e7eb] bg-white shadow-[0_28px_90px_-48px_rgba(15,23,42,0.42)]"
                            style={popoverStyle}
                        >
                            <div className="border-b border-[#eef0f3] bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_100%)] px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => shiftMonth(-1)}
                                        disabled={!canGoPrev}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white text-[#111827] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Previous month"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>

                                    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_110px] gap-2">
                                        <AdaptiveSelect
                                            value={displayMonth.getMonth()}
                                            onChange={(event) => updateMonth(Number(event.target.value))}
                                            className="h-10 min-w-0 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#111111]"
                                            desktopSearchThreshold={999}
                                        >
                                            {MONTH_LABELS.map((label, index) => (
                                                <option key={label} value={index}>
                                                    {label}
                                                </option>
                                            ))}
                                        </AdaptiveSelect>

                                        <AdaptiveSelect
                                            value={displayMonth.getFullYear()}
                                            onChange={(event) => updateYear(Number(event.target.value))}
                                            className="h-10 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#111111]"
                                            desktopSearchThreshold={999}
                                        >
                                            {yearOptions.map((year) => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))}
                                        </AdaptiveSelect>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => shiftMonth(1)}
                                        disabled={!canGoNext}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white text-[#111827] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Next month"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="px-4 py-4">
                                <div className="mb-3 grid grid-cols-7 gap-1">
                                    {WEEKDAY_LABELS.map((label) => (
                                        <div
                                            key={label}
                                            className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]"
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                    {calendarCells.map((cell) => {
                                        const isSelected = cell.iso === value;

                                        return (
                                            <button
                                                key={cell.iso}
                                                type="button"
                                                onClick={() => handleSelectDate(cell.iso)}
                                                disabled={cell.disabled}
                                                className={`h-10 rounded-2xl text-sm font-medium transition ${
                                                    isSelected
                                                        ? "bg-[#111111] text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.58)]"
                                                        : cell.inMonth
                                                            ? "text-[#111827] hover:bg-[#f3f4f6]"
                                                            : "text-[#c7cbd3] hover:bg-[#f8fafc]"
                                                } ${cell.disabled ? "cursor-not-allowed opacity-25 hover:bg-transparent" : ""}`}
                                            >
                                                {cell.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-[#eef0f3] bg-[#fafafa] px-4 py-3">
                                <div className="text-xs font-medium text-[#6b7280]">
                                    {displayValue || placeholder}
                                </div>

                                <div className="flex items-center gap-2">
                                    {value ? (
                                        <button
                                            type="button"
                                            onClick={handleClearDate}
                                            className="rounded-xl px-3 py-2 text-sm font-semibold text-[#6b7280] transition hover:bg-white hover:text-[#111827]"
                                        >
                                            Clear
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#f8fafc]"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>,
                    document.body
                )
                : null}
        </div>
    );
}
