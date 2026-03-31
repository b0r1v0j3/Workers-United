"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, CircleAlert, CreditCard, FileCheck2, Loader2, Save, ShieldAlert } from "lucide-react";
import { EUROPEAN_COUNTRIES, GENDER_OPTIONS, MARITAL_STATUSES, WORKER_INDUSTRIES, WORLD_COUNTRIES } from "@/lib/constants";
import {
    ALL_OPTION_VALUE,
    NativeDestinationSelectField,
    normalizeDesiredCountryValues,
    normalizePreferredJobValue,
} from "@/components/forms/PreferenceSheetField";
import InternationalPhoneField from "@/components/forms/InternationalPhoneField";
import NativeDateField from "@/components/forms/NativeDateField";
import AdaptiveSelect from "@/components/forms/AdaptiveSelect";
import { getCountryDisplayLabel } from "@/lib/country-display";
import { getEntryFeeUnlockState } from "@/lib/payment-eligibility";
import AgencyWorkerDocumentsPanel, { type AgencyWorkerDocumentsData, type WorkerDocumentState } from "@/app/profile/agency/AgencyWorkerDocumentsPanel";

interface AgencyFamilySpouse {
    first_name?: string | null;
    last_name?: string | null;
    dob?: string | null;
    birth_country?: string | null;
    birth_city?: string | null;
}

interface AgencyFamilyChild {
    first_name?: string | null;
    last_name?: string | null;
    dob?: string | null;
}

interface AgencyFamilyData {
    spouse?: AgencyFamilySpouse | null;
    children?: AgencyFamilyChild[] | null;
}

interface EditableChild {
    first_name: string;
    last_name: string;
    dob: string;
}

interface AgencyWorkerClientProps {
    initialWorker: {
        id: string;
        profileId: string | null;
        claimed: boolean;
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
        familyData: unknown;
        passportNumber: string;
        passportIssuedBy: string;
        passportIssueDate: string;
        passportExpiryDate: string;
        livesAbroad: string;
        previousVisas: string;
        status: string;
        updatedAt: string | null;
        completion: number;
        missingFields: string[];
        verifiedDocuments: number;
        documents: WorkerDocumentState[];
        accessLabel: string;
        paymentLabel: string;
        paymentState: "not_paid" | "pending" | "paid";
        paymentPendingUntil: string | null;
        entryFeePaidAt: string | null;
        adminApproved: boolean;
    };
    readOnlyPreview?: boolean;
    adminTestMode?: boolean;
    adminApprovalAccess?: boolean;
}

const inputClass = "min-w-0 w-full max-w-full [min-inline-size:0] rounded-2xl border border-[#e4e4df] bg-white px-4 py-3 text-sm text-[#18181b] outline-none transition focus:border-[#111111]";
const labelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8479]";
const industryOptions = [
    ...WORKER_INDUSTRIES.filter((industry) => industry !== ALL_OPTION_VALUE).map((industry) => ({
        value: industry,
        label: industry,
    })),
];
const destinationOptions = EUROPEAN_COUNTRIES.map((country) => ({
    value: country,
    label: getCountryDisplayLabel(country),
}));

