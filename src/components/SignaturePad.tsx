"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

interface SignaturePadProps {
    onSave: (signatureData: string) => void;
    agreementText?: string;
}

export function SignaturePad({ onSave, agreementText }: SignaturePadProps) {
    const sigRef = useRef<SignatureCanvas>(null);
    const [agreed, setAgreed] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    const handleClear = () => {
        sigRef.current?.clear();
        setIsEmpty(true);
    };

    const handleSave = () => {
        if (!sigRef.current || isEmpty || !agreed) return;

        const signatureData = sigRef.current.toDataURL("image/png");
        onSave(signatureData);
    };

    const handleEnd = () => {
        setIsEmpty(sigRef.current?.isEmpty() ?? true);
    };

    const defaultAgreement =
        "I agree that this digital signature will be used for employment application purposes only, " +
        "including but not limited to work permit applications, visa documentation, and employment contracts.";

    return (
        <div className="w-full max-w-lg">
            {/* Signature Canvas */}
            <div className="border-2 border-dashed border-[#dde3ec] rounded-xl bg-white overflow-hidden mb-4">
                <SignatureCanvas
                    ref={sigRef}
                    canvasProps={{
                        className: "w-full h-48 cursor-crosshair",
                        style: { width: "100%", height: "192px" }
                    }}
                    backgroundColor="white"
                    penColor="#1e293b"
                    onEnd={handleEnd}
                />
            </div>

            {/* Clear Button */}
            <div className="flex justify-end mb-4">
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-sm text-[#64748b] hover:text-[#1e293b] font-medium"
                >
                    Clear Signature
                </button>
            </div>

            {/* Agreement Checkbox */}
            <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-[#dde3ec] text-[#2f6fed] focus:ring-[#2f6fed]"
                    />
                    <span className="text-sm text-[#64748b] leading-relaxed group-hover:text-[#1e293b]">
                        {agreementText || defaultAgreement}
                    </span>
                </label>
            </div>

            {/* Save Button */}
            <button
                type="button"
                onClick={handleSave}
                disabled={isEmpty || !agreed}
                className={`w-full py-3 px-6 rounded-xl font-bold text-white transition-all ${isEmpty || !agreed
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-[#2f6fed] hover:bg-[#1e5cd6] shadow-lg hover:shadow-xl"
                    }`}
            >
                {isEmpty
                    ? "Please sign above"
                    : !agreed
                        ? "Please agree to the terms"
                        : "Save Signature"
                }
            </button>
        </div>
    );
}
