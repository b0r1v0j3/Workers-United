"use client";

import { Upload, FileCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function DocumentVault() {
    return (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <FileCheck size={18} className="text-primary" />
                    Document Vault
                </h3>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Action Required</span>
            </div>

            <p className="text-xs text-gray-500">
                Please upload the following documents to verify your company and enable visa processing.
            </p>

            <div className="space-y-3">

                {/* Doc Item 1 */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded border border-gray-200 flex items-center justify-center text-gray-400">
                            <FileText size={14} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-700">Company Registration (HRB)</div>
                            <div className="text-[10px] text-red-500 font-medium">Missing</div>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                        <Upload size={12} /> Upload
                    </Button>
                </div>

                {/* Doc Item 2 */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded border border-gray-200 flex items-center justify-center text-gray-400">
                            <FileText size={14} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-700">Proof of Address</div>
                            <div className="text-[10px] text-red-500 font-medium">Missing</div>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                        <Upload size={12} /> Upload
                    </Button>
                </div>

                {/* Doc Item 3 */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded border border-green-200 flex items-center justify-center text-green-600">
                            <Check size={14} strokeWidth={3} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-900">Service Agreement</div>
                            <div className="text-[10px] text-green-600 font-medium">Verified</div>
                        </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-green-700 hover:text-green-800 hover:bg-green-100">
                        View
                    </Button>
                </div>

            </div>
        </div>
    );
}

import { Check, FileText } from "lucide-react";
