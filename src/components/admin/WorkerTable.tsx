
"use client";

import { Button } from "@/components/ui/Button";

interface Worker {
    id: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    role: string;
    status: string;
    hasDocs: boolean;
    docTypes?: string[];
}

interface WorkerTableProps {
    workers: Worker[];
}

export function WorkerTable({ workers }: WorkerTableProps) {
    const getStatusBadge = (s: string) => {
        let color = "bg-blue-100 text-blue-800";
        if (s === "DOCS REQUESTED") color = "bg-yellow-100 text-yellow-800";
        else if (s === "DOCS RECEIVED") color = "bg-purple-100 text-purple-800";
        else if (s === "UNDER REVIEW") color = "bg-indigo-100 text-indigo-800";
        else if (s === "APPROVED") color = "bg-green-100 text-green-800";
        else if (s === "REJECTED") color = "bg-red-100 text-red-800";

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>
                {s}
            </span>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
                        <th className="p-3 font-medium">#</th>
                        <th className="p-3 font-medium">Candidate</th>
                        <th className="p-3 font-medium">Phone</th>
                        <th className="p-3 font-medium">Documents</th>
                        <th className="p-3 font-medium">Country</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {workers.map((worker, i) => (
                        <tr key={worker.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="p-3 text-gray-400">{i + 1}</td>
                            <td className="p-3">
                                <div className="font-semibold text-gray-900">{worker.name}</div>
                                <div className="text-xs text-gray-500">{worker.email}</div>
                            </td>
                            <td className="p-3 text-primary">{worker.phone}</td>
                            <td className="p-3">
                                {worker.hasDocs ? (
                                    <div>
                                        <span className="text-xs bg-lime-100 text-lime-800 px-1.5 py-0.5 rounded">Has Docs</span>
                                        {worker.docTypes && <div className="text-[10px] text-gray-400 mt-1">{worker.docTypes.join(", ")}</div>}
                                    </div>
                                ) : (
                                    <span className="text-gray-300">No docs</span>
                                )}
                            </td>
                            <td className="p-3">{worker.country}</td>
                            <td className="p-3">{getStatusBadge(worker.status)}</td>
                            <td className="p-3 flex gap-2">
                                <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                                    Action
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
