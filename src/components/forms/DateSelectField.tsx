"use client";

import { useMemo, useState } from "react";

const MONTH_OPTIONS = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

type DateParts = {
    day: string;
    month: string;
    year: string;
};

interface DateSelectFieldProps {
    maxYear: number;
    minYear: number;
    onChange: (value: string) => void;
    selectClassName: string;
    value: string;
    yearDirection?: "asc" | "desc";
}

function parseDateValue(value: string | null | undefined): DateParts {
    if (!value) {
        return { day: "", month: "", year: "" };
    }

    const [year = "", month = "", day = ""] = value.split("T")[0]?.split("-") || [];
    return {
        day: day ? `${Number(day)}` : "",
        month: month ? `${Number(month)}` : "",
        year,
    };
}

function buildDateValue(parts: DateParts) {
    if (!parts.year || !parts.month || !parts.day) {
        return "";
    }

    return `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
}

function buildYearOptions(minYear: number, maxYear: number, currentYear: string, direction: "asc" | "desc") {
    const years = new Set<number>();
    for (let year = minYear; year <= maxYear; year += 1) {
        years.add(year);
    }

    const parsedCurrentYear = Number(currentYear);
    if (Number.isFinite(parsedCurrentYear) && parsedCurrentYear > 0) {
        years.add(parsedCurrentYear);
    }

    return Array.from(years).sort((left, right) => (direction === "asc" ? left - right : right - left));
}

export default function DateSelectField({
    maxYear,
    minYear,
    onChange,
    selectClassName,
    value,
    yearDirection = "desc",
}: DateSelectFieldProps) {
    const [parts, setParts] = useState<DateParts>(() => parseDateValue(value));

    const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, index) => `${index + 1}`), []);
    const yearOptions = useMemo(
        () => buildYearOptions(minYear, maxYear, parts.year, yearDirection),
        [maxYear, minYear, parts.year, yearDirection]
    );

    function updatePart(field: keyof DateParts, nextValue: string) {
        setParts((current) => {
            const nextParts = { ...current, [field]: nextValue };
            onChange(buildDateValue(nextParts));
            return nextParts;
        });
    }

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select className={selectClassName} value={parts.day} onChange={(event) => updatePart("day", event.target.value)}>
                <option value="">Day</option>
                {dayOptions.map((day) => (
                    <option key={day} value={day}>
                        {day}
                    </option>
                ))}
            </select>

            <select className={selectClassName} value={parts.month} onChange={(event) => updatePart("month", event.target.value)}>
                <option value="">Month</option>
                {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                        {month.label}
                    </option>
                ))}
            </select>

            <select className={selectClassName} value={parts.year} onChange={(event) => updatePart("year", event.target.value)}>
                <option value="">Year</option>
                {yearOptions.map((year) => (
                    <option key={year} value={`${year}`}>
                        {year}
                    </option>
                ))}
            </select>
        </div>
    );
}
