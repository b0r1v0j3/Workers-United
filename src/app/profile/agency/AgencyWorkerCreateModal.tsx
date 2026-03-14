"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Pencil, Save, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
    EUROPEAN_COUNTRIES,
    GENDER_OPTIONS,
    MARITAL_STATUSES,
    WORKER_INDUSTRIES,
    WORLD_COUNTRIES,
} from "@/lib/constants";
import {
    ALL_OPTION_VALUE,
    NativeDestinationSelectField,
    normalizeDesiredCountryValues,
    normalizePreferredJobValue,
} from "@/components/forms/PreferenceSheetField";
import InternationalPhoneField from "@/components/forms/InternationalPhoneField";

const inputClass = "min-w-0 w-full max-w-full [min-inline-size:0] rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#111111]";
const labelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]";
const sectionClass = "relative min-w-0 overflow-x-hidden rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-[28px] sm:border sm:border-[#ececec] sm:bg-white sm:p-6 sm:shadow-[0_20px_60px_-52px_rgba(15,23,42,0.22)] sm:before:hidden";

type Child = { first_name: string; last_name: string; dob: string };
type Spouse = { first_name: string; last_name: string; dob: string; birth_country: string; birth_city: string };

type FormState = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    currentCountry: string;
    preferredJob: string;
    desiredCountries: string[];
    gender: string;
    maritalStatus: string;
    dateOfBirth: string;
    birthCountry: string;
    birthCity: string;
    citizenship: string;
    originalCitizenshipSame: boolean;
    originalCitizenship: string;
    maidenName: string;
    fatherName: string;
    motherName: string;
    address: string;
    passportNumber: string;
    passportIssuedBy: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    livesAbroad: string;
    previousVisas: string;
};

type AgencyWorkerDetail = {
    id: string;
    submitted_full_name: string | null;
    submitted_email: string | null;
    phone: string | null;
    nationality: string | null;
    current_country: string | null;
    preferred_job: string | null;
    desired_countries: string[] | null;
    gender: string | null;
    marital_status: string | null;
    date_of_birth: string | null;
    birth_country: string | null;
    birth_city: string | null;
    citizenship: string | null;
    original_citizenship: string | null;
    maiden_name: string | null;
    father_name: string | null;
    mother_name: string | null;
    address: string | null;
    family_data: AgencyWorkerModalPayload["familyData"] | null;
    passport_number: string | null;
    passport_issued_by: string | null;
    passport_issue_date: string | null;
    passport_expiry_date: string | null;
    lives_abroad: string | null;
    previous_visas: string | null;
};

export type AgencyWorkerModalPayload = {
    fullName: string;
    email: string;
    phone: string;
    nationality: string;
    currentCountry: string;
    preferredJob: string;
    desiredCountries: string[];
    gender: string;
    maritalStatus: string;
    dateOfBirth: string;
    birthCountry: string;
    birthCity: string;
    citizenship: string;
    originalCitizenship: string;
    maidenName: string;
    fatherName: string;
    motherName: string;
    address: string;
    familyData: {
        spouse?: { first_name?: string | null; last_name?: string | null; dob?: string | null; birth_country?: string | null; birth_city?: string | null };
        children?: Array<{ first_name?: string | null; last_name?: string | null; dob?: string | null }>;
    } | null;
    passportNumber: string;
    passportIssuedBy: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    livesAbroad: string;
    previousVisas: string;
};

interface Props {
    open: boolean;
    workerId?: string | null;
    workerLabel?: string | null;
    readOnlyPreview: boolean;
    inspectProfileId?: string | null;
    standalone?: boolean;
    onClose: () => void;
    onLiveSave: (workerId: string) => void;
}

function emptyForm(): FormState {
    return {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        nationality: "",
        currentCountry: "",
        preferredJob: "",
        desiredCountries: [],
        gender: "",
        maritalStatus: "",
        dateOfBirth: "",
        birthCountry: "",
        birthCity: "",
        citizenship: "",
        originalCitizenshipSame: true,
        originalCitizenship: "",
        maidenName: "",
        fatherName: "",
        motherName: "",
        address: "",
        passportNumber: "",
        passportIssuedBy: "",
        passportIssueDate: "",
        passportExpiryDate: "",
        livesAbroad: "",
        previousVisas: "",
    };
}

