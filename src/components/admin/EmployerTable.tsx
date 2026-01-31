"use client";

import { Button } from "@/components/ui/Button";

interface Employer {
    id: string;
    company_name: string;
    email: string;
    location: string;
    workers_needed: number;
    industry: string;
    status: string;
}

interface EmployerTableProps {
    employers: Employer[];
    onEdit: (emp: Employer) => void;
    onDelete: (id: string) => void;
    onFindMatches: (emp: Employer) => void;
}

export function EmployerTable({ employers, onEdit, onDelete, onFindMatches }: EmployerTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
                        <th className="p-3 font-medium">#</th>
                        <th className="p-3 font-medium">Company</th>
                        <th className="p-3 font-medium">Email</th>
                        <th className="p-3 font-medium">Location</th>
                        <th className="p-3 font-medium">Needed</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {employers.map((emp, i) => (
                        <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="p-3 text-gray-400">{i + 1}</td>
                            <td className="p-3">
                                <div className="font-semibold text-gray-900">{emp.company_name}</div>
                                <div className="text-xs text-gray-500">{emp.industry}</div>
                            </td>
                            <td className="p-3">{emp.email}</td>
                            <td className="p-3">{emp.location}</td>
                            <td className="p-3">{emp.workers_needed}</td>
                            <td className="p-3 max-w-[100px]">
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                    {emp.status}
                                </span>
                            </td>
                            <td className="p-3 flex gap-2">
                                <button
                                    onClick={() => onEdit(emp)}
                                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => onFindMatches(emp)}
                                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                >
                                    Find Candidates
                                </button>
                                <button
                                    onClick={() => onDelete(emp.id)}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                                >
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
