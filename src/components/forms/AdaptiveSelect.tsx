"use client";

import {
    Children,
    Fragment,
    isValidElement,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type ReactElement,
    type ReactNode,
    type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type ParsedOption = {
    value: string;
    label: string;
    disabled: boolean;
};

type OptionElementProps = {
    value?: string | number;
    disabled?: boolean;
    children?: ReactNode;
};

type AdaptiveSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> & {
    desktopSearchThreshold?: number;
    desktopSearchPlaceholder?: string;
};

function nodeToText(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") {
        return String(node);
    }

    return Children.toArray(node).map((child) => nodeToText(child)).join("");
}

function parseOptions(children: ReactNode): ParsedOption[] {
    const options: ParsedOption[] = [];

    function walk(node: ReactNode) {
        Children.forEach(node, (child) => {
            if (!isValidElement(child)) {
                return;
            }

            const element = child as ReactElement<OptionElementProps>;

            if (element.type === Fragment) {
                walk(element.props.children);
                return;
            }

            if (element.type === "option") {
                options.push({
                    value: typeof element.props.value === "string" ? element.props.value : String(element.props.value ?? ""),
                    label: nodeToText(element.props.children),
                    disabled: Boolean(element.props.disabled),
                });
            }
        });
    }

    walk(children);
    return options;
}

