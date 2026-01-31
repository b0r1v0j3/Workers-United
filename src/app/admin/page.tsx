"use client";

import { useState, useEffect } from "react";
import { AdminAuth } from "@/components/admin/AdminAuth";
import { WorkerTable } from "@/components/admin/WorkerTable";
import { EmployerTable } from "@/components/admin/EmployerTable";
import { EmployerModal } from "@/components/admin/EmployerModal";
import { Button } from "@/components/ui/Button";

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeTab, setActiveTab] = useState<"WORKER" | "EMPLOYER">("WORKER");
    const [loading, setLoading] = useState(false);

    // Data State
    const [workers, setWorkers] = useState<any[]>([]);
    const [employers, setEmployers] = useState<any[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployer, setEditingEmployer] = useState<any | null>(null);

    useEffect(() => {
        // Check local storage for auth token
        const token = localStorage.getItem("auth_token_mock");
        if (token) setIsAuthenticated(true);
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadData(activeTab);
        }
    }, [isAuthenticated, activeTab]);

    const loadData = async (tab: string) => {
        setLoading(true);
        // Mock API Call
        await new Promise((resolve) => setTimeout(resolve, 600));

        if (tab === "WORKER") {
            setWorkers([
                { id: "1", name: "John Doe", email: "john@example.com", phone: "+1234567890", country: "Philippines", role: "worker", status: "DOCS REQUESTED", hasDocs: false },
                { id: "2", name: "Jane Smith", email: "jane@example.com", phone: "+9876543210", country: "India", role: "worker", status: "APPROVED", hasDocs: true, docTypes: ["CV", "Passport"] },
            ]);
        } else {
            setEmployers([
                { id: "101", company_name: "BuildCorp", email: "hr@buildcorp.com", location: "Berlin", workers_needed: 5, industry: "Construction", status: "ACTIVE" },
                { id: "102", company_name: "Hotel Lux", email: "info@lux.com", location: "Munich", workers_needed: 2, industry: "Hospitality", status: "ACTIVE" },
            ]);
        }
        setLoading(false);
    };

    const handleLogin = () => {
        localStorage.setItem("auth_token_mock", "true");
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem("auth_token_mock");
        setIsAuthenticated(false);
    };

    const handleSaveEmployer = (emp: any) => {
        if (emp.id) {
            // Edit
            setEmployers(employers.map((e) => (e.id === emp.id ? { ...e, ...emp } : e)));
        } else {
            // Add
            setEmployers([...employers, { ...emp, id: Date.now().toString(), status: "ACTIVE" }]);
        }
        setIsModalOpen(false);
        setEditingEmployer(null);
    };

    const handleDeleteEmployer = (id: string) => {
        if (confirm("Delete this employer?")) {
            setEmployers(employers.filter((e) => e.id !== id));
        }
    };

    if (!isAuthenticated) {
        return <AdminAuth onLogin={handleLogin} />;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6 font-sans">
            <div className="max-w-[1200px] mx-auto">

                {/* Header */}
                <div className="bg-white rounded-xl p-6 shadow-sm mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Workers United Admin</h1>
                        {loading && <span className="text-sm text-gray-500 animate-pulse">Refreshing data...</span>}
                    </div>
                    <div className="flex gap-3">
                        {activeTab === "EMPLOYER" && (
                            <Button onClick={() => { setEditingEmployer(null); setIsModalOpen(true); }}>
                                + Add Employer
                            </Button>
                        )}
                        <button onClick={handleLogout} className="text-red-500 text-sm font-semibold px-3 py-2 hover:bg-red-50 rounded-lg transition-colors">
                            Logout
                        </button>
                    </div>
                </div>

                {/* Content Card */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden min-h-[500px]">

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab("WORKER")}
                            className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === "WORKER" ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Workers
                        </button>
                        <button
                            onClick={() => setActiveTab("EMPLOYER")}
                            className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === "EMPLOYER" ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Employers
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-0">
                        {loading && workers.length === 0 && employers.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">Loading...</div>
                        ) : (
                            <>
                                {activeTab === "WORKER" && <WorkerTable workers={workers} />}
                                {activeTab === "EMPLOYER" && (
                                    <EmployerTable
                                        employers={employers}
                                        onEdit={(emp) => { setEditingEmployer(emp); setIsModalOpen(true); }}
                                        onDelete={handleDeleteEmployer}
                                        onFindMatches={(emp) => alert(`Matching feature coming in Phase 4 for: ${emp.company_name}`)}
                                    />
                                )}
                            </>
                        )}
                    </div>

                </div>

                {/* Modals */}
                <EmployerModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveEmployer}
                    employer={editingEmployer}
                />

            </div>
        </div>
    );
}
