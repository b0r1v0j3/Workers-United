"use client";

import { useState } from "react";

export function ContactForm() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        country: "",
        role: "worker",
        job_preference: "",
        message: ""
    });

    const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [consent, setConsent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("sending");
        setErrorMessage("");

        try {
            const response = await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                setStatus("success");
                setFormData({
                    name: "",
                    email: "",
                    phone: "",
                    country: "",
                    role: "worker",
                    job_preference: "",
                    message: ""
                });
            } else {
                setStatus("error");
                setErrorMessage(data.message || "Something went wrong. Please try again.");
            }
        } catch {
            setStatus("error");
            setErrorMessage("Network error. Please check your connection and try again.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Status Messages */}
            {status === "success" && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                    <strong>✓ Success!</strong> Your message has been sent. We will reply to you as soon as possible.
                </div>
            )}
            {status === "error" && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <strong>✗ Error:</strong> {errorMessage}
                </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-[#183b56] mb-1">
                        Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none transition-all"
                    />
                </div>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[#183b56] mb-1">
                        Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-[#183b56] mb-1">
                        Phone Number (WhatsApp) <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        required
                        placeholder="+1 234 567 8900"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none transition-all"
                    />
                </div>
                <div>
                    <label htmlFor="country" className="block text-sm font-medium text-[#183b56] mb-1">
                        Country you are currently in
                    </label>
                    <input
                        type="text"
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none transition-all"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-[#183b56] mb-2">
                    I am a <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${formData.role === "worker" ? "border-[#2f6fed] bg-[#2f6fed]/5 text-[#2f6fed]" : "border-[#dde3ec] text-[#6c7a89] hover:border-[#2f6fed]/50"}`}>
                        <input
                            type="radio"
                            name="role"
                            value="worker"
                            checked={formData.role === "worker"}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="sr-only"
                        />
                        Worker
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${formData.role === "employer" ? "border-[#2f6fed] bg-[#2f6fed]/5 text-[#2f6fed]" : "border-[#dde3ec] text-[#6c7a89] hover:border-[#2f6fed]/50"}`}>
                        <input
                            type="radio"
                            name="role"
                            value="employer"
                            checked={formData.role === "employer"}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="sr-only"
                        />
                        Employer
                    </label>
                </div>
            </div>

            <div>
                <label htmlFor="job_preference" className="block text-sm font-medium text-[#183b56] mb-1">
                    Preferred Job / Industry
                </label>
                <input
                    type="text"
                    id="job_preference"
                    name="job_preference"
                    placeholder="e.g. Construction, Hospitality, driver..."
                    value={formData.job_preference}
                    onChange={(e) => setFormData({ ...formData, job_preference: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none transition-all"
                />
            </div>

            <div>
                <label htmlFor="message" className="block text-sm font-medium text-[#183b56] mb-1">
                    Message <span className="text-red-500">*</span>
                </label>
                <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    placeholder="Short overview of your situation..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none transition-all resize-none"
                />
                <p className="mt-1 text-xs text-[#6c7a89]">
                    Please include any important details about job, visa status or deadlines.
                </p>
            </div>

            {/* GDPR Consent */}
            <div className="flex items-start gap-3">
                <input
                    id="contactConsent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#2f6fed] rounded border-gray-300 focus:ring-[#2f6fed] cursor-pointer"
                />
                <label htmlFor="contactConsent" className="text-xs text-[#6c7a89] cursor-pointer leading-relaxed">
                    I agree that Workers United may use my information to respond to my inquiry.
                    See our{" "}
                    <a href="/privacy-policy" target="_blank" className="text-[#2f6fed] font-semibold hover:underline">Privacy Policy</a>. <span className="text-red-500">*</span>
                </label>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                    type="submit"
                    disabled={status === "sending" || !consent}
                    className="w-full sm:w-auto px-8 py-3 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white font-semibold shadow-lg shadow-blue-500/40 hover:shadow-blue-500/60 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                >
                    {status === "sending" ? "Sending..." : "Send message"}
                </button>
            </div>
        </form>
    );
}
