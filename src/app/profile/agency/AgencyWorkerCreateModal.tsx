"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Save, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
    EUROPEAN_COUNTRIES,
    GENDER_OPTIONS,
    MARITAL_STATUSES,
    WORKER_INDUSTRIES,
    WORLD_COUNTRIES,
} from "@/lib/constants";

const inputClass = "w-full rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#111111]";
const labelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]";
const sectionClass = "rounded-[28px] border border-[#ececec] bg-white p-6 shadow-[0_20px_60px_-52px_rgba(15,23,42,0.22)]";

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
    readOnlyPreview: boolean;
    inspectProfileId?: string | null;
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
    readOnlyPreview,
    inspectProfileId = null,
    onClose,
    onLiveSave,
}: Props) {
    const [form, setForm] = useState<FormState>(emptyForm());
    const [hasSpouse, setHasSpouse] = useState(false);
    const [spouse, setSpouse] = useState<Spouse>({ first_name: "", last_name: "", dob: "", birth_country: "", birth_city: "" });
    const [hasChildren, setHasChildren] = useState(false);
    const [children, setChildren] = useState<Child[]>([]);
    const [saving, setSaving] = useState(false);
    const [showClosePrompt, setShowClosePrompt] = useState(false);

    useEffect(() => {
        if (!open) return;
        setForm(emptyForm());
        setHasSpouse(false);
        setSpouse({ first_name: "", last_name: "", dob: "", birth_country: "", birth_city: "" });
        setHasChildren(false);
        setChildren([]);
    }, [open]);

    useEffect(() => {
        if (!open || typeof document === "undefined") return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    const payload = useMemo(() => buildPayload(form, hasSpouse, spouse, hasChildren, children), [children, form, hasChildren, hasSpouse, spouse]);
    const pristinePayload = useMemo(
        () => buildPayload(
            emptyForm(),
            false,
            { first_name: "", last_name: "", dob: "", birth_country: "", birth_city: "" },
            false,
            [],
        ),
        [],
    );
    const isDirty = JSON.stringify(payload) !== JSON.stringify(pristinePayload);

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
            const response = await fetch("/api/agency/workers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, inspectProfileId }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || "Failed to create worker.");
                return false;
            }
            toast.success("Worker created.");
            onLiveSave(data.workerId);

            setShowClosePrompt(false);
            if (closeAfterSave) onClose();
            return true;
        } catch {
            toast.error("Failed to create worker.");
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
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(15,23,42,0.12)] px-4 py-5 backdrop-blur-[2px]"
            onClick={requestClose}
        >
            <div
                className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[34px] border border-[#e5e7eb] bg-white shadow-[0_44px_140px_-64px_rgba(15,23,42,0.35)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-[#ececec] bg-white px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                                <UserPlus size={14} />
                                {readOnlyPreview ? "Admin preview" : "Add worker"}
                            </div>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">
                                Add worker
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                                {readOnlyPreview
                                    ? "Inspect the full worker form here without leaving the workspace. Changes are discarded when you close this preview."
                                    : "Fill the full worker form here without leaving the dashboard. Email and phone stay optional unless the worker should receive notifications or a claim link."}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {readOnlyPreview ? (
                                <div className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm font-semibold text-[#6b7280]">
                                    Preview only
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void handleSave(false)}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save worker
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={requestClose}
                                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white text-[#111827] transition hover:bg-[#fafafa]"
                                aria-label="Close worker modal"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#f7f7f6] px-6 py-6">
                    <div className="mx-auto max-w-[920px] space-y-6">
                        <div className="rounded-[24px] border border-[#e5e7eb] bg-white px-5 py-4 text-sm leading-relaxed text-[#4b5563]">
                            {readOnlyPreview
                                ? "Email and phone are optional. This preview shows the real worker intake structure without creating preview rows or drafts."
                                : "Email and phone are optional. Add them only if the worker should receive notifications or a claim link."}
                        </div>

                        <Section title="Identity">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="First name">
                                    <input className={inputClass} value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
                                </Field>
                                <Field label="Last name">
                                    <input className={inputClass} value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
                                </Field>
                                <Field label="Email" helper="Optional. Use it only if the worker should receive notifications or a claim link.">
                                    <input className={inputClass} type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                                </Field>
                                <Field label="Phone" helper="Optional. Use it only if the worker should receive WhatsApp or phone notifications.">
                                    <input className={inputClass} placeholder="+381..." value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
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
                                    <input className={inputClass} type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} />
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

                        <Section title="Job Preferences">
                            <Field label="Preferred job">
                                <select className={inputClass} value={form.preferredJob} onChange={(event) => updateField("preferredJob", event.target.value)}>
                                    <option value="">Select industry</option>
                                    {WORKER_INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
                                </select>
                            </Field>

                            <div className="mt-5 rounded-[24px] border border-[#e5e7eb] bg-[#fafafa] p-4">
                                <div className={labelClass}>Preferred destinations</div>
                                <label className="mb-4 flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-medium text-[#111827]">
                                    <input
                                        type="checkbox"
                                        checked={form.desiredCountries.includes("Any")}
                                        onChange={(event) => updateField("desiredCountries", event.target.checked ? ["Any"] : [])}
                                        className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                    />
                                    Open to any country in Europe
                                </label>

                                <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${form.desiredCountries.includes("Any") ? "pointer-events-none opacity-45" : ""}`}>
                                    {EUROPEAN_COUNTRIES.map((country) => (
                                        <label key={country} className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#111827]">
                                            <input
                                                type="checkbox"
                                                checked={form.desiredCountries.includes(country)}
                                                onChange={(event) => updateField(
                                                    "desiredCountries",
                                                    event.target.checked
                                                        ? [...form.desiredCountries.filter((value) => value !== "Any"), country]
                                                        : form.desiredCountries.filter((value) => value !== country)
                                                )}
                                                className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                            />
                                            {country}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </Section>

                        <Section title="Family & Passport">
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
                                                <input className={inputClass} type="date" value={spouse.dob} onChange={(event) => setSpouse((current) => ({ ...current, dob: event.target.value }))} />
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
                                                                className={inputClass}
                                                                type="date"
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

                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field label="Passport number">
                                        <input className={inputClass} value={form.passportNumber} onChange={(event) => updateField("passportNumber", event.target.value)} />
                                    </Field>
                                    <Field label="Passport issued by">
                                        <input className={inputClass} value={form.passportIssuedBy} onChange={(event) => updateField("passportIssuedBy", event.target.value)} />
                                    </Field>
                                    <Field label="Passport issue date">
                                        <input className={inputClass} type="date" value={form.passportIssueDate} onChange={(event) => updateField("passportIssueDate", event.target.value)} />
                                    </Field>
                                    <Field label="Passport expiry date">
                                        <input className={inputClass} type="date" value={form.passportExpiryDate} onChange={(event) => updateField("passportExpiryDate", event.target.value)} />
                                    </Field>
                                    <Field label="Lives abroad">
                                        <select className={inputClass} value={form.livesAbroad} onChange={(event) => updateField("livesAbroad", event.target.value)}>
                                            <option value="">Select answer</option>
                                            <option value="yes">Yes</option>
                                            <option value="no">No</option>
                                        </select>
                                    </Field>
                                    <Field label="Previous visas in last 3 years">
                                        <select className={inputClass} value={form.previousVisas} onChange={(event) => updateField("previousVisas", event.target.value)}>
                                            <option value="">Select answer</option>
                                            <option value="yes">Yes</option>
                                            <option value="no">No</option>
                                        </select>
                                    </Field>
                                </div>
                            </div>
                        </Section>
                    </div>
                </div>

                <div className="border-t border-[#ececec] bg-white px-6 py-4">
                    <div className="mx-auto flex max-w-[920px] flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-[#6b7280]">
                            {readOnlyPreview
                                ? "This preview does not save draft workers."
                                : "Saving creates the worker draft and keeps you on the dashboard."}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={requestClose}
                                className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa]"
                            >
                                Close
                            </button>
                            {!readOnlyPreview && (
                                <button
                                    type="button"
                                    onClick={() => void handleSave(true)}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save and close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showClosePrompt && (
                <div
                    className="absolute inset-0 z-[130] flex items-center justify-center bg-[rgba(15,23,42,0.12)] px-4 py-6"
                    onClick={() => setShowClosePrompt(false)}
                >
                    <div
                        className="w-full max-w-md rounded-[28px] border border-[#e5e7eb] bg-white p-6 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.35)]"
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
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save and close
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
