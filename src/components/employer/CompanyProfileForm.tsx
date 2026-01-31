"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CustomPhoneInput } from "@/components/ui/PhoneInput";
import { Building, MapPin, Users, Phone, FileText } from "lucide-react";

export function CompanyProfileForm() {
    const [formData, setFormData] = useState({
        companyName: "",
        regNumber: "",
        address: "",
        contactPerson: "",
        phone: "",
        workersCount: 1,
        industry: "Construction",
        housingAvailable: false,
    });

    const [isSaved, setIsSaved] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaved(true);
        alert("Profile Updated! Your service request is now active.");
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 md:p-8">
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Company Profile & Needs</h2>
                    <p className="text-sm text-gray-500">Update your details to start the hiring process.</p>
                </div>
                {isSaved && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">ACTIVE REQUEST</span>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Company Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                        <Building size={16} /> Company Details
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Company Name</label>
                            <input
                                type="text" required placeholder="e.g. BuildCorp GmbH"
                                className="w-full p-2 border border-border rounded-lg"
                                value={formData.companyName}
                                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Registration Number (HRB)</label>
                            <input
                                type="text" required placeholder="HRB 123456"
                                className="w-full p-2 border border-border rounded-lg"
                                value={formData.regNumber}
                                onChange={e => setFormData({ ...formData, regNumber: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-gray-500 block mb-1">Registered Address</label>
                            <div className="relative">
                                <MapPin size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text" required placeholder="Street, City, Zip Code"
                                    className="w-full p-2 pl-9 border border-border rounded-lg"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-border" />

                {/* Contact Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                        <Phone size={16} /> Contact Person
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Full Name</label>
                            <input
                                type="text" required placeholder="John Doe"
                                className="w-full p-2 border border-border rounded-lg"
                                value={formData.contactPerson}
                                onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Phone / WhatsApp</label>
                            <CustomPhoneInput
                                value={formData.phone}
                                onChange={(val) => setFormData({ ...formData, phone: val })}
                                placeholder="+49 ..."
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-border" />

                {/* Service Needs */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                        <Users size={16} /> Hiring Needs
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Workers Needed (Estimate)</label>
                            <input
                                type="number" min="1" required
                                className="w-full p-2 border border-border rounded-lg"
                                value={formData.workersCount}
                                onChange={e => setFormData({ ...formData, workersCount: parseInt(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Housing Availability</label>
                            <select
                                className="w-full p-2 border border-border rounded-lg bg-white"
                                value={formData.housingAvailable ? "yes" : "no"}
                                onChange={e => setFormData({ ...formData, housingAvailable: e.target.value === "yes" })}
                            >
                                <option value="no">No, agency must assist</option>
                                <option value="yes">Yes, we provide accommodation</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <Button type="submit" size="lg" className="w-full">
                        {isSaved ? "Update Profile" : "Activate Service Request"}
                    </Button>
                    <p className="text-xs text-center text-gray-400 mt-2">
                        By activating, you agree to our B2B Terms of Service.
                    </p>
                </div>

            </form>
        </div>
    );
}