export default function AdaptiveSelect({
    children,
    className = "",
    value,
    defaultValue,
    onChange,
    disabled = false,
    name,
    desktopSearchThreshold = 10,
    desktopSearchPlaceholder = "Search options",
    ...rest
}: AdaptiveSelectProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const options = useMemo(() => parseOptions(children), [children]);
    const isControlled = value !== undefined;
    const normalizedDefaultValue = typeof defaultValue === "string" || typeof defaultValue === "number"
        ? String(defaultValue)
        : "";
    const [internalValue, setInternalValue] = useState(() => {
        return normalizedDefaultValue;
    });
    const resolvedUncontrolledValue = useMemo(() => {
        if (options.some((option) => option.value === internalValue)) {
            return internalValue;
        }

        if (internalValue === "" && options.some((option) => option.value === "")) {
            return "";
        }

        if (normalizedDefaultValue && options.some((option) => option.value === normalizedDefaultValue)) {
            return normalizedDefaultValue;
        }

        return options.find((option) => !option.disabled)?.value ?? "";
    }, [internalValue, normalizedDefaultValue, options]);
    const resolvedValue = isControlled
        ? typeof value === "string" || typeof value === "number"
            ? String(value)
            : ""
        : resolvedUncontrolledValue;
    const placeholderOption = useMemo(() => options.find((option) => option.value === ""), [options]);
    const selectedOption = useMemo(
        () => options.find((option) => option.value === resolvedValue) || null,
        [options, resolvedValue]
    );

    const [useNativeSelect, setUseNativeSelect] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number; width: number } | null>(null);
    const [search, setSearch] = useState("");

    const isSearchable = options.filter((option) => option.value !== "").length >= desktopSearchThreshold;
    const filteredOptions = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return options.filter((option) => {
            if (!normalizedSearch) {
                return true;
            }
            return option.label.toLowerCase().includes(normalizedSearch);
        });
    }, [options, search]);

    const displayLabel = selectedOption?.label || placeholderOption?.label || "";

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const sync = () => setUseNativeSelect(mediaQuery.matches);

        sync();

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", sync);
            return () => mediaQuery.removeEventListener("change", sync);
        }

        mediaQuery.addListener(sync);
        return () => mediaQuery.removeListener(sync);
    }, []);

    useEffect(() => {
        if (!isOpen || useNativeSelect || typeof window === "undefined") {
            return;
        }

        function updatePosition() {
            const trigger = triggerRef.current;
            if (!trigger) {
                return;
            }

            const rect = trigger.getBoundingClientRect();
            const preferredWidth = Math.max(rect.width, 260);
            const panelWidth = Math.min(preferredWidth, window.innerWidth - 24);
            const left = Math.min(
                Math.max(12, rect.left),
                Math.max(12, window.innerWidth - panelWidth - 12)
            );
            const panelHeight = isSearchable ? 360 : 320;
            const roomBelow = window.innerHeight - rect.bottom - 12;
            const top = roomBelow >= panelHeight
                ? rect.bottom + 8
                : Math.max(12, rect.top - panelHeight - 8);

            setPopoverStyle({ top, left, width: panelWidth });
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
                setSearch("");
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
    }, [isOpen, isSearchable, useNativeSelect]);

    useEffect(() => {
        if (!isOpen || !isSearchable) {
            return;
        }

        searchRef.current?.focus();
    }, [isOpen, isSearchable]);

    function emitChange(nextValue: string) {
        if (!isControlled) {
            setInternalValue(nextValue);
        }

        const syntheticEvent = {
            target: { value: nextValue, name },
            currentTarget: { value: nextValue, name },
        } as ChangeEvent<HTMLSelectElement>;

        onChange?.(syntheticEvent);
    }

    function handleNativeChange(event: ChangeEvent<HTMLSelectElement>) {
        if (!isControlled) {
            setInternalValue(event.target.value);
        }

        onChange?.(event);
    }

    if (useNativeSelect) {
        return (
            <select
                className={className}
                {...rest}
                disabled={disabled}
                name={name}
                value={isControlled ? resolvedValue : undefined}
                defaultValue={!isControlled ? resolvedValue : undefined}
                onChange={handleNativeChange}
            >
                {children}
            </select>
        );
    }

    return (
        <div className="relative w-full min-w-0 max-w-full">
            {name && !disabled ? (
                <input
                    type="hidden"
                    name={name}
                    value={resolvedValue}
                    form={typeof rest.form === "string" ? rest.form : undefined}
                />
            ) : null}
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => {
                    setIsOpen((current) => !current);
                    if (isOpen) {
                        setSearch("");
                    }
                }}
                className={`${className} relative w-full min-w-0 flex items-center justify-between gap-3 pr-10 text-left disabled:cursor-not-allowed disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={resolvedValue ? "truncate text-[#111827]" : "truncate text-[#9ca3af]"}>
                    {displayLabel}
                </span>
                <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] transition ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {!useNativeSelect && isOpen && popoverStyle && typeof document !== "undefined"
                ? createPortal(
                    <>
                        <button
                            type="button"
                            aria-label="Close select menu"
                            onClick={() => {
                                setIsOpen(false);
                                setSearch("");
                            }}
                            className="fixed inset-0 z-[169] cursor-default bg-transparent"
                        />
                        <div
                            className="fixed z-[170] overflow-hidden rounded-[24px] border border-[#e5e7eb] bg-white shadow-[0_28px_90px_-48px_rgba(15,23,42,0.42)]"
                            style={popoverStyle}
                        >
                            {isSearchable ? (
                                <div className="border-b border-[#eef0f3] bg-[#fbfbfc] px-3 py-3">
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder={desktopSearchPlaceholder}
                                        className="h-10 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#111111]"
                                    />
                                </div>
                            ) : null}

                            <div className="max-h-[320px] overflow-y-auto px-2 py-2">
                                {filteredOptions.length > 0 ? (
                                    <div className="space-y-1">
                                        {filteredOptions.map((option) => {
                                            const isSelected = option.value === resolvedValue;

                                            return (
                                                <button
                                                    key={`${option.value}-${option.label}`}
                                                    type="button"
                                                    disabled={option.disabled}
                                                    onClick={() => {
                                                        emitChange(option.value);
                                                        setIsOpen(false);
                                                        setSearch("");
                                                    }}
                                                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                                                        isSelected
                                                            ? "bg-[#111111] text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.58)]"
                                                            : "text-[#111827] hover:bg-[#f4f4f5]"
                                                    } ${option.disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
                                                >
                                                    <span className="truncate">{option.label}</span>
                                                    {isSelected ? <Check size={15} className="shrink-0" /> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="px-3 py-8 text-center text-sm text-[#9ca3af]">
                                        No matching options
                                    </div>
                                )}
                            </div>
                        </div>
                    </>,
                    document.body
                )
                : null}
        </div>
    );
}
