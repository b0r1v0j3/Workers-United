"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function Contact() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        country: "",
        role: "worker",
        job_preference: "",
        message: "",
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement API logic
        alert("Thank you! Form submission will be implemented in Phase 3.");
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    return (
        <section id="contact" className="py-20 md:py-24">
            <div className="container mx-auto px-5 max-w-[1120px]">
                <div className="text-center max-w-[640px] mx-auto mb-10">
                    <div className="text-xs uppercase tracking-[0.12em] text-muted mb-2">Contact</div>
                    <h2 className="text-2xl md:text-3xl font-bold text-primary mb-3">Tell us what you need</h2>
                    <p className="text-sm text-muted">
                        Please provide a brief summary of your situation. We will respond personally as soon as we can—usually within one business day.
                    </p>
                </div>

                <div className="grid md:grid-cols-[0.95fr_1.05fr] gap-8 md:gap-12">
                    {/* Contact Info */}
                    <div className="text-sm text-muted space-y-4">
                        <p>
                            Workers United is here for both workers and employers seeking lawful and realistic cooperation. There is no need to prepare perfect documents before getting in touch; please describe your circumstances candidly.
                        </p>
                        <p>
                            If it is easier for you, you can also email us directly at:<br />
                            <a href="mailto:contact@workersunited.eu" className="font-bold text-primary hover:underline">contact@workersunited.eu</a>
                        </p>
                        <p>
                            If you require assistance, please do not hesitate to call or message us. We understand the importance of this decision and will treat every enquiry with the utmost professionalism.
                        </p>
                    </div>

                    {/* Form */}
                    <div className="bg-bg-alt rounded-3xl p-6 border border-border shadow-soft">
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="name" className="text-xs text-muted">Full name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="rounded-full border border-border px-3 py-2.5 text-base bg-[#f9fbff] outline-none focus:border-primary-soft/50 focus:ring-2 focus:ring-primary-soft/20 transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="email" className="text-xs text-muted">Email <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="rounded-full border border-border px-3 py-2.5 text-base bg-[#f9fbff] outline-none focus:border-primary-soft/50 focus:ring-2 focus:ring-primary-soft/20 transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="phone" className="text-xs text-muted">Phone Number (WhatsApp) <span className="text-red-500">*</span></label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    required
                                    placeholder="+1 234 567 8900"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="rounded-full border border-border px-3 py-2.5 text-base bg-[#f9fbff] outline-none focus:border-primary-soft/50 focus:ring-2 focus:ring-primary-soft/20 transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="country" className="text-xs text-muted">Country you are currently in</label>
                                <input
                                    type="text"
                                    id="country"
                                    name="country"
                                    value={formData.country}
                                    onChange={handleChange}
                                    className="rounded-full border border-border px-3 py-2.5 text-base bg-[#f9fbff] outline-none focus:border-primary-soft/50 focus:ring-2 focus:ring-primary-soft/20 transition-all"
                                />
                            </div>

                            <div className="md:col-span-2 flex flex-col gap-1.5">
                                <span className="text-xs text-muted">I am a <span className="text-red-500">*</span></span>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full bg-[#183b56]/5 text-muted text-xs uppercase tracking-wider has-[:checked]:bg-primary has-[:checked]:text-white transition-colors">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="worker"
                                            checked={formData.role === "worker"}
                                            onChange={handleChange}
                                            className="hidden"
                                        />
                                        <span>Worker</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full bg-[#183b56]/5 text-muted text-xs uppercase tracking-wider has-[:checked]:bg-primary has-[:checked]:text-white transition-colors">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="employer"
                                            checked={formData.role === "employer"}
                                            onChange={handleChange}
                                            className="hidden"
                                        />
                                        <span>Employer</span>
                                    </label>
                                </div>
                            </div>

                            <div className="md:col-span-2 flex flex-col gap-1.5 mt-2">
                                <label htmlFor="job_preference" className="text-xs text-muted">Preferred Job / Industry</label>
                                <input
                                    type="text"
                                    id="job_preference"
                                    name="job_preference"
                                    placeholder="e.g. Construction, Hospitality, driver..."
                                    value={formData.job_preference}
                                    onChange={handleChange}
                                    className="rounded-full border border-border px-3 py-2.5 text-base bg-[#f9fbff] outline-none focus:border-primary-soft/50 focus:ring-2 focus:ring-primary-soft/20 transition-all"
                                />
                            </div>

                            <div className="md:col-span-2 flex flex-col gap-1.5 mt-2">
                                <label htmlFor="message" className="text-xs text-muted">Message (short overview of your situation) <span className="text-red-500">*</span></label>
                                <textarea
                                    id="message"
                                    name="message"
                                    required
                                    rows={4}
                                    value={formData.message}
                                    onChange={handleChange}
                                    className="rounded-2xl border border-border px-3 py-2.5 text-base bg-[#f9fbff] outline-none focus:border-primary-soft/50 focus:ring-2 focus:ring-primary-soft/20 transition-all resize-none"
                                />
                                <div className="text-[11px] text-muted italic">
                                    Please include any important details about job, visa status or deadlines.
                                </div>
                            </div>

                            <div className="md:col-span-2 mt-4">
                                <Button type="submit" className="w-full md:w-auto">
                                    Send message
                                </Button>
                                <p className="text-[11px] text-muted mt-2 text-center md:text-left">
                                    By sending this form you agree that we may contact you back regarding your request.
                                </p>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}