function emptySpouse(): Spouse {
    return { first_name: "", last_name: "", dob: "", birth_country: "", birth_city: "" };
}

function splitFullName(fullName: string | null | undefined) {
    const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" "),
    };
}

function normalizeDateInput(value: string | null | undefined) {
    return value ? value.split("T")[0] || "" : "";
}

function formatDateInputValue(date: Date) {
    const localDate = new Date(date);
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    return localDate.toISOString().slice(0, 10);
}

function normalizeBooleanAnswer(value: string | null | undefined) {
    if (!value) return "";
    const normalized = value.trim().toLowerCase();
    if (normalized === "yes") return "Yes";
    if (normalized === "no") return "No";
    return value;
}

function normalizeFamilyData(value: AgencyWorkerModalPayload["familyData"] | null | undefined) {
    return {
        spouse: value?.spouse
            ? {
                first_name: value.spouse.first_name || "",
                last_name: value.spouse.last_name || "",
                dob: normalizeDateInput(value.spouse.dob),
                birth_country: value.spouse.birth_country || "",
                birth_city: value.spouse.birth_city || "",
            }
            : null,
        children: Array.isArray(value?.children)
            ? value.children.map((child) => ({
                first_name: child.first_name || "",
                last_name: child.last_name || "",
                dob: normalizeDateInput(child.dob),
            }))
            : [],
    };
}

function hydrateWorkerDetail(worker: AgencyWorkerDetail) {
    const { firstName, lastName } = splitFullName(worker.submitted_full_name);
    const normalizedFamily = normalizeFamilyData(worker.family_data);
    const citizenship = worker.citizenship || "";
    const originalCitizenship = worker.original_citizenship || citizenship;
    const form: FormState = {
        firstName,
        lastName,
        email: worker.submitted_email || "",
        phone: worker.phone || "",
        nationality: worker.nationality || "",
        currentCountry: worker.current_country || "",
        preferredJob: normalizePreferredJobValue(worker.preferred_job, false),
        desiredCountries: normalizeDesiredCountryValues(worker.desired_countries),
        gender: worker.gender || "",
        maritalStatus: worker.marital_status || "",
        dateOfBirth: normalizeDateInput(worker.date_of_birth),
        birthCountry: worker.birth_country || "",
        birthCity: worker.birth_city || "",
        citizenship,
        originalCitizenshipSame: !originalCitizenship || originalCitizenship === citizenship,
        originalCitizenship,
        maidenName: worker.maiden_name || "",
        fatherName: worker.father_name || "",
        motherName: worker.mother_name || "",
        address: worker.address || "",
        passportNumber: worker.passport_number || "",
        passportIssuedBy: worker.passport_issued_by || "",
        passportIssueDate: normalizeDateInput(worker.passport_issue_date),
        passportExpiryDate: normalizeDateInput(worker.passport_expiry_date),
        livesAbroad: normalizeBooleanAnswer(worker.lives_abroad),
        previousVisas: normalizeBooleanAnswer(worker.previous_visas),
    };
    const spouse = normalizedFamily.spouse || emptySpouse();
    const children = normalizedFamily.children;
    const hasSpouse = Boolean(normalizedFamily.spouse);
    const hasChildren = children.length > 0;

    return {
        form,
        hasSpouse,
        spouse,
        hasChildren,
        children,
        payload: buildPayload(form, hasSpouse, spouse, hasChildren, children),
    };
}

