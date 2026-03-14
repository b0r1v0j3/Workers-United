"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ALL_OPTION_VALUE,
    NativeDestinationSelectField,
    normalizeDesiredCountryValues,
    normalizePreferredJobValue,
} from "@/components/forms/PreferenceSheetField";
import InternationalPhoneField from "@/components/forms/InternationalPhoneField";
import NativeDateField from "@/components/forms/NativeDateField";
import { getCountryDisplayLabel } from "@/lib/country-display";
import { WORLD_COUNTRIES, WORKER_INDUSTRIES, MARITAL_STATUSES, GENDER_OPTIONS, EUROPEAN_COUNTRIES } from "@/lib/constants";
import { logActivity, logError } from "@/lib/activityLogger";
import { loadCanonicalWorkerRecord } from "@/lib/workers";

interface Profile {
    id: string;
    email: string;
    full_name: string;
    user_type: string;
}

interface WorkerRecord {
    id: string;
    nationality: string;
    date_of_birth: string;
    phone: string;
    address: string;
    current_country: string;
    preferred_job: string;
    desired_countries: string[];
    desired_industries: string[];
    birth_country: string;
    birth_city: string;
    citizenship: string;
    original_citizenship: string;
    maiden_name: string;
    father_name: string;
    mother_name: string;
    marital_status: string;
    gender: string;
    family_data: any;
    passport_number: string;
    passport_issued_by: string;
    passport_issue_date: string;
    passport_expiry_date: string;
    lives_abroad: string;
    previous_visas: string;
}

interface WorkerRecordLookupRow {
    id: string;
    updated_at?: string | null;
    entry_fee_paid?: boolean | null;
    job_search_active?: boolean | null;
    queue_joined_at?: string | null;
    phone?: string | null;
    nationality?: string | null;
    current_country?: string | null;
    preferred_job?: string | null;
    status?: string | null;
}

const currentYear = new Date().getFullYear();

// Empty child template
const EMPTY_CHILD = { last_name: "", first_name: "", dobDay: "", dobMonth: "", dobYear: "" };
const workerIndustryOptions = [
    ...WORKER_INDUSTRIES.filter((industry) => industry !== ALL_OPTION_VALUE).map((industry) => ({
        value: industry,
        label: industry,
    })),
];
const destinationPreferenceOptions = EUROPEAN_COUNTRIES.map((country) => ({
    value: country,
    label: getCountryDisplayLabel(country),
}));

function parseDateParts(dateStr: string | null | undefined) {
    if (!dateStr) return null;

    const normalized = dateStr.split("T")[0];
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const [, year, month, day] = match;
        return {
            day: `${Number(day)}`,
            month: `${Number(month)}`,
            year,
        };
    }

    const fallback = new Date(dateStr);
    if (Number.isNaN(fallback.getTime())) return null;
    return {
        day: fallback.getUTCDate().toString(),
        month: (fallback.getUTCMonth() + 1).toString(),
        year: fallback.getUTCFullYear().toString(),
    };
}

// Helper to parse YYYY-MM-DD into { prefixDay, prefixMonth, prefixYear }
function parseDateToComponents(dateStr: string | null | undefined, prefix: string) {
    const parsed = parseDateParts(dateStr);
    if (!parsed) return { [`${prefix}Day`]: "", [`${prefix}Month`]: "", [`${prefix}Year`]: "" };
    return {
        [`${prefix}Day`]: parsed.day,
        [`${prefix}Month`]: parsed.month,
        [`${prefix}Year`]: parsed.year,
    };
}

