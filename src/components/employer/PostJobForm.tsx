"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function PostJobForm() {
    const [formData, setFormData] = useState({
        title: "",
        location: "",
        workersNeeded: 1,
        industry: "Construction",
        description: "",
    });

    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/match-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId: 'mock-job-123',
                    employerEmail: 'hr@buildcorp.com' // Mock email
                }),
            });

            const data = await res.json();
            if (res.ok) {
                alert("Job Posted! Agency is now searching for candidates. (Check Console for 'Email' logs)");
            } else {
                alert("Error posting job.");
            }
        } catch (e) {
            alert("Network Error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 md:p-8">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Post a New Job</h2>
                <p className="text-sm text-gray-500">Tell us what you need. Our AI will match you with candidates.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <input
                        type="text"
                        required
                        placeholder="e.g. Electrician, Welder, Drywall Installer"
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location (Germany)</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Frankfurt"
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Workers Needed</label>
                        <input
                            type="number"
                            min="1"
                            required
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            value={formData.workersNeeded}
                            onChange={(e) => setFormData({ ...formData, workersNeeded: parseInt(e.target.value) })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry / Skillset</label>
                    <select
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    >
                        <option value="Construction">Construction (General)</option>
                        <option value="Welding">Welding (MIG/MAG/TIG)</option>
                        <option value="Electrician">Electrical</option>
                        <option value="Plumbing">Plumbing & HVAC</option>
                        <option value="Drywall">Drywall & Painting</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Details & Requirements</label>
                    <textarea
                        rows={4}
                        placeholder="Describe the job, required experience, and any specific certifications..."
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="pt-2">
                    <Button type="submit" size="lg" className="w-full md:w-auto">
                        Post Job & Find Matches
                    </Button>
                </div>

            </form>
        </div>
    );
}