function buildPayload(form: FormState, hasSpouse: boolean, spouse: Spouse, hasChildren: boolean, children: Child[]): AgencyWorkerModalPayload {
    const familyData: AgencyWorkerModalPayload["familyData"] = {};

    if (hasSpouse && Object.values(spouse).some((value) => value.trim().length > 0)) {
        familyData.spouse = {
            first_name: spouse.first_name.trim() || null,
            last_name: spouse.last_name.trim() || null,
            dob: spouse.dob || null,
            birth_country: spouse.birth_country.trim() || null,
            birth_city: spouse.birth_city.trim() || null,
        };
    }

    if (hasChildren) {
        const normalizedChildren = children
            .map((child) => ({
                first_name: child.first_name.trim() || null,
                last_name: child.last_name.trim() || null,
                dob: child.dob || null,
            }))
            .filter((child) => child.first_name || child.last_name || child.dob);

        if (normalizedChildren.length > 0) {
            familyData.children = normalizedChildren;
        }
    }

    return {
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        nationality: form.nationality.trim(),
        currentCountry: form.currentCountry.trim(),
        preferredJob: form.preferredJob.trim(),
        desiredCountries: form.desiredCountries,
        gender: form.gender,
        maritalStatus: form.maritalStatus,
        dateOfBirth: form.dateOfBirth,
        birthCountry: form.birthCountry.trim(),
        birthCity: form.birthCity.trim(),
        citizenship: form.citizenship.trim(),
        originalCitizenship: form.originalCitizenshipSame ? form.citizenship.trim() : form.originalCitizenship.trim(),
        maidenName: form.maidenName.trim(),
        fatherName: form.fatherName.trim(),
        motherName: form.motherName.trim(),
        address: form.address.trim(),
        familyData: Object.keys(familyData).length > 0 ? familyData : null,
        passportNumber: form.passportNumber.trim(),
        passportIssuedBy: form.passportIssuedBy.trim(),
        passportIssueDate: form.passportIssueDate,
        passportExpiryDate: form.passportExpiryDate,
        livesAbroad: form.livesAbroad,
        previousVisas: form.previousVisas,
    };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className={sectionClass}>
            <h3 className="text-xl font-semibold tracking-tight text-[#111827]">{title}</h3>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className={labelClass}>{label}</span>
            {children}
            {helper ? <p className="mt-2 text-xs leading-relaxed text-[#6b7280]">{helper}</p> : null}
        </label>
    );
}

