"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { toast } from "sonner";
import { Check, Circle, ShieldCheck } from "lucide-react";

interface SignupFormProps {
    userType: "worker" | "employer" | "agency";
    claimContext?: {
        workerId: string;
        workerName: string;
        workerEmail: string | null;
        agencyName: string | null;
        claimed: boolean;
        claimable: boolean;
        reason: "ok" | "already_claimed" | "missing_email";
    } | null;
}

const COMMON_DOMAINS: Record<string, string> = {
    "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gmaill.com": "gmail.com",
    "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmal.com": "gmail.com",
    "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.om": "gmail.com",
    "yahoo.coms": "yahoo.com", "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com",
    "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com",
    "hotmai.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com",
    "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com",
    "outloo.com": "outlook.com", "outlok.com": "outlook.com", "outllok.com": "outlook.com",
    "outlook.con": "outlook.com",
    "1yahoo.com": "yahoo.com", "1gmail.com": "gmail.com", "1hotmail.com": "hotmail.com",
};

function trackEvent(action: string, details?: Record<string, unknown>) {
    fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, category: "funnel", details }),
    }).catch(() => { }); // best-effort only
}

export function SignupForm({ userType, claimContext = null }: SignupFormProps) {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [gdprConsent, setGdprConsent] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const router = useRouter();
    const claimEmailLocked = Boolean(claimContext?.claimable && claimContext.workerEmail);
    const claimDisabled = claimContext ? !claimContext.claimable : false;

    useEffect(() => {
        if (claimContext?.workerName) {
            setFullName((current) => current || claimContext.workerName);
        }
        if (claimContext?.workerEmail) {
            setEmail((current) => current || claimContext.workerEmail || "");
        }
    }, [claimContext]);

    useEffect(() => {
        trackEvent("signup_page_view", {
            userType,
            claimable: claimContext?.claimable || false,
            claimReason: claimContext?.reason || null,
        });
    }, [claimContext?.claimable, claimContext?.reason, userType]);

    const passwordChecks = useMemo(() => ({
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    }), [password]);

    const allChecksPassed = Object.values(passwordChecks).every(Boolean);
    const passwordsMatch = password === confirmPassword;

    const emailValidation = useMemo(() => {
        if (!email) return { error: null as string | null, suggestion: null as string | null };

        const trimmed = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            return { error: "Please enter a valid email address", suggestion: null };
        }
        if (trimmed.endsWith(".")) {
            return { error: "Email cannot end with a dot", suggestion: trimmed.slice(0, -1) };
        }
        if (trimmed.includes("..")) {
            return { error: "Email contains double dots", suggestion: null };
        }

        const domain = trimmed.split("@")[1];
        if (!domain || domain.length < 3) {
            return { error: "Invalid email domain", suggestion: null };
        }

        const tld = domain.split(".").pop() || "";
        if (tld.length < 2) {
            return { error: "Invalid domain extension", suggestion: null };
        }

        if (COMMON_DOMAINS[domain]) {
            return {
                error: null,
                suggestion: `${trimmed.split("@")[0]}@${COMMON_DOMAINS[domain]}`,
            };
        }

        return { error: null, suggestion: null };
    }, [email]);

    const emailIsValid = !emailValidation.error && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const canSubmit = allChecksPassed && passwordsMatch && gdprConsent && emailIsValid && !loading;

    const handleGoogleSignup = async () => {
        setGoogleLoading(true);
        trackEvent("signup_google_click", {
            userType,
            claimWorkerId: claimContext?.workerId || null,
        });

        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback?user_type=${userType}${claimContext?.workerId ? `&claim_worker_id=${claimContext.workerId}` : ""}`,
            },
        });

        if (error) {
            toast.error(error.message);
            trackEvent("signup_google_error", { userType, message: error.message });
            setGoogleLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        trackEvent("signup_submit_attempt", { userType });

        if (!gdprConsent) {
            toast.error("You must agree to the Terms of Service and Privacy Policy to create an account.");
            trackEvent("signup_validation_failed", { userType, reason: "missing_gdpr_consent" });
            return;
        }

        if (!allChecksPassed) {
            toast.error("Password does not meet all requirements.");
            trackEvent("signup_validation_failed", { userType, reason: "weak_password" });
            return;
        }

        if (!passwordsMatch) {
            toast.error("Passwords do not match");
            trackEvent("signup_validation_failed", { userType, reason: "password_mismatch" });
            return;
        }

        setLoading(true);

        try {
            const supabase = createClient();

            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                    data: {
                        full_name: fullName.trim(),
                        company_name: userType === "employer" || userType === "agency" ? companyName.trim() : null,
                        user_type: userType,
                        claimed_worker_id: claimContext?.workerId || null,
                        gdpr_consent: true,
                        gdpr_consent_at: new Date().toISOString(),
                    },
                },
            });

            if (signUpError) {
                toast.error(signUpError.message);
                trackEvent("signup_error", { userType, message: signUpError.message });
                return;
            }

            if (data.user && !data.session) {
                setSuccess(true);
                trackEvent("signup_pending_email_confirmation", { userType });
                return;
            }

            if (data.session) {
                if (claimContext?.workerId) {
                    const claimResponse = await fetch("/api/agency/claim", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ workerId: claimContext.workerId }),
                    });
                    const claimData = await claimResponse.json().catch(() => null);

                    if (!claimResponse.ok) {
                        toast.error(claimData?.error || "Account created, but worker claim could not be completed.");
                    } else if (claimData?.reason === "linked" || claimData?.reason === "already_linked") {
                        toast.success("Your agency-submitted worker profile is now linked.");
                    }
                }

                fetch("/api/queue-user-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ emailType: "welcome" }),
                }).catch(() => { });
                trackEvent("signup_success", { userType, authMethod: "email" });
            }

            router.push(
                userType === "employer"
                    ? "/profile/employer"
                    : userType === "agency"
                        ? "/profile/agency"
                        : "/profile/worker"
            );
            router.refresh();
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes("already registered") || err.message.includes("already exists")) {
                    toast.error("This email is already registered. Please sign in instead.");
                } else {
                    toast.error(err.message);
                }
                trackEvent("signup_error", { userType, message: err.message });
            } else {
                toast.error("An unexpected error occurred. Please try again.");
                trackEvent("signup_error", { userType, message: "unknown_error" });
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white px-6">
                <div className="w-full max-w-md rounded-[28px] border border-[#e6e6e1] bg-[#f7f7f4] p-8 text-center shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)]">
                    <div className="mx-auto mb-5 flex items-center justify-center">
                        <Image
                            src="/logo-complete-transparent.png"
                            alt="Workers United logo"
                            width={176}
                            height={176}
                            className="h-auto w-[138px] object-contain"
                        />
                    </div>

                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                        <Check className="h-10 w-10 text-emerald-600" />
                    </div>

                    <h2 className="text-2xl font-semibold tracking-tight text-[#18181b]">Check your email</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[#52525b]">
                        We&apos;ve sent a confirmation link to <strong className="font-semibold text-[#18181b]">{email}</strong>.
                        Open your inbox and click the link to activate your account{claimContext?.workerId ? " and claim your worker profile" : ""}.
                    </p>

                    <LinkButton href="/login" label="Go to Sign In" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {claimContext ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${
                    claimContext.claimable
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                }`}>
                    {claimContext.claimable ? (
                        <p>
                            You&apos;re claiming <strong>{claimContext.workerName}</strong>
                            {claimContext.agencyName ? ` from ${claimContext.agencyName}` : ""}.
                            {claimContext.workerEmail ? ` Use ${claimContext.workerEmail} for this account.` : ""}
                        </p>
                    ) : claimContext.reason === "already_claimed" ? (
                        <p>This worker profile has already been claimed. You can still create a separate worker account.</p>
                    ) : (
                        <p>This worker profile cannot be claimed yet because the agency has not entered the worker email address.</p>
                    )}
                </div>
            ) : null}

            <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={googleLoading || claimDisabled}
                className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-[#e4e4df] bg-white px-5 py-3.5 text-[15px] font-medium text-[#18181b] shadow-[0_16px_35px_-28px_rgba(15,23,42,0.25)] transition hover:border-[#d2d2cc] hover:bg-[#f8f8f6] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {googleLoading ? (
                    <Spinner className="h-4 w-4 text-[#71717a]" />
                ) : (
                    <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={18} height={18} className="h-4.5 w-4.5" />
                )}
                {googleLoading ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#e4e4df]" />
                </div>
                <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a1a1aa]">Or use email</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <InputField
                    id="fullName"
                    label={userType === "worker" ? "Full Name" : "Contact Person Name"}
                    value={fullName}
                    onChange={setFullName}
                    placeholder={userType === "worker" ? "John Doe" : "John Smith"}
                    readOnly={Boolean(claimContext?.claimable && claimContext.workerName)}
                />

                {(userType === "employer" || userType === "agency") && (
                    <InputField
                        id="companyName"
                        label={userType === "agency" ? "Agency Name" : "Company Name"}
                        value={companyName}
                        onChange={setCompanyName}
                        placeholder={userType === "agency" ? "Your Agency Name" : "Your Company Ltd."}
                    />
                )}

                <div className="space-y-1.5">
                    <InputField
                        id="email"
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder={userType === "worker" ? "you@example.com" : "contact@example.com"}
                        invalid={Boolean(emailValidation.error)}
                        warning={!emailValidation.error && Boolean(emailValidation.suggestion)}
                        readOnly={claimEmailLocked}
                    />
                    {emailValidation.error && email && (
                        <p className="px-1 text-xs font-medium text-red-500">{emailValidation.error}</p>
                    )}
                    {emailValidation.suggestion && !emailValidation.error && (
                        <button
                            type="button"
                            onClick={() => setEmail(emailValidation.suggestion ?? "")}
                            className="px-1 text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800"
                        >
                            Did you mean {emailValidation.suggestion}?
                        </button>
                    )}
                </div>

                <div className="space-y-1.5">
                    <InputField
                        id="password"
                        label="Password"
                        type="password"
                        value={password}
                        onChange={setPassword}
                        placeholder="••••••••"
                        minLength={8}
                    />
                    {password.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1 rounded-2xl border border-[#e4e4df] bg-[#f8f8f6] px-3 py-2 sm:grid-cols-2">
                            <Rule met={passwordChecks.minLength} label="8+ characters" />
                            <Rule met={passwordChecks.hasUppercase} label="Uppercase (A-Z)" />
                            <Rule met={passwordChecks.hasLowercase} label="Lowercase (a-z)" />
                            <Rule met={passwordChecks.hasNumber} label="Number (0-9)" />
                            <Rule met={passwordChecks.hasSpecial} label="Special (!@#$)" />
                        </div>
                    ) : (
                        <p className="px-1 text-[11px] font-medium text-[#71717a]">Use uppercase, lowercase, number, and special character.</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <InputField
                        id="confirmPassword"
                        label="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="••••••••"
                        minLength={8}
                        invalid={Boolean(password && confirmPassword && !passwordsMatch)}
                    />
                    {password && confirmPassword && !passwordsMatch && (
                        <p className="px-1 text-xs font-medium text-red-500">Passwords do not match</p>
                    )}
                    {password && confirmPassword && passwordsMatch && (
                        <p className="px-1 text-xs font-medium text-emerald-600">Passwords match</p>
                    )}
                </div>

                <div className="rounded-2xl border border-[#e4e4df] bg-[#f8f8f6] px-4 py-3">
                    <label htmlFor="gdprConsent" className="flex cursor-pointer items-start gap-3">
                        <input
                            id="gdprConsent"
                            type="checkbox"
                            checked={gdprConsent}
                            onChange={(e) => setGdprConsent(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-[#a1a1aa] text-[#18181b] focus:ring-[#18181b]"
                        />
                        <span className="text-xs leading-relaxed text-[#52525b]">
                            I have read and agree to the{" "}
                            <a href="/terms" target="_blank" className="font-semibold text-[#18181b] underline-offset-2 hover:underline">Terms of Service</a>
                            {" "}and{" "}
                            <a href="/privacy-policy" target="_blank" className="font-semibold text-[#18181b] underline-offset-2 hover:underline">Privacy Policy</a>.
                            I consent to personal data processing as described there.
                        </span>
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={!canSubmit || claimDisabled}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#111111_0%,#27272a_100%)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <Spinner className="h-4 w-4 text-white" />
                            Creating account...
                        </>
                    ) : (
                        <>
                            {claimContext?.claimable
                                ? "Claim worker account"
                                : `Create ${userType === "employer" ? "employer" : userType === "agency" ? "agency" : "worker"} account`}
                        </>
                    )}
                </button>

                <div className="rounded-2xl border border-[#e4e4df] bg-white px-4 py-3">
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-[#71717a]">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3f3f46]" />
                        Your data is encrypted and used only for account setup, verification, and service delivery.
                    </p>
                </div>
            </form>
        </div>
    );
}

interface InputFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: "text" | "email" | "password";
    minLength?: number;
    invalid?: boolean;
    warning?: boolean;
    readOnly?: boolean;
}

function InputField({
    id,
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    minLength,
    invalid = false,
    warning = false,
    readOnly = false,
}: InputFieldProps) {
    const tone = invalid
        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
        : warning
            ? "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
            : "border-[#e4e4df] focus:border-[#27272a] focus:ring-zinc-100";

    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#52525b]">
                {label}
            </label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                minLength={minLength}
                required
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full rounded-2xl border bg-[#f8f8f6] px-4 py-3 text-[15px] text-[#18181b] outline-none transition placeholder:text-[#a1a1aa] focus:bg-white focus:ring-2 ${readOnly ? "cursor-not-allowed opacity-80" : ""} ${tone}`}
            />
        </div>
    );
}

function Rule({ met, label }: { met: boolean; label: string }) {
    return (
        <p className={`flex items-center gap-1.5 text-[11px] font-medium ${met ? "text-emerald-700" : "text-[#a1a1aa]"}`}>
            {met ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {label}
        </p>
    );
}

function Spinner({ className }: { className: string }) {
    return (
        <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

function LinkButton({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-[#e4e4df] bg-white px-4 py-2 text-sm font-semibold text-[#18181b] transition hover:bg-[#f8f8f6]"
        >
            {label}
        </a>
    );
}