function buildDateValue(day: string, month: string, year: string) {
    if (!day || !month || !year) {
        return "";
    }

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractDateParts(dateStr: string) {
    const parsed = parseDateParts(dateStr);
    return {
        day: parsed?.day || "",
        month: parsed?.month || "",
        year: parsed?.year || "",
    };
}

function formatDateInputValue(date: Date) {
    const localDate = new Date(date);
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    return localDate.toISOString().slice(0, 10);
}

export default function ProfilePage({
    readOnlyPreview = false,
    adminTestMode = false,
    initialProfile = null,
    initialWorkerRecord = null,
}: {
    readOnlyPreview?: boolean;
    adminTestMode?: boolean;
    initialProfile?: Profile | null;
    initialWorkerRecord?: WorkerRecord | null;
}) {
    const supabase = useMemo(() => createClient(), []);
    const searchParams = useSearchParams();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [workerRecord, setWorkerRecord] = useState<WorkerRecord | null>(null);
    const [loading, setLoading] = useState(() => !((readOnlyPreview || adminTestMode) && initialProfile));
    const [saving, setSaving] = useState(false);
    // Removed error/success state as we use Toast now

    // Form state
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        nationality: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",
        phone: "",
        address: "",
        current_country: "",
        preferred_job: "",
        desired_countries: [] as string[],
        // New visa fields
        birth_country: "",
        birth_city: "",
        citizenship: "",
        original_citizenship_same: true,
        original_citizenship: "",
        maiden_name: "",
        father_name: "",
        mother_name: "",
        marital_status: "",
        gender: "",
        // Passport & travel
        passport_number: "",
        passport_issued_by: "",
        passport_issue_day: "",
        passport_issue_month: "",
        passport_issue_year: "",
        passport_expiry_day: "",
        passport_expiry_month: "",
        passport_expiry_year: "",
        lives_abroad: "",
        previous_visas: "",
    });

    // Family data (separate state for complex nested data)
    const [hasSpouse, setHasSpouse] = useState(false);
    const [spouseData, setSpouseData] = useState({
        first_name: "",
        last_name: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",
        birth_country: "",
        birth_city: "",
    });
    const [hasChildren, setHasChildren] = useState(false);
    const [children, setChildren] = useState<Array<{ last_name: string; first_name: string; dobDay: string; dobMonth: string; dobYear: string }>>([]);
    const todayIso = useMemo(() => formatDateInputValue(new Date()), []);
    const birthDateMinIso = useMemo(() => `${currentYear - 120}-01-01`, []);
    const passportIssueMinIso = useMemo(() => `${currentYear - 20}-01-01`, []);
    const passportExpiryMaxIso = useMemo(() => `${currentYear + 20}-12-31`, []);
    const dateOfBirthValue = buildDateValue(formData.dobDay, formData.dobMonth, formData.dobYear);
    const passportIssueDateValue = buildDateValue(formData.passport_issue_day, formData.passport_issue_month, formData.passport_issue_year);
    const passportExpiryDateValue = buildDateValue(formData.passport_expiry_day, formData.passport_expiry_month, formData.passport_expiry_year);
    const spouseDateOfBirthValue = buildDateValue(spouseData.dobDay, spouseData.dobMonth, spouseData.dobYear);

    const overviewHref = useMemo(() => {
        const inspect = searchParams.get("inspect");
        return inspect ? `/profile/worker?inspect=${inspect}` : "/profile/worker";
    }, [searchParams]);

    const resetFamilyState = useCallback(() => {
        setHasSpouse(false);
        setSpouseData({
            first_name: "",
            last_name: "",
            dobDay: "",
            dobMonth: "",
            dobYear: "",
            birth_country: "",
            birth_city: "",
        });
        setHasChildren(false);
        setChildren([]);
    }, []);

    const applyLoadedData = useCallback((profileData: Profile | null, workerRecordData: WorkerRecord | null) => {
        setProfile(profileData);

        if (profileData) {
            const nameParts = (profileData.full_name || "").trim().split(" ");
            const first_name = nameParts[0] || "";
            const last_name = nameParts.slice(1).join(" ") || "";
            setFormData(prev => ({ ...prev, first_name, last_name }));
        }

        setWorkerRecord(workerRecordData);
        if (!workerRecordData) {
            resetFamilyState();
            return;
        }

        const dobParts = parseDateToComponents(workerRecordData.date_of_birth, "dob");
        const origSame = !workerRecordData.original_citizenship ||
            workerRecordData.original_citizenship === workerRecordData.citizenship;

        setFormData(prev => ({
            ...prev,
            nationality: workerRecordData.nationality || "",
            dobDay: dobParts.dobDay || "",
            dobMonth: dobParts.dobMonth || "",
            dobYear: dobParts.dobYear || "",
            phone: workerRecordData.phone || "",
            address: workerRecordData.address || "",
            current_country: workerRecordData.current_country || "",
            preferred_job: normalizePreferredJobValue(workerRecordData.preferred_job, false),
            desired_countries: normalizeDesiredCountryValues(workerRecordData.desired_countries || []),
            birth_country: workerRecordData.birth_country || "",
            birth_city: workerRecordData.birth_city || "",
            citizenship: workerRecordData.citizenship || "",
            original_citizenship_same: origSame,
            original_citizenship: workerRecordData.original_citizenship || "",
            maiden_name: workerRecordData.maiden_name || "",
            father_name: workerRecordData.father_name || "",
            mother_name: workerRecordData.mother_name || "",
            marital_status: workerRecordData.marital_status || "",
            gender: workerRecordData.gender || "",
            passport_number: workerRecordData.passport_number || "",
            passport_issued_by: workerRecordData.passport_issued_by || "",
            ...parseDateToComponents(workerRecordData.passport_issue_date, "passport_issue"),
            ...parseDateToComponents(workerRecordData.passport_expiry_date, "passport_expiry"),
            lives_abroad: workerRecordData.lives_abroad || "",
            previous_visas: workerRecordData.previous_visas || "",
        }));

        resetFamilyState();
        if (workerRecordData.family_data) {
            const fd = workerRecordData.family_data;
            if (fd.spouse) {
                setHasSpouse(true);
                const sp = fd.spouse;
                const spParsed = sp.dob ? parseDateToComponents(sp.dob, "dob") : { dobDay: "", dobMonth: "", dobYear: "" };
                setSpouseData({
                    first_name: sp.first_name || "",
                    last_name: sp.last_name || "",
                    dobDay: spParsed.dobDay || "",
                    dobMonth: spParsed.dobMonth || "",
                    dobYear: spParsed.dobYear || "",
                    birth_country: sp.birth_country || "",
                    birth_city: sp.birth_city || "",
                });
            }
            if (fd.children && fd.children.length > 0) {
                setHasChildren(true);
                setChildren(fd.children.map((c: any) => {
                    const cp = c.dob ? parseDateToComponents(c.dob, "dob") : { dobDay: "", dobMonth: "", dobYear: "" };
                    return {
                        first_name: c.first_name || "",
                        last_name: c.last_name || "",
                        dobDay: cp.dobDay || "",
                        dobMonth: cp.dobMonth || "",
                        dobYear: cp.dobYear || "",
                    };
                }));
            }
        }
    }, [resetFamilyState]);

    const fetchProfile = useCallback(async () => {
        try {
            if ((readOnlyPreview || adminTestMode) && initialProfile) {
                applyLoadedData(initialProfile, initialWorkerRecord);
                return;
            }

            if (adminTestMode) {
                const response = await fetch("/api/admin/test-personas/worker", { cache: "no-store" });
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || "Failed to load worker sandbox.");
                }
                applyLoadedData(payload.profile, payload.worker);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            const { data: workerRecordData, error: workerRecordError } = await loadCanonicalWorkerRecord<WorkerRecord>(
                supabase,
                user.id,
                "*"
            );
            if (workerRecordError) {
                throw new Error(workerRecordError.message);
            }
            applyLoadedData(profileData, workerRecordData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [adminTestMode, applyLoadedData, initialProfile, initialWorkerRecord, readOnlyPreview, supabase]);

    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (readOnlyPreview) {
            toast.error("Admin preview is read-only.");
            return;
        }
        setSaving(true);
        // Removed setError/setSuccess

        try {
            // Validate phone format for WhatsApp compatibility
            if (formData.phone && !/^\+\d{7,15}$/.test(formData.phone.replace(/[\s\-()]/g, ''))) {
                throw new Error("Phone number must start with + and country code (e.g., +381641234567)");
            }

            const full_name = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();

            // Combine DOB
            let dateOfBirth: string | null = null;
            if (formData.dobDay && formData.dobMonth && formData.dobYear) {
                const month = formData.dobMonth.padStart(2, '0');
                const day = formData.dobDay.padStart(2, '0');
                dateOfBirth = `${formData.dobYear}-${month}-${day}`;
            }

            // Build family_data JSON
            const familyData: any = {};
            if (hasSpouse) {
                let spouseDob: string | null = null;
                if (spouseData.dobDay && spouseData.dobMonth && spouseData.dobYear) {
                    spouseDob = `${spouseData.dobYear}-${spouseData.dobMonth.padStart(2, '0')}-${spouseData.dobDay.padStart(2, '0')}`;
                }
                familyData.spouse = {
                    first_name: spouseData.first_name,
                    last_name: spouseData.last_name,
                    dob: spouseDob,
                    birth_country: spouseData.birth_country,
                    birth_city: spouseData.birth_city,
                };
            }
            if (hasChildren && children.length > 0) {
                familyData.children = children.map(c => {
                    let childDob: string | null = null;
                    if (c.dobDay && c.dobMonth && c.dobYear) {
                        childDob = `${c.dobYear}-${c.dobMonth.padStart(2, '0')}-${c.dobDay.padStart(2, '0')}`;
                    }
                    return { first_name: c.first_name, last_name: c.last_name, dob: childDob };
                });
            }

            // Build passport dates
            let passportIssueDate: string | null = null;
            if (formData.passport_issue_day && formData.passport_issue_month && formData.passport_issue_year) {
                passportIssueDate = `${formData.passport_issue_year}-${formData.passport_issue_month.padStart(2, '0')}-${formData.passport_issue_day.padStart(2, '0')}`;
            }
            let passportExpiryDate: string | null = null;
            if (formData.passport_expiry_day && formData.passport_expiry_month && formData.passport_expiry_year) {
                passportExpiryDate = `${formData.passport_expiry_year}-${formData.passport_expiry_month.padStart(2, '0')}-${formData.passport_expiry_day.padStart(2, '0')}`;
            }

            const workerRecordUpdates = {
                nationality: formData.nationality || null,
                date_of_birth: dateOfBirth,
                phone: formData.phone ? formData.phone.replace(/[\s\-()]/g, '') : null,
                address: formData.address || null,
                current_country: formData.current_country || null,
                preferred_job: formData.preferred_job || null,
                desired_countries: formData.desired_countries && formData.desired_countries.length > 0 ? formData.desired_countries : null,
                // New fields
                birth_country: formData.birth_country || null,
                birth_city: formData.birth_city || null,
                citizenship: formData.citizenship || null,
                original_citizenship: formData.original_citizenship_same
                    ? (formData.citizenship || null)
                    : (formData.original_citizenship || null),
                maiden_name: formData.maiden_name || null,
                father_name: formData.father_name || null,
                mother_name: formData.mother_name || null,
                marital_status: formData.marital_status || null,
                gender: formData.gender || null,
                family_data: (Object.keys(familyData).length > 0) ? familyData : null,
                passport_number: formData.passport_number || null,
                passport_issued_by: formData.passport_issued_by || null,
                passport_issue_date: passportIssueDate,
                passport_expiry_date: passportExpiryDate,
                lives_abroad: formData.lives_abroad || null,
                previous_visas: formData.previous_visas || null,
            };

            if (adminTestMode) {
                const response = await fetch("/api/admin/test-personas/worker", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fullName: full_name,
                        email: profile?.email || "",
                        phone: formData.phone ? formData.phone.replace(/[\s\-()]/g, '') : null,
                        nationality: formData.nationality || null,
                        currentCountry: formData.current_country || null,
                        preferredJob: formData.preferred_job || null,
                        desiredCountries: formData.desired_countries,
                        dateOfBirth,
                        birthCountry: formData.birth_country || null,
                        birthCity: formData.birth_city || null,
                        citizenship: formData.citizenship || null,
                        originalCitizenship: formData.original_citizenship_same
                            ? (formData.citizenship || null)
                            : (formData.original_citizenship || null),
                        maidenName: formData.maiden_name || null,
                        fatherName: formData.father_name || null,
                        motherName: formData.mother_name || null,
                        maritalStatus: formData.marital_status || null,
                        gender: formData.gender || null,
                        address: formData.address || null,
                        familyData: (Object.keys(familyData).length > 0) ? familyData : null,
                        passportNumber: formData.passport_number || null,
                        passportIssuedBy: formData.passport_issued_by || null,
                        passportIssueDate,
                        passportExpiryDate,
                        livesAbroad: formData.lives_abroad || null,
                        previousVisas: formData.previous_visas || null,
                    }),
                });
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || "Failed to save sandbox worker profile.");
                }
                applyLoadedData(payload.profile, payload.worker);
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Not authenticated");

                const { error: profileErr } = await supabase
                    .from("profiles")
                    .update({ full_name })
                    .eq("id", user.id);
                if (profileErr) throw new Error(profileErr.message);

                if (workerRecord) {
                    const { error: updateErr } = await supabase
                        .from("worker_onboarding")
                        .update(workerRecordUpdates)
                        .eq("id", workerRecord.id);
                    if (updateErr) throw new Error(updateErr.message);
                } else {
                    const { data: existingWorkerRecord, error: existingWorkerRecordError } = await loadCanonicalWorkerRecord<WorkerRecordLookupRow>(
                        supabase,
                        user.id,
                        "id, updated_at, entry_fee_paid, job_search_active, queue_joined_at, phone, nationality, current_country, preferred_job, status"
                    );

                    if (existingWorkerRecordError) {
                        throw new Error(existingWorkerRecordError.message);
                    }

                    if (existingWorkerRecord?.id) {
                        const { error: recoveredUpdateErr } = await supabase
                            .from("worker_onboarding")
                            .update(workerRecordUpdates)
                            .eq("id", existingWorkerRecord.id);
                        if (recoveredUpdateErr) throw new Error(recoveredUpdateErr.message);
                    } else {
                        const { error: insertErr } = await supabase
                            .from("worker_onboarding")
                            .insert({
                                profile_id: user.id,
                                ...workerRecordUpdates,
                            });
                        if (insertErr) throw new Error(insertErr.message);
                    }
                }

                // Sync phone to Supabase Auth so it appears in Auth dashboard
                const cleanPhone = formData.phone ? formData.phone.replace(/[\s\-()]/g, '') : null;
                if (cleanPhone) {
                    await supabase.auth.updateUser({
                        data: { phone: cleanPhone }
                    });
                }
            }

            logActivity("profile_saved", "profile", { is_new: !workerRecord, fields_filled: Object.keys(workerRecordUpdates).filter(k => (workerRecordUpdates as Record<string, unknown>)[k] != null).length });
            toast.success("Profile saved successfully!");
            if (!adminTestMode) {
                await fetchProfile();

                // Check if profile just hit 100% and send notifications
                try {
                    const completionRes = await fetch("/api/check-profile-completion", { method: "POST" });
                    const completionData = await completionRes.json();
                    if (completionData.notificationSent) {
                        toast.success("Congratulations! Your profile is 100% complete. Check your email for next steps!", { duration: 8000 });
                    }
                } catch {
                    // Non-critical — don't block the save flow
                }
            }
        } catch (err) {
            logError("profile_save_failed", "profile", err);
            toast.error(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const updateDobParts = (value: string) => {
        const parts = extractDateParts(value);
        setFormData(prev => ({ ...prev, dobDay: parts.day, dobMonth: parts.month, dobYear: parts.year }));
    };

    const updatePassportIssueParts = (value: string) => {
        const parts = extractDateParts(value);
        setFormData(prev => ({
            ...prev,
            passport_issue_day: parts.day,
            passport_issue_month: parts.month,
            passport_issue_year: parts.year,
        }));
    };

    const updatePassportExpiryParts = (value: string) => {
        const parts = extractDateParts(value);
        setFormData(prev => ({
            ...prev,
            passport_expiry_day: parts.day,
            passport_expiry_month: parts.month,
            passport_expiry_year: parts.year,
        }));
    };

    const updateSpouseDobParts = (value: string) => {
        const parts = extractDateParts(value);
        setSpouseData(prev => ({ ...prev, dobDay: parts.day, dobMonth: parts.month, dobYear: parts.year }));
    };

    // Helper: add a child
    const addChild = () => {
        if (children.length < 5) {
            setChildren(prev => [...prev, { ...EMPTY_CHILD }]);
        }
    };

    // Helper: remove a child
    const removeChild = (index: number) => {
        setChildren(prev => prev.filter((_, i) => i !== index));
    };

    // Helper: update a child field
    const updateChild = (index: number, field: string, value: string) => {
        setChildren(prev => prev.map((child, i) =>
            i === index ? { ...child, [field]: value } : child
        ));
    };

    const updateChildDobParts = (index: number, value: string) => {
        const parts = extractDateParts(value);
        setChildren(prev => prev.map((child, i) => (
            i === index
                ? { ...child, dobDay: parts.day, dobMonth: parts.month, dobYear: parts.year }
                : child
        )));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f0f2f5]">
                {/* Navbar Skeleton */}
                <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                    <div className="max-w-[900px] mx-auto px-4 h-full flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-10 w-40" />
                        <div className="w-[120px]" />
                    </div>
                </nav>

                <div className="max-w-[900px] mx-auto px-4 py-6">
                    {/* Header Skeleton */}
                    <div className="mb-6 space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-96" />
                    </div>

                    <div className="space-y-4">
                        {/* Card 1 Skeleton */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
                            <Skeleton className="h-6 w-40 mb-4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </div>
                        </div>

                        {/* Card 2 Skeleton */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
                            <Skeleton className="h-6 w-40 mb-4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const inputClass = "min-w-0 w-full max-w-full [min-inline-size:0] rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#111111]";
    const labelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]";
    const sectionCardClass = "relative min-w-0 overflow-x-hidden rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-[28px] sm:border sm:border-[#ececec] sm:bg-white sm:p-6 sm:shadow-[0_20px_60px_-52px_rgba(15,23,42,0.22)] sm:before:hidden";

    function Section({ title, children }: { title: string; children: ReactNode }) {
        return (
            <section className={sectionCardClass}>
                <div className="px-1">
                    <h2 className="text-xl font-semibold tracking-tight text-[#111827]">{title}</h2>
                </div>
                <div className="mt-5">{children}</div>
            </section>
        );
    }

    function Field({
        label,
        helper,
        children,
    }: {
        label: ReactNode;
        helper?: ReactNode;
        children: ReactNode;
    }) {
        return (
            <label className="block">
                <span className={labelClass}>{label}</span>
                {children}
                {helper ? <p className="mt-2 text-xs leading-relaxed text-[#6b7280]">{helper}</p> : null}
            </label>
        );
    }

    return (
        <div className="w-full">
            <div className="w-full">
                <form onSubmit={handleSubmit}>
                    <fieldset disabled={saving || readOnlyPreview} className="flex flex-col gap-4">
                        <Section title="Identity">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label={<>First Name <span className="text-red-500">*</span></>}>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="First name"
                                    />
                                </Field>
                                <Field label={<>Last Name <span className="text-red-500">*</span></>}>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Last name"
                                    />
                                </Field>
                                <Field label="Email" helper="This email is used for sign-in and account notices.">
                                    <input
                                        type="email"
                                        value={profile?.email || ""}
                                        disabled
                                        className="min-w-0 w-full max-w-full [min-inline-size:0] rounded-2xl border border-[#e5e7eb] bg-[#f3f4f6] px-4 py-3 text-sm text-[#9ca3af] outline-none"
                                    />
                                </Field>
                                <Field
                                    label={<>Phone Number (WhatsApp) <span className="text-red-500">*</span></>}
                                    helper="Used for WhatsApp updates. Do not type '0' before the number."
                                >
                                    <InternationalPhoneField
                                        value={formData.phone}
                                        onChange={(phone) => setFormData(prev => ({ ...prev, phone }))}
                                        inputClassName={inputClass}
                                        disabled={readOnlyPreview || saving}
                                    />
                                </Field>
                                <Field label={<>Nationality <span className="text-red-500">*</span></>}>
                                    <select
                                        name="nationality"
                                        value={formData.nationality}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="">Select nationality</option>
                                        {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{getCountryDisplayLabel(c)}</option>))}
                                    </select>
                                </Field>
                                <Field label={<>Current Country <span className="text-red-500">*</span></>}>
                                    <select
                                        name="current_country"
                                        value={formData.current_country}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="">Select current country</option>
                                        {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{getCountryDisplayLabel(c)}</option>))}
                                    </select>
                                </Field>
                                <Field label={<>Gender <span className="text-red-500">*</span></>}>
                                    <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                                        <option value="">Select gender</option>
                                        {GENDER_OPTIONS.map(g => (<option key={g} value={g}>{g}</option>))}
                                    </select>
                                </Field>
                                <Field label={<>Marital Status <span className="text-red-500">*</span></>}>
                                    <select name="marital_status" value={formData.marital_status} onChange={handleChange} className={inputClass}>
                                        <option value="">Select status</option>
                                        {MARITAL_STATUSES.map(s => (<option key={s} value={s}>{s}</option>))}
                                    </select>
                                </Field>
                                <Field label={<>Date of Birth <span className="text-red-500">*</span></>}>
                                    <NativeDateField
                                        min={birthDateMinIso}
                                        max={todayIso}
                                        inputClassName={inputClass}
                                        value={dateOfBirthValue}
                                        onChange={updateDobParts}
                                        disabled={readOnlyPreview || saving}
                                    />
                                </Field>
                                <Field label="Address">
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Your full address"
                                    />
                                </Field>
                            </div>
                        </Section>

                        <Section title="Birth & Citizenship">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label={<>Country of Birth <span className="text-red-500">*</span></>}>
                                    <select name="birth_country" value={formData.birth_country} onChange={handleChange} className={inputClass}>
                                        <option value="">Select birth country</option>
                                        {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{getCountryDisplayLabel(c)}</option>))}
                                    </select>
                                </Field>
                                <Field label={<>City of Birth <span className="text-red-500">*</span></>}>
                                    <input
                                        type="text"
                                        name="birth_city"
                                        value={formData.birth_city}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Birth city"
                                    />
                                </Field>
                                <Field label={<>Current Citizenship <span className="text-red-500">*</span></>}>
                                    <select name="citizenship" value={formData.citizenship} onChange={handleChange} className={inputClass}>
                                        <option value="">Select citizenship</option>
                                        {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{getCountryDisplayLabel(c)}</option>))}
                                    </select>
                                </Field>
                                <Field
                                    label="Maiden Name"
                                    helper="Optional. Use it only if your surname changed after marriage."
                                >
                                    <input
                                        type="text"
                                        name="maiden_name"
                                        value={formData.maiden_name}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Birth surname"
                                    />
                                </Field>
                                <Field label="Father&apos;s First Name" helper="Optional">
                                    <input
                                        type="text"
                                        name="father_name"
                                        value={formData.father_name}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Father's first name"
                                    />
                                </Field>
                                <Field label="Mother&apos;s First Name" helper="Optional">
                                    <input
                                        type="text"
                                        name="mother_name"
                                        value={formData.mother_name}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Mother's first name"
                                    />
                                </Field>
                            </div>

                            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#111827]">
                                <input
                                    type="checkbox"
                                    id="origCitizenshipSame"
                                    checked={formData.original_citizenship_same}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        original_citizenship_same: e.target.checked,
                                        original_citizenship: e.target.checked ? "" : prev.original_citizenship
                                    }))}
                                    className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                />
                                Original citizenship is the same as current citizenship
                            </label>

                            {!formData.original_citizenship_same && (
                                <div className="mt-4">
                                    <Field label="Original Citizenship">
                                        <select
                                            name="original_citizenship"
                                            value={formData.original_citizenship}
                                            onChange={handleChange}
                                            className={inputClass}
                                        >
                                            <option value="">Select original citizenship</option>
                                            {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{getCountryDisplayLabel(c)}</option>))}
                                        </select>
                                    </Field>
                                </div>
                            )}
                        </Section>

                        {/* • • • • • • • • • • • • • • •  Family Information Card • • • • • • • • • • • • • • •  */}
                        <div className={`${sectionCardClass} order-5`}>
                            <div className="px-1">
                                <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Family</h2>
                            </div>
                            <div className="mt-5 space-y-4">
                                {/* Spouse Toggle */}
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="hasSpouse"
                                        checked={hasSpouse}
                                        onChange={(e) => setHasSpouse(e.target.checked)}
                                        className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                    />
                                    <label htmlFor="hasSpouse" className="text-[14px] font-medium text-gray-700">
                                        I have a spouse / partner
                                    </label>
                                </div>

                                {/* Spouse Fields */}
                                {hasSpouse && (
                                    <div className="rounded-[24px] border border-[#e5e7eb] bg-[#fafafa] p-4 space-y-4">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">Spouse details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={spouseData.first_name}
                                                    onChange={(e) => setSpouseData(prev => ({ ...prev, first_name: e.target.value }))}
                                                    className={inputClass}
                                                    placeholder="Spouse's first name"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={spouseData.last_name}
                                                    onChange={(e) => setSpouseData(prev => ({ ...prev, last_name: e.target.value }))}
                                                    className={inputClass}
                                                    placeholder="Spouse's last name"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>Date of Birth <span className="text-red-500">*</span></label>
                                                <NativeDateField
                                                    min={birthDateMinIso}
                                                    max={todayIso}
                                                    inputClassName={inputClass}
                                                    value={spouseDateOfBirthValue}
                                                    onChange={updateSpouseDobParts}
                                                    disabled={readOnlyPreview || saving}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Country of Birth</label>
                                                <select
                                                    value={spouseData.birth_country}
                                                    onChange={(e) => setSpouseData(prev => ({ ...prev, birth_country: e.target.value }))}
                                                    className={inputClass}
                                                >
                                                    <option value="">Select...</option>
                                                    {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{getCountryDisplayLabel(c)}</option>))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelClass}>City of Birth</label>
                                                <input
                                                    type="text"
                                                    value={spouseData.birth_city}
                                                    onChange={(e) => setSpouseData(prev => ({ ...prev, birth_city: e.target.value }))}
                                                    className={inputClass}
                                                    placeholder="City"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Children Toggle */}
                                <div className="flex items-center gap-3 mt-2">
                                    <input
                                        type="checkbox"
                                        id="hasChildren"
                                        checked={hasChildren}
                                        onChange={(e) => {
                                            setHasChildren(e.target.checked);
                                            if (e.target.checked && children.length === 0) {
                                                setChildren([{ ...EMPTY_CHILD }]);
                                            }
                                        }}
                                        className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                    />
                                    <label htmlFor="hasChildren" className="text-[14px] font-medium text-gray-700">
                                        I have children
                                    </label>
                                </div>

                                {/* Children Fields */}
                                {hasChildren && (
                                    <div className="space-y-3">
                                        {children.map((child, index) => (
                                            <div key={index} className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">
                                                        Child {index + 1}
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeChild(index)}
                                                        className="rounded-full border border-[#f3d7d7] bg-white px-3 py-1 text-xs font-semibold text-[#9f1239] transition hover:bg-[#fff1f2]"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className={labelClass}>Last Name</label>
                                                        <input
                                                            type="text"
                                                            value={child.last_name}
                                                            onChange={(e) => updateChild(index, "last_name", e.target.value)}
                                                            className={inputClass}
                                                            placeholder="Last name"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>First Name</label>
                                                        <input
                                                            type="text"
                                                            value={child.first_name}
                                                            onChange={(e) => updateChild(index, "first_name", e.target.value)}
                                                            className={inputClass}
                                                            placeholder="First name"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Date of Birth</label>
                                                        <NativeDateField
                                                            min={birthDateMinIso}
                                                            max={todayIso}
                                                            inputClassName={inputClass}
                                                            value={buildDateValue(child.dobDay, child.dobMonth, child.dobYear)}
                                                            onChange={(value) => updateChildDobParts(index, value)}
                                                            disabled={readOnlyPreview || saving}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {children.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={addChild}
                                                className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa]"
                                            >
                                                Add child
                                            </button>
                                        )}
                                        {children.length >= 5 && (
                                            <p className="text-[12px] text-gray-500">Maximum 5 children can be added.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* • • • • • • • • • • • • • • •  Passport & Travel Card • • • • • • • • • • • • • • •  */}
                        <div className={`${sectionCardClass} order-3`}>
                            <div className="px-1">
                                <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Passport & Travel</h2>
                            </div>
                            <div className="mt-5 space-y-4">
                                {/* Row: Passport Number + Issued By */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Passport Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="passport_number"
                                            value={formData.passport_number}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="e.g., AB1234567"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Issued By <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="passport_issued_by"
                                            value={formData.passport_issued_by}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Issuing authority"
                                        />
                                    </div>
                                </div>

                                {/* Row: Issue Date + Expiry Date */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Issue Date <span className="text-red-500">*</span>
                                        </label>
                                        <NativeDateField
                                            min={passportIssueMinIso}
                                            max={todayIso}
                                            inputClassName={inputClass}
                                            value={passportIssueDateValue}
                                            onChange={updatePassportIssueParts}
                                            disabled={readOnlyPreview || saving}
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">Must be within the last 10 years</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Expiry Date <span className="text-red-500">*</span>
                                        </label>
                                        <NativeDateField
                                            min={todayIso}
                                            max={passportExpiryMaxIso}
                                            inputClassName={inputClass}
                                            value={passportExpiryDateValue}
                                            onChange={updatePassportExpiryParts}
                                            disabled={readOnlyPreview || saving}
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">Must be valid for at least 3 months after departure</p>
                                    </div>
                                </div>

                                {/* Row: Lives Abroad + Previous Visas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Do you live outside your home country? <span className="text-red-500">*</span>
                                        </label>
                                        <select name="lives_abroad" value={formData.lives_abroad} onChange={handleChange} className={inputClass}>
                                            <option value="">Select...</option>
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Have you had any visas in the last 3 years? <span className="text-red-500">*</span>
                                        </label>
                                        <select name="previous_visas" value={formData.previous_visas} onChange={handleChange} className={inputClass}>
                                            <option value="">Select...</option>
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* • • • • • • • • • • • • • • •  Job Preferences Card • • • • • • • • • • • • • • •  */}
                        <div className={`${sectionCardClass} order-4`}>
                            <div className="px-1">
                                <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Job Preferences</h2>
                            </div>
                            <div className="mt-5 space-y-4">
                                <div>
                                    <label className={labelClass}>
                                        Preferred Job / Industry <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="preferred_job"
                                        value={normalizePreferredJobValue(formData.preferred_job, false)}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="">Select industries</option>
                                        <option value={ALL_OPTION_VALUE}>All industries</option>
                                        {workerIndustryOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Preferred Destinations (Europe)
                                    </label>

                                    <NativeDestinationSelectField
                                        allLabel="All destinations"
                                        chipClassName="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                                        clearButtonClassName="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-white"
                                        emptyStateClassName="text-[12px] text-gray-500"
                                        optionLabel="Select destinations"
                                        options={destinationPreferenceOptions}
                                        removeButtonClassName="transition hover:border-gray-300 hover:bg-gray-50"
                                        selectClassName={inputClass}
                                        values={normalizeDesiredCountryValues(formData.desired_countries)}
                                        onChange={(values) => setFormData(prev => ({ ...prev, desired_countries: values }))}
                                    />
                                    <p className="text-[12px] text-gray-500 mt-2">
                                        ⓘ Selecting a specific country doesn&apos;t guarantee a job there. You might receive offers from other EU countries.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </fieldset>

                        {/* Save / Cancel Buttons */}
                        <div className="flex flex-col gap-3 pt-2 pb-24 md:flex-row md:items-center md:justify-end md:pb-8">
                            {readOnlyPreview && (
                                <div className="text-sm text-[#6b7280] md:mr-auto">
                                    Preview is read-only. Review the full form structure here, then return to the worker overview.
                                </div>
                            )}
                            <Link
                                href={overviewHref}
                                className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-5 py-3 text-center text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa] md:w-auto"
                            >
                                {readOnlyPreview ? "Back to Overview" : "Cancel"}
                            </Link>
                            {!readOnlyPreview && (
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                                >
                                    {saving ? (
                                        <>
                                            Saving...
                                        </>
                                    ) : (
                                        "Save Changes"
                                    )}
                                </button>
                            )}
                        </div>
                </form>
            </div>
        </div>
    );
}