function splitFullName(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
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

function normalizeFamilyData(value: unknown): AgencyFamilyData {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const familyValue = value as AgencyFamilyData;
    return {
        spouse: familyValue.spouse
            ? {
                first_name: familyValue.spouse.first_name || "",
                last_name: familyValue.spouse.last_name || "",
                dob: normalizeDateInput(familyValue.spouse.dob),
                birth_country: familyValue.spouse.birth_country || "",
                birth_city: familyValue.spouse.birth_city || "",
            }
            : null,
        children: Array.isArray(familyValue.children)
            ? familyValue.children.map((child) => ({
                first_name: child.first_name || "",
                last_name: child.last_name || "",
                dob: normalizeDateInput(child.dob),
            }))
            : [],
    };
}

function hasText(value: string) {
    return value.trim().length > 0;
}

export default function AgencyWorkerClient({
    initialWorker,
    readOnlyPreview = false,
    adminTestMode = false,
    adminApprovalAccess = false,
}: AgencyWorkerClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const workerPath = `/profile/agency/workers/${initialWorker.id}`;
    const initialName = useMemo(() => splitFullName(initialWorker.fullName), [initialWorker.fullName]);
    const initialFamily = useMemo(() => normalizeFamilyData(initialWorker.familyData), [initialWorker.familyData]);
    const originalCitizenship = initialWorker.originalCitizenship || initialWorker.citizenship;
    const [form, setForm] = useState({
        firstName: initialName.firstName,
        lastName: initialName.lastName,
        email: initialWorker.email,
        phone: initialWorker.phone,
        nationality: initialWorker.nationality,
        currentCountry: initialWorker.currentCountry,
        preferredJob: normalizePreferredJobValue(initialWorker.preferredJob, false),
        desiredCountries: normalizeDesiredCountryValues(initialWorker.desiredCountries || []),
        gender: initialWorker.gender,
        maritalStatus: initialWorker.maritalStatus,
        dateOfBirth: normalizeDateInput(initialWorker.dateOfBirth),
        birthCountry: initialWorker.birthCountry,
        birthCity: initialWorker.birthCity,
        citizenship: initialWorker.citizenship,
        originalCitizenshipSame: !originalCitizenship || originalCitizenship === initialWorker.citizenship,
        originalCitizenship,
        maidenName: initialWorker.maidenName,
        fatherName: initialWorker.fatherName,
        motherName: initialWorker.motherName,
        address: initialWorker.address,
        passportNumber: initialWorker.passportNumber,
        passportIssuedBy: initialWorker.passportIssuedBy,
        passportIssueDate: normalizeDateInput(initialWorker.passportIssueDate),
        passportExpiryDate: normalizeDateInput(initialWorker.passportExpiryDate),
        livesAbroad: normalizeBooleanAnswer(initialWorker.livesAbroad),
        previousVisas: normalizeBooleanAnswer(initialWorker.previousVisas),
    });
    const [hasSpouse, setHasSpouse] = useState(Boolean(initialFamily.spouse));
    const [spouseData, setSpouseData] = useState({
        first_name: initialFamily.spouse?.first_name || "",
        last_name: initialFamily.spouse?.last_name || "",
        dob: normalizeDateInput(initialFamily.spouse?.dob),
        birth_country: initialFamily.spouse?.birth_country || "",
        birth_city: initialFamily.spouse?.birth_city || "",
    });
    const [hasChildren, setHasChildren] = useState(Boolean(initialFamily.children && initialFamily.children.length > 0));
    const [children, setChildren] = useState<EditableChild[]>(
        initialFamily.children?.map((child) => ({
            first_name: child.first_name || "",
            last_name: child.last_name || "",
            dob: normalizeDateInput(child.dob),
        })) || []
    );
    const [saving, setSaving] = useState(false);
    const [paying, setPaying] = useState(false);
    const [approvalAction, setApprovalAction] = useState<"approve" | "revoke" | null>(null);
    const handledPaymentSessionsRef = useRef<Set<string>>(new Set());
    const handledPaymentCancellationRef = useRef(false);
    const entryFeeUnlockState = useMemo(() => getEntryFeeUnlockState({
        entry_fee_paid: initialWorker.paymentState === "paid",
        profile_completion: initialWorker.completion,
        admin_approved: initialWorker.adminApproved,
    }), [initialWorker.adminApproved, initialWorker.completion, initialWorker.paymentState]);
    const manualPaymentOverride = entryFeeUnlockState.manualOverride === true;
    const canStartEntryPayment = !readOnlyPreview && initialWorker.paymentState === "not_paid" && entryFeeUnlockState.allowed;
    const pendingAdminReview = entryFeeUnlockState.reason === "pending_admin_review";
    const needsCompletion = entryFeeUnlockState.reason === "needs_completion";
    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const todayIso = useMemo(() => formatDateInputValue(new Date()), []);
    const birthDateMinIso = useMemo(() => `${currentYear - 120}-01-01`, [currentYear]);
    const passportIssueMinIso = useMemo(() => `${currentYear - 20}-01-01`, [currentYear]);
    const passportExpiryMaxIso = useMemo(() => `${currentYear + 20}-12-31`, [currentYear]);
    const documentsInitialData = useMemo<AgencyWorkerDocumentsData>(() => ({
        workerId: initialWorker.id,
        profileId: initialWorker.profileId,
        verifiedDocuments: initialWorker.verifiedDocuments,
        documents: initialWorker.documents,
    }), [initialWorker.documents, initialWorker.id, initialWorker.profileId, initialWorker.verifiedDocuments]);

    useEffect(() => {
        const paymentState = searchParams.get("payment");
        if (paymentState !== "sandbox_success") {
            return;
        }

        toast.success("Sandbox payment completed. Worker is now marked as paid.");
        router.replace(workerPath);
        router.refresh();
    }, [router, searchParams, workerPath]);

    useEffect(() => {
        const paymentState = searchParams.get("payment");
        const sessionId = searchParams.get("session_id");
        if (adminTestMode || paymentState !== "success" || !sessionId || handledPaymentSessionsRef.current.has(sessionId)) return;
        handledPaymentSessionsRef.current.add(sessionId);
        let cancelled = false;

        async function confirmAgencyPayment() {
            setPaying(true);
            try {
                const response = await fetch("/api/stripe/confirm-session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Failed to confirm payment.");
                if (cancelled) return;
                if (data.state === "pending") toast.info("Payment is still processing. Refresh in a moment if needed.");
                else toast.success(data.message || "Payment confirmed and worker queue access activated.");
                router.replace(workerPath);
                router.refresh();
            } catch (error) {
                if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to confirm payment.");
            } finally {
                if (!cancelled) setPaying(false);
            }
        }

        void confirmAgencyPayment();
        return () => { cancelled = true; };
    }, [adminTestMode, router, searchParams, workerPath]);

    useEffect(() => {
        const paymentState = searchParams.get("payment");
        if (paymentState !== "cancelled" || handledPaymentCancellationRef.current) return;
        handledPaymentCancellationRef.current = true;
        toast.info("Payment was cancelled.");
        router.replace(workerPath);
    }, [router, searchParams, workerPath]);

    function updateField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function handleSave() {
        if (readOnlyPreview) {
            toast.info("Admin preview is read-only.");
            return;
        }
        const fullName = `${form.firstName} ${form.lastName}`.trim();
        if (!fullName) {
            toast.error("Worker first and last name are required.");
            return;
        }

        const familyData: AgencyFamilyData = {};
        if (hasSpouse && Object.values(spouseData).some((value) => hasText(value))) {
            familyData.spouse = {
                first_name: spouseData.first_name.trim() || null,
                last_name: spouseData.last_name.trim() || null,
                dob: spouseData.dob || null,
                birth_country: spouseData.birth_country.trim() || null,
                birth_city: spouseData.birth_city.trim() || null,
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

        setSaving(true);
        try {
            const response = await fetch(`/api/agency/workers/${initialWorker.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName,
                    email: form.email,
                    phone: form.phone,
                    nationality: form.nationality,
                    currentCountry: form.currentCountry,
                    preferredJob: form.preferredJob,
                    desiredCountries: form.desiredCountries,
                    gender: form.gender,
                    maritalStatus: form.maritalStatus,
                    dateOfBirth: form.dateOfBirth,
                    birthCountry: form.birthCountry,
                    birthCity: form.birthCity,
                    citizenship: form.citizenship,
                    originalCitizenship: form.originalCitizenshipSame ? form.citizenship : form.originalCitizenship,
                    maidenName: form.maidenName,
                    fatherName: form.fatherName,
                    motherName: form.motherName,
                    address: form.address,
                    familyData: Object.keys(familyData).length > 0 ? familyData : null,
                    passportNumber: form.passportNumber,
                    passportIssuedBy: form.passportIssuedBy,
                    passportIssueDate: form.passportIssueDate,
                    passportExpiryDate: form.passportExpiryDate,
                    livesAbroad: form.livesAbroad,
                    previousVisas: form.previousVisas,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || "Failed to save worker profile.");
                return;
            }
            toast.success("Worker profile updated.");
            if (data.reviewQueued) {
                toast.info("This worker is now waiting for admin review.");
            }
            router.refresh();
        } catch {
            toast.error("Failed to save worker profile.");
        } finally {
            setSaving(false);
        }
    }

    async function handleEntryFeePayment() {
        if (readOnlyPreview) {
            toast.info("Admin preview is read-only.");
            return;
        }
        if (!canStartEntryPayment) {
            toast.info(pendingAdminReview
                ? "This worker is waiting for admin approval before payment unlocks."
                : "Complete the worker profile and documents first.");
            return;
        }
        setPaying(true);
        try {
            const response = await fetch("/api/stripe/create-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "entry_fee", targetWorkerId: initialWorker.id, successPath: workerPath, cancelPath: workerPath }),
            });
            const data = await response.json();
            if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Failed to create checkout session.");
            window.location.assign(data.checkoutUrl);
        } catch (error) {
            setPaying(false);
            toast.error(error instanceof Error ? error.message : "Failed to start payment.");
        }
    }

    async function handleAdminApproval(action: "approve" | "revoke") {
        if (!adminApprovalAccess) {
            return;
        }

        setApprovalAction(action);
        try {
            const response = await fetch(`/api/admin/agency-workers/${initialWorker.id}/approval`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to update approval.");
            }
            toast.success(action === "approve" ? "Worker approved for payment." : "Worker approval revoked.");
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update approval.");
        } finally {
            setApprovalAction(null);
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#faf7ef_0%,#f4efe3_100%)] p-6 shadow-[0_30px_70px_-48px_rgba(15,23,42,0.35)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-3 inline-flex rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                            {readOnlyPreview ? "Admin preview" : initialWorker.claimed ? "Worker account ready" : "Agency-managed profile"}
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">{initialWorker.fullName}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                            Agencies can complete the same worker profile fields as workers. Email and phone stay optional unless you want this worker to receive notifications directly.
                        </p>
                    </div>
                    {readOnlyPreview ? (
                        <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700">
                            <ShieldAlert size={16} />
                            Read-only admin preview
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Worker Profile
                        </button>
                    )}
                </div>
            </section>

            {readOnlyPreview && (
                <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-950">
                    This is an admin preview. Worker fields stay read-only here, but approval controls remain available below.
                </div>
            )}

            <section className="grid gap-4 md:grid-cols-4">
                <SignalCard label="Completion" value={`${initialWorker.completion}%`} icon={<BadgeCheck size={18} />} />
                <SignalCard label="Documents" value={`${initialWorker.verifiedDocuments}/3 verified`} icon={<FileCheck2 size={18} />} />
                <SignalCard label="Payment" value={initialWorker.paymentLabel} icon={<CreditCard size={18} />} />
                <SignalCard label="Status" value={initialWorker.status} icon={<CircleAlert size={18} />} />
            </section>

            {!initialWorker.claimed && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    This worker is still managed directly by the agency. Finish the profile now, and add contact details only if the worker should receive notifications.
                </div>
            )}

            <section className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
                <fieldset disabled={readOnlyPreview} className="space-y-6">
                    <FormCard title="Worker Identity" description="Core worker profile data.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="First Name"><input className={inputClass} value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} /></Field>
                            <Field label="Last Name"><input className={inputClass} value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} /></Field>
                            <Field label="Nationality">
                                <AdaptiveSelect className={inputClass} value={form.nationality} onChange={(event) => updateField("nationality", event.target.value)} desktopSearchPlaceholder="Search nationality">
                                    <option value="">Select nationality</option>
                                    {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{getCountryDisplayLabel(country)}</option>)}
                                </AdaptiveSelect>
                            </Field>
                            <Field label="Date of Birth">
                                <NativeDateField
                                    min={birthDateMinIso}
                                    max={todayIso}
                                    inputClassName={inputClass}
                                    value={form.dateOfBirth}
                                    onChange={(value) => updateField("dateOfBirth", value)}
                                    disabled={readOnlyPreview || saving}
                                />
                            </Field>
                            <Field label="Gender">
                                <AdaptiveSelect className={inputClass} value={form.gender} onChange={(event) => updateField("gender", event.target.value)} desktopSearchThreshold={999}>
                                    <option value="">Select gender</option>
                                    {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </AdaptiveSelect>
                            </Field>
                            <Field label="Marital Status">
                                <AdaptiveSelect className={inputClass} value={form.maritalStatus} onChange={(event) => updateField("maritalStatus", event.target.value)} desktopSearchThreshold={999}>
                                    <option value="">Select marital status</option>
                                    {MARITAL_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                                </AdaptiveSelect>
                            </Field>
                        </div>
                    </FormCard>

                    <FormCard title="Contact & Notifications" description="Optional worker contact information.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field
                                label="Email"
                                helper={initialWorker.claimed
                                    ? "This worker already has their own login email."
                                    : "Optional. Add email only if this worker should receive email notifications."}
                            >
                                <input
                                    className={`${inputClass} ${initialWorker.claimed ? "cursor-not-allowed bg-[#f5f5f4] text-[#78716c]" : ""}`}
                                    type="email"
                                    value={form.email}
                                    disabled={initialWorker.claimed}
                                    onChange={(event) => updateField("email", event.target.value)}
                                />
                            </Field>
                            <Field label="Phone Number (WhatsApp)" helper="Optional. Add phone only if this worker should receive WhatsApp or phone notifications. Do not type '0' before the number.">
                                <InternationalPhoneField
                                    value={form.phone}
                                    onChange={(phone) => updateField("phone", phone)}
                                    inputClassName={inputClass}
                                    disabled={readOnlyPreview || saving}
                                />
                            </Field>
                            <Field label="Current Country">
                                <AdaptiveSelect className={inputClass} value={form.currentCountry} onChange={(event) => updateField("currentCountry", event.target.value)} desktopSearchPlaceholder="Search country">
                                    <option value="">Select current country</option>
                                    {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{getCountryDisplayLabel(country)}</option>)}
                                </AdaptiveSelect>
                            </Field>
                            <Field label="Address"><input className={inputClass} value={form.address} onChange={(event) => updateField("address", event.target.value)} /></Field>
                        </div>
                    </FormCard>

                    <FormCard title="Citizenship & Civil Data" description="Fields used for matching and visa paperwork.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Birth Country">
                                <AdaptiveSelect className={inputClass} value={form.birthCountry} onChange={(event) => updateField("birthCountry", event.target.value)} desktopSearchPlaceholder="Search birth country">
                                    <option value="">Select birth country</option>
                                    {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{getCountryDisplayLabel(country)}</option>)}
                                </AdaptiveSelect>
                            </Field>
                            <Field label="Birth City"><input className={inputClass} value={form.birthCity} onChange={(event) => updateField("birthCity", event.target.value)} /></Field>
                            <Field label="Citizenship">
                                <AdaptiveSelect className={inputClass} value={form.citizenship} onChange={(event) => updateField("citizenship", event.target.value)} desktopSearchPlaceholder="Search citizenship">
                                    <option value="">Select citizenship</option>
                                    {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{getCountryDisplayLabel(country)}</option>)}
                                </AdaptiveSelect>
                            </Field>
                            <Field label="Original Citizenship" helper="Leave the checkbox on if it is the same as current citizenship.">
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 text-sm text-[#57534e]">
                                        <input type="checkbox" checked={form.originalCitizenshipSame} onChange={(event) => updateField("originalCitizenshipSame", event.target.checked)} className="h-4 w-4 rounded border-[#d6d3d1] text-[#111111] focus:ring-0" />
                                        Same as current citizenship
                                    </label>
                                    {!form.originalCitizenshipSame && (
                                        <AdaptiveSelect className={inputClass} value={form.originalCitizenship} onChange={(event) => updateField("originalCitizenship", event.target.value)} desktopSearchPlaceholder="Search original citizenship">
                                            <option value="">Select original citizenship</option>
                                            {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{getCountryDisplayLabel(country)}</option>)}
                                        </AdaptiveSelect>
                                    )}
                                </div>
                            </Field>
                            <Field label="Maiden Name" helper="Optional.">
                                <input className={inputClass} value={form.maidenName} onChange={(event) => updateField("maidenName", event.target.value)} />
                            </Field>
                            <Field label="Father's First Name" helper="Optional.">
                                <input className={inputClass} value={form.fatherName} onChange={(event) => updateField("fatherName", event.target.value)} />
                            </Field>
                            <Field label="Mother's First Name" helper="Optional.">
                                <input className={inputClass} value={form.motherName} onChange={(event) => updateField("motherName", event.target.value)} />
                            </Field>
                        </div>
                    </FormCard>

                    <FormCard title="Job Preferences" description="Worker job target and country preferences.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Preferred Job">
                                <AdaptiveSelect
                                    className={inputClass}
                                    value={normalizePreferredJobValue(form.preferredJob, false)}
                                    onChange={(event) => updateField("preferredJob", event.target.value)}
                                    desktopSearchPlaceholder="Search industries"
                                >
                                    <option value="">Select industries</option>
                                    <option value={ALL_OPTION_VALUE}>All industries</option>
                                    {industryOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </AdaptiveSelect>
                            </Field>
                        </div>
                        <div className="mt-5">
                            <div className={labelClass}>Desired Countries</div>
                            <NativeDestinationSelectField
                                allLabel="All destinations"
                                chipClassName="inline-flex items-center gap-2 rounded-full border border-[#e7e0d4] bg-white px-3 py-1.5 text-xs font-semibold text-[#18181b]"
                                clearButtonClassName="inline-flex items-center rounded-full border border-[#e7e0d4] bg-[#faf8f3] px-3 py-1.5 text-xs font-semibold text-[#6b6357] transition hover:bg-white"
                                emptyStateClassName="text-xs leading-relaxed text-[#6b6357]"
                                optionLabel="Select destinations"
                                options={destinationOptions}
                                removeButtonClassName="transition hover:border-[#d8cfbf] hover:bg-[#faf8f3]"
                                selectClassName={inputClass}
                                values={normalizeDesiredCountryValues(form.desiredCountries)}
                                onChange={(values) => updateField("desiredCountries", values)}
                            />
                        </div>
                    </FormCard>

                    <FormCard title="Family Information" description="Complete spouse and children data when relevant.">
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] p-4">
                                <label className="flex items-center gap-3 text-sm font-medium text-[#18181b]">
                                    <input type="checkbox" checked={hasSpouse} onChange={(event) => setHasSpouse(event.target.checked)} className="h-4 w-4 rounded border-[#d6d3d1] text-[#111111] focus:ring-0" />
                                    This worker has a spouse or partner
                                </label>
                                {hasSpouse && (
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <Field label="Spouse First Name"><input className={inputClass} value={spouseData.first_name} onChange={(event) => setSpouseData((current) => ({ ...current, first_name: event.target.value }))} /></Field>
                                        <Field label="Spouse Last Name"><input className={inputClass} value={spouseData.last_name} onChange={(event) => setSpouseData((current) => ({ ...current, last_name: event.target.value }))} /></Field>
                                        <Field label="Spouse Date of Birth">
                                            <NativeDateField
                                                min={birthDateMinIso}
                                                max={todayIso}
                                                inputClassName={inputClass}
                                                value={spouseData.dob}
                                                onChange={(value) => setSpouseData((current) => ({ ...current, dob: value }))}
                                                disabled={readOnlyPreview || saving}
                                            />
                                        </Field>
                                        <Field label="Spouse Birth Country">
                                            <AdaptiveSelect className={inputClass} value={spouseData.birth_country} onChange={(event) => setSpouseData((current) => ({ ...current, birth_country: event.target.value }))} desktopSearchPlaceholder="Search birth country">
                                                <option value="">Select birth country</option>
                                                {WORLD_COUNTRIES.map((country) => <option key={country} value={country}>{getCountryDisplayLabel(country)}</option>)}
                                            </AdaptiveSelect>
                                        </Field>
                                        <Field label="Spouse Birth City"><input className={inputClass} value={spouseData.birth_city} onChange={(event) => setSpouseData((current) => ({ ...current, birth_city: event.target.value }))} /></Field>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] p-4">
                                <label className="flex items-center gap-3 text-sm font-medium text-[#18181b]">
                                    <input
                                        type="checkbox"
                                        checked={hasChildren}
                                        onChange={(event) => {
                                            setHasChildren(event.target.checked);
                                            if (event.target.checked && children.length === 0) setChildren([{ first_name: "", last_name: "", dob: "" }]);
                                        }}
                                        className="h-4 w-4 rounded border-[#d6d3d1] text-[#111111] focus:ring-0"
                                    />
                                    This worker has children
                                </label>
                                {hasChildren && (
                                    <div className="mt-4 space-y-3">
                                        {children.map((child, index) => (
                                            <div key={`${index}-${child.first_name}-${child.last_name}`} className="rounded-2xl border border-white bg-white p-4">
                                                <div className="grid gap-4 md:grid-cols-3">
                                                    <Field label={`Child ${index + 1} First Name`}><input className={inputClass} value={child.first_name} onChange={(event) => setChildren((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, first_name: event.target.value } : item))} /></Field>
                                                    <Field label="Last Name"><input className={inputClass} value={child.last_name} onChange={(event) => setChildren((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, last_name: event.target.value } : item))} /></Field>
                                                    <Field label="Date of Birth">
                                                        <NativeDateField
                                                            min={birthDateMinIso}
                                                            max={todayIso}
                                                            inputClassName={inputClass}
                                                            value={child.dob}
                                                            onChange={(value) => setChildren((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, dob: value } : item))}
                                                            disabled={readOnlyPreview || saving}
                                                        />
                                                    </Field>
                                                </div>
                                            </div>
                                        ))}
                                        {children.length < 5 && (
                                            <button type="button" onClick={() => setChildren((current) => [...current, { first_name: "", last_name: "", dob: "" }])} className="inline-flex items-center gap-2 rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:bg-[#f5f5f4]">
                                                Add Child
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </FormCard>

                    <FormCard title="Passport & Travel" description="Passport and travel history used in verification and visa steps.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Passport Number"><input className={inputClass} value={form.passportNumber} onChange={(event) => updateField("passportNumber", event.target.value)} /></Field>
                            <Field label="Passport Issued By"><input className={inputClass} value={form.passportIssuedBy} onChange={(event) => updateField("passportIssuedBy", event.target.value)} /></Field>
                            <Field label="Passport Issue Date">
                                <NativeDateField
                                    min={passportIssueMinIso}
                                    max={todayIso}
                                    inputClassName={inputClass}
                                    value={form.passportIssueDate}
                                    onChange={(value) => updateField("passportIssueDate", value)}
                                    disabled={readOnlyPreview || saving}
                                />
                            </Field>
                            <Field label="Passport Expiry Date">
                                <NativeDateField
                                    min={todayIso}
                                    max={passportExpiryMaxIso}
                                    inputClassName={inputClass}
                                    value={form.passportExpiryDate}
                                    onChange={(value) => updateField("passportExpiryDate", value)}
                                    disabled={readOnlyPreview || saving}
                                />
                            </Field>
                            <Field label="Do you live outside your home country?">
                                <AdaptiveSelect className={inputClass} value={form.livesAbroad} onChange={(event) => updateField("livesAbroad", event.target.value)} desktopSearchThreshold={999}>
                                    <option value="">Select answer</option>
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                </AdaptiveSelect>
                            </Field>
                            <Field label="Have you had any visas in the last 3 years?">
                                <AdaptiveSelect className={inputClass} value={form.previousVisas} onChange={(event) => updateField("previousVisas", event.target.value)} desktopSearchThreshold={999}>
                                    <option value="">Select answer</option>
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                </AdaptiveSelect>
                            </Field>
                        </div>
                    </FormCard>
                </fieldset>

                <div className="space-y-6">
                    <aside className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <h2 className="text-lg font-semibold text-[#18181b]">Worker Access</h2>
                        <div className="mt-4 rounded-2xl border border-[#f1ede5] bg-[#faf8f3] px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a29e]">Current state</div>
                            <div className="mt-1 text-sm font-semibold text-[#18181b]">{initialWorker.accessLabel}</div>
                            <p className="mt-2 text-sm text-[#57534e]">
                                {initialWorker.claimed
                                    ? "This worker already has their own platform account."
                                    : "This worker is still managed directly by the agency. A separate worker login can be connected later if needed."}
                            </p>
                        </div>
                    </aside>

                    <aside className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <h2 className="text-lg font-semibold text-[#18181b]">Payment & Queue</h2>
                        <div className="mt-4 rounded-2xl border border-[#f1ede5] bg-[#faf8f3] px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a29e]">Entry fee</div>
                            <div className="mt-1 text-sm font-semibold text-[#18181b]">{initialWorker.paymentLabel}</div>
                            <p className="mt-2 text-sm text-[#57534e]">
                                {pendingAdminReview
                                    ? "The profile and required documents are complete and waiting for admin approval before Job Finder payment unlocks."
                                    : needsCompletion
                                        ? "Complete all required worker fields and documents to send this profile for admin review."
                                        : manualPaymentOverride
                                            ? "Admin already unlocked the $9 Job Finder checkout for this worker. Remaining profile details can still be finished later."
                                            : "Use this to start the $9 Job Finder checkout for this worker."}
                            </p>
                        </div>
                        {!readOnlyPreview && canStartEntryPayment && (
                            <button type="button" onClick={handleEntryFeePayment} disabled={paying} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-70">
                                {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                                Pay $9 Job Finder
                            </button>
                        )}
                        {!readOnlyPreview && initialWorker.paymentState === "pending" && (
                            <p className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                Checkout is already open{initialWorker.paymentPendingUntil ? ` until ${new Date(initialWorker.paymentPendingUntil).toLocaleDateString("en-GB")}` : ""}.
                            </p>
                        )}
                        {!readOnlyPreview && pendingAdminReview && (
                            <p className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                This worker is complete and is now waiting for admin approval.
                            </p>
                        )}
                        {!readOnlyPreview && needsCompletion && (
                            <p className="mt-4 rounded-2xl border border-[#e7e5e4] bg-[#fafaf9] px-4 py-3 text-sm text-[#57534e]">
                                Payment stays locked until the profile, required documents, and admin approval are complete.
                            </p>
                        )}
                        {readOnlyPreview && <p className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Payments are disabled in admin preview.</p>}
                        {initialWorker.paymentState === "paid" && <p className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16} />Job Finder access is active for this worker.</p>}
                    </aside>

                    {adminApprovalAccess ? (
                        <aside className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                            <h2 className="text-lg font-semibold text-[#18181b]">Admin Approval</h2>
                            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                                initialWorker.adminApproved
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : initialWorker.completion === 100
                                        ? "border-blue-200 bg-blue-50 text-blue-800"
                                        : "border-amber-200 bg-amber-50 text-amber-900"
                            }`}>
                                {initialWorker.adminApproved
                                    ? manualPaymentOverride
                                        ? "Payment was unlocked manually by admin before this profile was fully complete."
                                        : "This worker is already approved for payment."
                                    : initialWorker.completion === 100
                                        ? "This profile is ready for your approval."
                                        : "Profile requirements are still missing, but admin can still unlock payment manually."}
                            </div>
                            <div className="mt-4 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handleAdminApproval(initialWorker.adminApproved ? "revoke" : "approve")}
                                    disabled={approvalAction !== null}
                                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                        initialWorker.adminApproved
                                            ? "bg-[#b91c1c] hover:bg-[#991b1b]"
                                            : "bg-[#111111] hover:bg-[#2b2b2b]"
                                    }`}
                                >
                                    {approvalAction ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {initialWorker.adminApproved ? "Revoke approval" : "Approve for payment"}
                                </button>
                                {!initialWorker.adminApproved && initialWorker.completion < 100 ? (
                                    <p className="text-xs font-medium text-amber-900">
                                        Manual admin override can unlock checkout even before this profile reaches 100%.
                                    </p>
                                ) : null}
                            </div>
                        </aside>
                    ) : null}

                    <aside id="documents" className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <h2 className="text-lg font-semibold text-[#18181b]">Missing Fields</h2>
                        {initialWorker.missingFields.length === 0 ? <p className="mt-3 text-sm text-emerald-700">This worker profile is currently complete.</p> : (
                            <ul className="mt-4 space-y-2 text-sm text-[#57534e]">
                                {initialWorker.missingFields.slice(0, 12).map((field) => <li key={field} className="rounded-2xl border border-[#f1ede5] bg-[#faf8f3] px-3 py-2">{field}</li>)}
                            </ul>
                        )}
                    </aside>

                    <div id="documents">
                        <AgencyWorkerDocumentsPanel
                            workerId={initialWorker.id}
                            initialData={documentsInitialData}
                            readOnlyPreview={readOnlyPreview}
                            adminTestMode={adminTestMode}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

function SignalCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-3xl border border-[#e6e6e1] bg-white px-4 py-4 shadow-[0_16px_35px_-34px_rgba(15,23,42,0.35)]">
            <div className="mb-3 flex items-center justify-between text-[#71717a]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
                {icon}
            </div>
            <div className="text-xl font-semibold text-[#18181b]">{value}</div>
        </div>
    );
}

function FormCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-[#18181b]">{title}</h2>
                <p className="mt-1 text-sm text-[#71717a]">{description}</p>
            </div>
            {children}
        </section>
    );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className={labelClass}>{label}</span>
            {children}
            {helper ? <p className="mt-2 text-xs leading-relaxed text-[#78716c]">{helper}</p> : null}
        </label>
    );
}
