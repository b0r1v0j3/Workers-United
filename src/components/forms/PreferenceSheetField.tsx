"use client";

import { useMemo, useState } from "react";
import { getCountryDisplayLabel } from "@/lib/country-display";
import AdaptiveSelect from "./AdaptiveSelect";

export const ALL_OPTION_VALUE = "Any";

export interface PreferenceSheetOption {
    value: string;
    label: string;
    description?: string;
}

interface NativeDestinationSelectFieldProps {
    allLabel: string;
    chipClassName: string;
    clearButtonClassName: string;
    emptyStateClassName: string;
    onChange: (values: string[]) => void;
    optionLabel?: string;
    options: PreferenceSheetOption[];
    removeButtonClassName: string;
    selectClassName: string;
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
    const normalized = normalizePreferredJobValue(value, false);
    if (!normalized) {
        return "";
    }
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
        return normalized.map((value) => getCountryDisplayLabel(value)).join(", ");
    }

    return `${normalized.length} destinations selected`;
}

export function NativeDestinationSelectField({
    allLabel,
    chipClassName,
    clearButtonClassName,
    emptyStateClassName,
    onChange,
    optionLabel = "Select destinations",
    options,
    removeButtonClassName,
    selectClassName,
    values,
}: NativeDestinationSelectFieldProps) {
    const normalizedValues = normalizeDesiredCountryValues(values);
    const [pickerValue, setPickerValue] = useState("");
    const hasAllSelected = normalizedValues.includes(ALL_OPTION_VALUE);
    const optionLabels = useMemo(
        () => new Map(options.map((option) => [option.value, option.label])),
        [options]
    );

    function getDisplayLabel(value: string) {
        if (value === ALL_OPTION_VALUE) {
            return allLabel;
        }

        return optionLabels.get(value) || getCountryDisplayLabel(value);
    }

    const selectLabel = normalizedValues.length > 0
        ? hasAllSelected
            ? allLabel
            : normalizedValues.length <= 2
                ? normalizedValues.map((value) => getDisplayLabel(value)).join(", ")
                : `${normalizedValues.length} destinations selected`
        : optionLabel;

    function handleSelect(value: string) {
        if (!value) {
            return;
        }

        if (value === ALL_OPTION_VALUE) {
            onChange([ALL_OPTION_VALUE]);
            return;
        }

        const withoutAll = normalizedValues.filter((item) => item !== ALL_OPTION_VALUE);
        if (withoutAll.includes(value)) {
            return;
        }

        onChange([...withoutAll, value]);
    }

    function removeValue(value: string) {
        if (value === ALL_OPTION_VALUE) {
            onChange([]);
            return;
        }

        onChange(normalizedValues.filter((item) => item !== value && item !== ALL_OPTION_VALUE));
    }

    return (
        <div className="space-y-3">
            <AdaptiveSelect
                className={selectClassName}
                value={pickerValue}
                onChange={(event) => {
                    handleSelect(event.target.value);
                    setPickerValue("");
                }}
                desktopSearchPlaceholder="Search destinations"
            >
                <option value="">{selectLabel}</option>
                <option value={ALL_OPTION_VALUE}>{allLabel}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </AdaptiveSelect>

            {normalizedValues.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {hasAllSelected ? (
                        <button
                            type="button"
                            onClick={() => removeValue(ALL_OPTION_VALUE)}
                            className={`${chipClassName} ${removeButtonClassName}`}
                        >
                            {getDisplayLabel(ALL_OPTION_VALUE)}
                            <span aria-hidden="true">x</span>
                        </button>
                    ) : (
                        normalizedValues.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => removeValue(value)}
                                className={`${chipClassName} ${removeButtonClassName}`}
                            >
                                {getDisplayLabel(value)}
                                <span aria-hidden="true">x</span>
                            </button>
                        ))
                    )}

                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className={clearButtonClassName}
                    >
                        Clear
                    </button>
                </div>
            ) : (
                <p className={emptyStateClassName}>No destinations selected yet.</p>
            )}
        </div>
    );
}