export default function AgencyWorkerCreateModal({
    open,
    workerId = null,
    readOnlyPreview,
    inspectProfileId = null,
    standalone = false,
    onClose,
    onLiveSave,
}: Props) {
    const [form, setForm] = useState<FormState>(emptyForm());
    const [hasSpouse, setHasSpouse] = useState(false);
    const [spouse, setSpouse] = useState<Spouse>(emptySpouse());
    const [hasChildren, setHasChildren] = useState(false);
    const [children, setChildren] = useState<Child[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingWorker, setLoadingWorker] = useState(false);
    const [showClosePrompt, setShowClosePrompt] = useState(false);
    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const todayIso = useMemo(() => formatDateInputValue(new Date()), []);
    const birthDateMinIso = useMemo(() => `${currentYear - 120}-01-01`, [currentYear]);
    const passportIssueMinIso = useMemo(() => `${currentYear - 20}-01-01`, [currentYear]);
    const passportExpiryMaxIso = useMemo(() => `${currentYear + 20}-12-31`, [currentYear]);

    useEffect(() => {
        if (!open || standalone || typeof document === "undefined") return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open, standalone]);

    const payload = useMemo(() => buildPayload(form, hasSpouse, spouse, hasChildren, children), [children, form, hasChildren, hasSpouse, spouse]);
    const pristinePayload = useMemo(
        () => buildPayload(
            emptyForm(),
            false,
            emptySpouse(),
            false,
            [],
        ),
        [],
    );
    const [initialPayload, setInitialPayload] = useState<AgencyWorkerModalPayload>(pristinePayload);
    const isDirty = JSON.stringify(payload) !== JSON.stringify(initialPayload);
    const modeLabel = readOnlyPreview ? "Admin preview" : workerId ? "Edit worker" : "Add worker";
    const footerCopy = standalone
        ? readOnlyPreview
            ? "This preview does not save draft workers."
            : workerId
                ? "Saving updates this worker draft and returns you to the agency dashboard."
                : "Saving creates the worker draft and returns you to the agency dashboard."
        : readOnlyPreview
            ? "This preview does not save draft workers."
            : workerId
                ? "Saving updates this worker draft and keeps you on the dashboard."
                : "Saving creates the worker draft and keeps you on the dashboard.";
    const secondarySaveLabel = standalone
        ? workerId ? "Save draft" : "Create worker"
        : workerId ? "Save changes" : "Save worker";
    const primarySaveLabel = standalone
        ? workerId ? "Save and return" : "Create and return"
        : workerId ? "Save changes and close" : "Save and close";
    const overlayClass = standalone
        ? "relative overflow-x-hidden"
        : "fixed inset-0 z-[120] flex items-stretch justify-center overflow-x-hidden bg-[rgba(15,23,42,0.12)] px-0 py-0 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-5";
    const panelClass = standalone
        ? "relative flex min-h-[calc(100dvh-132px)] w-full max-w-full min-w-0 flex-col overflow-x-hidden overflow-y-hidden bg-white sm:rounded-[34px] sm:border sm:border-[#e5e7eb] sm:shadow-[0_44px_140px_-64px_rgba(15,23,42,0.18)]"
        : "relative flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl min-w-0 flex-col overflow-x-hidden overflow-y-hidden rounded-none border border-[#e5e7eb] bg-white shadow-[0_44px_140px_-64px_rgba(15,23,42,0.35)] sm:h-[90vh] sm:max-h-[90vh] sm:rounded-[34px]";
    const closePromptOverlayClass = standalone
        ? "fixed inset-0 z-[130] flex items-end justify-center bg-[rgba(15,23,42,0.12)] px-0 py-0 sm:items-center sm:px-4 sm:py-6"
        : "absolute inset-0 z-[130] flex items-end justify-center bg-[rgba(15,23,42,0.12)] px-0 py-0 sm:items-center sm:px-4 sm:py-6";
    const industryOptions = useMemo(
        () => WORKER_INDUSTRIES.filter((industry) => industry !== ALL_OPTION_VALUE).map((industry) => ({
                value: industry,
                label: industry,
            })),
        []
    );
    const destinationOptions = useMemo(
        () => EUROPEAN_COUNTRIES.map((country) => ({
            value: country,
            label: country === "Bosnia and Herzegovina" ? "Bosnia & Herzegovina" : country,
        })),
        []
    );

    useEffect(() => {
        if (!open) return;
        setShowClosePrompt(false);

        if (!workerId) {
            setForm(emptyForm());
            setHasSpouse(false);
            setSpouse(emptySpouse());
            setHasChildren(false);
            setChildren([]);
            setInitialPayload(pristinePayload);
            setLoadingWorker(false);
            return;
        }

        let cancelled = false;
        const params = new URLSearchParams();
        if (inspectProfileId) {
            params.set("inspect", inspectProfileId);
        }

        setLoadingWorker(true);
        void (async () => {
            try {
                const response = await fetch(`/api/agency/workers/${workerId}${params.toString() ? `?${params.toString()}` : ""}`, {
                    method: "GET",
                    cache: "no-store",
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Failed to load worker.");
                }
                if (cancelled) return;

                const hydrated = hydrateWorkerDetail(data.worker as AgencyWorkerDetail);
                setForm(hydrated.form);
                setHasSpouse(hydrated.hasSpouse);
                setSpouse(hydrated.spouse);
                setHasChildren(hydrated.hasChildren);
                setChildren(hydrated.children);
                setInitialPayload(hydrated.payload);
            } catch (error) {
                if (cancelled) return;
                toast.error(error instanceof Error ? error.message : "Failed to load worker.");
                onClose();
            } finally {
                if (!cancelled) {
                    setLoadingWorker(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [inspectProfileId, onClose, open, pristinePayload, workerId]);

    function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function requestClose() {
        if (saving) return;
        if (isDirty) {
            setShowClosePrompt(true);
            return;
        }
        onClose();
    }

    async function handleSave(closeAfterSave: boolean) {
        if (readOnlyPreview) {
            toast.error("Preview mode does not save workers.");
            return false;
        }

        if (loadingWorker) {
            return false;
        }

        if (!payload.fullName) {
            toast.error("Worker first and last name are required.");
            return false;
        }

        if (payload.phone && !/^\+\d{7,15}$/.test(payload.phone.replace(/[\s\-()]/g, ""))) {
            toast.error("Phone number must start with + and country code.");
            return false;
        }

        setSaving(true);
        try {
            const response = await fetch(workerId ? `/api/agency/workers/${workerId}` : "/api/agency/workers", {
                method: workerId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, inspectProfileId }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || (workerId ? "Failed to update worker." : "Failed to create worker."));
                return false;
            }
            toast.success(workerId ? "Worker updated." : "Worker created.");
            onLiveSave(workerId || data.workerId);

            setShowClosePrompt(false);
            if (closeAfterSave) onClose();
            return true;
        } catch {
            toast.error(workerId ? "Failed to update worker." : "Failed to create worker.");
            return false;
        } finally {
            setSaving(false);
        }
    }

    if (!open) {
        return null;
    }

    return (
        <div
            className={overlayClass}
            onClick={standalone ? undefined : requestClose}
        >
            <div
                className={panelClass}
                onClick={standalone ? undefined : (event) => event.stopPropagation()}
            >
                {!standalone && (
                    <div className="border-b border-[#ececec] bg-white px-4 py-4 sm:px-6 sm:py-5">
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                                <button
                                    type="button"
                                    onClick={requestClose}
                                    className="inline-flex h-12 w-12 self-end items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white text-[#111827] transition hover:bg-[#fafafa] sm:self-auto"
                                    aria-label="Close worker modal"
                                >
                                    <X size={18} />
                                </button>
                                {readOnlyPreview ? (
                                    <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm font-semibold text-[#6b7280] sm:w-auto">
                                        Preview only
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => void handleSave(false)}
                                        disabled={saving || loadingWorker}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {secondarySaveLabel}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f7f7f6] px-4 py-4 sm:px-6 sm:py-6">
                    {loadingWorker ? (
                        <div className="flex h-full min-h-[420px] items-center justify-center">
                            <div className="inline-flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 text-sm font-semibold text-[#111827] shadow-sm">
                                <Loader2 size={18} className="animate-spin" />
                                Loading worker form...
                            </div>
                        </div>
                    ) : (
                        <div className="mx-auto max-w-[920px] min-w-0 overflow-x-hidden space-y-6">
                        <div className="px-1">
                            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                                {workerId ? <Pencil size={14} /> : <UserPlus size={14} />}
                                {modeLabel}
                            </div>
                        </div>

                        <Section title="Identity">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="First name">
                                    <input className={inputClass} value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
                                </Field>
                                <Field label="Last name">
                                    <input className={inputClass} value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
                                </Field>
                                <Field label="Email" helper="Optional. Use it only if the worker should receive notifications.">
                                    <input className={inputClass} type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                                </Field>
                                <Field label="Phone Number (WhatsApp)" helper="Optional. Use it only if the worker should receive WhatsApp or phone notifications. Do not type '0' before the number.">
                                    <InternationalPhoneField
                                        value={form.phone}
                                        onChange={(phone) => updateField("phone", phone)}
                                        inputClassName={inputClass}
                                        buttonClassName="!border-[#e5e7eb] !bg-[#fafafa] !rounded-l-2xl"
                                        disabled={saving || loadingWorker}
                                    />
                                </Field>
                                <Field label="Nationality">
                                    <select className={inputClass} value={form.nationality} onChange={(event) => updateField("nationality", event.target.value)}>
                                        <option value="">Select nationality</option>
                                        {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                                    </select>
                                </Field>
                                <Field label="Current country">
                                    <select className={inputClass} value={form.currentCountry} onChange={(event) => updateField("currentCountry", event.target.value)}>
                                        <option value="">Select current country</option>
                                        {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                                    </select>
                                </Field>
                                <Field label="Gender">
                                    <select className={inputClass} value={form.gender} onChange={(event) => updateField("gender", event.target.value)}>
                                        <option value="">Select gender</option>
                                        {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                </Field>
                                <Field label="Marital status">
                                    <select className={inputClass} value={form.maritalStatus} onChange={(event) => updateField("maritalStatus", event.target.value)}>
                                        <option value="">Select status</option>
                                        {MARITAL_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                </Field>
                                <Field label="Date of birth">
                                    <input
                                        type="date"
                                        className={inputClass}
                                        min={birthDateMinIso}
                                        max={todayIso}
                                        value={form.dateOfBirth}
                                        onChange={(event) => updateField("dateOfBirth", event.target.value)}
                                    />
                                </Field>
                                <Field label="Address">
                                    <input className={inputClass} value={form.address} onChange={(event) => updateField("address", event.target.value)} />
                                </Field>
                            </div>
                        </Section>

                        <Section title="Birth & Citizenship">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Birth country">
                                    <select className={inputClass} value={form.birthCountry} onChange={(event) => updateField("birthCountry", event.target.value)}>
                                        <option value="">Select birth country</option>
                                        {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                                    </select>
                                </Field>
                                <Field label="Birth city">
                                    <input className={inputClass} value={form.birthCity} onChange={(event) => updateField("birthCity", event.target.value)} />
                                </Field>
                                <Field label="Current citizenship">
                                    <select className={inputClass} value={form.citizenship} onChange={(event) => updateField("citizenship", event.target.value)}>
                                        <option value="">Select citizenship</option>
                                        {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                                    </select>
                                </Field>
                                <Field label="Maiden name">
                                    <input className={inputClass} value={form.maidenName} onChange={(event) => updateField("maidenName", event.target.value)} />
                                </Field>
                                <Field label="Father name">
                                    <input className={inputClass} value={form.fatherName} onChange={(event) => updateField("fatherName", event.target.value)} />
                                </Field>
                                <Field label="Mother name">
                                    <input className={inputClass} value={form.motherName} onChange={(event) => updateField("motherName", event.target.value)} />
                                </Field>
                            </div>

                            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#111827]">
                                <input
                                    type="checkbox"
                                    checked={form.originalCitizenshipSame}
                                    onChange={(event) => updateField("originalCitizenshipSame", event.target.checked)}
                                    className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                />
                                Original citizenship is the same as current citizenship
                            </label>

                            {!form.originalCitizenshipSame && (
                                <div className="mt-4">
                                    <Field label="Original citizenship">
                                        <select className={inputClass} value={form.originalCitizenship} onChange={(event) => updateField("originalCitizenship", event.target.value)}>
                                            <option value="">Select original citizenship</option>
                                            {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                                        </select>
                                    </Field>
                                </div>
                            )}
                        </Section>

                        <Section title="Passport & Travel">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Passport number">
                                    <input className={inputClass} value={form.passportNumber} onChange={(event) => updateField("passportNumber", event.target.value)} />
                                </Field>
                                <Field label="Passport issued by">
                                    <input className={inputClass} value={form.passportIssuedBy} onChange={(event) => updateField("passportIssuedBy", event.target.value)} />
                                </Field>
                                <Field label="Passport issue date">
                                    <input
                                        type="date"
                                        className={inputClass}
                                        min={passportIssueMinIso}
                                        max={todayIso}
                                        value={form.passportIssueDate}
                                        onChange={(event) => updateField("passportIssueDate", event.target.value)}
                                    />
                                </Field>
                                <Field label="Passport expiry date">
                                    <input
                                        type="date"
                                        className={inputClass}
                                        min={todayIso}
                                        max={passportExpiryMaxIso}
                                        value={form.passportExpiryDate}
                                        onChange={(event) => updateField("passportExpiryDate", event.target.value)}
                                    />
                                </Field>
                                <Field label="Do you live outside your home country?">
                                    <select className={inputClass} value={form.livesAbroad} onChange={(event) => updateField("livesAbroad", event.target.value)}>
                                        <option value="">Select answer</option>
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </Field>
                                <Field label="Have you had any visas in the last 3 years?">
                                    <select className={inputClass} value={form.previousVisas} onChange={(event) => updateField("previousVisas", event.target.value)}>
                                        <option value="">Select answer</option>
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </Field>
                            </div>
                        </Section>

                        <Section title="Job Preferences">
                            <Field label="Preferred job">
                                <select
                                    className={inputClass}
                                    value={normalizePreferredJobValue(form.preferredJob, false)}
                                    onChange={(event) => updateField("preferredJob", event.target.value)}
                                >
                                    <option value="">Select industries</option>
                                    <option value={ALL_OPTION_VALUE}>All industries</option>
                                    {industryOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <div className="mt-5">
                                <Field
                                    label="Preferred destinations"
                                    helper="Pick one or more destinations, or keep this worker open to all destinations in Europe."
                                >
                                    <NativeDestinationSelectField
                                        allLabel="All destinations"
                                        chipClassName="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827]"
                                        clearButtonClassName="inline-flex items-center rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1.5 text-xs font-semibold text-[#6b7280] transition hover:bg-white"
                                        emptyStateClassName="text-xs leading-relaxed text-[#6b7280]"
                                        optionLabel="Select destinations"
                                        options={destinationOptions}
                                        removeButtonClassName="transition hover:border-[#d1d5db] hover:bg-[#fafafa]"
                                        selectClassName={inputClass}
                                        values={normalizeDesiredCountryValues(form.desiredCountries)}
                                        onChange={(values) => updateField("desiredCountries", values)}
                                    />
                                </Field>
                            </div>
                        </Section>

                        <Section title="Family">
                            <div className="space-y-5">
                                <div className="rounded-[24px] border border-[#e5e7eb] bg-[#fafafa] p-4">
                                    <label className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                                        <input
                                            type="checkbox"
                                            checked={hasSpouse}
                                            onChange={(event) => setHasSpouse(event.target.checked)}
                                            className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                        />
                                        This worker has a spouse or partner
                                    </label>

                                    {hasSpouse && (
                                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                                            <Field label="Spouse first name">
                                                <input className={inputClass} value={spouse.first_name} onChange={(event) => setSpouse((current) => ({ ...current, first_name: event.target.value }))} />
                                            </Field>
                                            <Field label="Spouse last name">
                                                <input className={inputClass} value={spouse.last_name} onChange={(event) => setSpouse((current) => ({ ...current, last_name: event.target.value }))} />
                                            </Field>
                                            <Field label="Spouse date of birth">
                                                <input
                                                    type="date"
                                                    className={inputClass}
                                                    min={birthDateMinIso}
                                                    max={todayIso}
                                                    value={spouse.dob}
                                                    onChange={(event) => setSpouse((current) => ({ ...current, dob: event.target.value }))}
                                                />
                                            </Field>
                                            <Field label="Spouse birth country">
                                                <select className={inputClass} value={spouse.birth_country} onChange={(event) => setSpouse((current) => ({ ...current, birth_country: event.target.value }))}>
                                                    <option value="">Select birth country</option>
                                                    {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                                                </select>
                                            </Field>
                                            <Field label="Spouse birth city">
                                                <input className={inputClass} value={spouse.birth_city} onChange={(event) => setSpouse((current) => ({ ...current, birth_city: event.target.value }))} />
                                            </Field>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-[24px] border border-[#e5e7eb] bg-[#fafafa] p-4">
                                    <label className="flex items-center gap-3 text-sm font-medium text-[#111827]">
                                        <input
                                            type="checkbox"
                                            checked={hasChildren}
                                            onChange={(event) => {
                                                setHasChildren(event.target.checked);
                                                if (event.target.checked && children.length === 0) {
                                                    setChildren([{ first_name: "", last_name: "", dob: "" }]);
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                        />
                                        This worker has children
                                    </label>

                                    {hasChildren && (
                                        <div className="mt-4 space-y-3">
                                            {children.map((child, index) => (
                                                <div key={`${index}-${child.first_name}-${child.last_name}`} className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
                                                    <div className="grid gap-4 md:grid-cols-3">
                                                        <Field label={`Child ${index + 1} first name`}>
                                                            <input
                                                                className={inputClass}
                                                                value={child.first_name}
                                                                onChange={(event) => setChildren((current) =>
                                                                    current.map((item, currentIndex) =>
                                                                        currentIndex === index ? { ...item, first_name: event.target.value } : item
                                                                    )
                                                                )}
                                                            />
                                                        </Field>
                                                        <Field label="Last name">
                                                            <input
                                                                className={inputClass}
                                                                value={child.last_name}
                                                                onChange={(event) => setChildren((current) =>
                                                                    current.map((item, currentIndex) =>
                                                                        currentIndex === index ? { ...item, last_name: event.target.value } : item
                                                                    )
                                                                )}
                                                            />
                                                        </Field>
                                                        <Field label="Date of birth">
                                                            <input
                                                                type="date"
                                                                className={inputClass}
                                                                min={birthDateMinIso}
                                                                max={todayIso}
                                                                value={child.dob}
                                                                onChange={(event) => setChildren((current) =>
                                                                    current.map((item, currentIndex) =>
                                                                        currentIndex === index ? { ...item, dob: event.target.value } : item
                                                                    )
                                                                )}
                                                            />
                                                        </Field>
                                                    </div>
                                                </div>
                                            ))}

                                            <div className="flex flex-wrap gap-3">
                                                {children.length < 5 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setChildren((current) => [...current, { first_name: "", last_name: "", dob: "" }])}
                                                        className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa]"
                                                    >
                                                        Add child
                                                    </button>
                                                )}
                                                {children.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setChildren((current) => current.slice(0, -1))}
                                                        className="rounded-2xl border border-[#f3d7d7] bg-white px-4 py-3 text-sm font-semibold text-[#9f1239] transition hover:bg-[#fff1f2]"
                                                    >
                                                        Remove last child
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Section>
                    </div>
                    )}
                </div>

                <div className="border-t border-[#ececec] bg-white px-4 py-4 sm:px-6">
                    <div className="mx-auto flex max-w-[920px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="max-w-2xl text-sm text-[#6b7280]">
                            {footerCopy}
                        </div>
                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={requestClose}
                                className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-center text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa] sm:w-auto"
                            >
                                {standalone ? "Back to dashboard" : "Close"}
                            </button>
                            {!readOnlyPreview && (
                                <button
                                    type="button"
                                    onClick={() => void handleSave(true)}
                                    disabled={saving || loadingWorker}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {primarySaveLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showClosePrompt && (
                <div
                    className={closePromptOverlayClass}
                    onClick={() => setShowClosePrompt(false)}
                >
                    <div
                        className="w-full max-w-md rounded-t-[28px] border border-[#e5e7eb] bg-white p-5 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff7ed] text-[#c2410c]">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[#111827]">
                                    {readOnlyPreview ? "Discard preview changes?" : "Save changes before closing?"}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                                    {readOnlyPreview
                                        ? "You changed this preview form. These changes are not saved anywhere. Discard them or keep editing."
                                        : "You changed this worker form. Save it first, discard it, or keep editing."}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3">
                            {!readOnlyPreview && (
                                <button
                                    type="button"
                                    onClick={() => void handleSave(true)}
                                    disabled={saving || loadingWorker}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {primarySaveLabel}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowClosePrompt(false);
                                    onClose();
                                }}
                                className="rounded-2xl border border-[#f3d7d7] bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#9f1239] transition hover:bg-[#ffe9ec]"
                            >
                                Discard changes
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowClosePrompt(false)}
                                className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa]"
                            >
                                Continue editing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
