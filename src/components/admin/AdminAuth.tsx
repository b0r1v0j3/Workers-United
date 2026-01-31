"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface AdminAuthProps {
    onLogin: () => void;
}

export function AdminAuth({ onLogin }: AdminAuthProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Simulate API call
        setTimeout(() => {
            if (password === "admin123") { // Mock password
                setStep(2);
            } else {
                setError("Invalid password");
            }
            setLoading(false);
        }, 1000);
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Simulate API call
        setTimeout(() => {
            if (otp === "123456") { // Mock OTP
                onLogin();
            } else {
                setError("Invalid code");
            }
            setLoading(false);
        }, 1000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h1 className="text-2xl font-bold text-center mb-2">Admin Login</h1>
                <p className="text-center text-gray-500 mb-6">Secure Access Only</p>

                {step === 1 ? (
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="mb-4">
                            <input
                                type="password"
                                placeholder="Enter Password"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                        <Button type="submit" className="w-full justify-center" disabled={loading}>
                            {loading ? "Checking..." : "Next"}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify}>
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="000 000"
                                maxLength={6}
                                className="w-full p-3 border border-gray-300 rounded-lg text-center text-xl tracking-[0.5em] focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                        <Button type="submit" className="w-full justify-center" disabled={loading}>
                            {loading ? "Verifying..." : "Verify"}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}
