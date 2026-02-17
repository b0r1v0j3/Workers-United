"use client";

import { Toaster } from "sonner";

export default function ToastProvider() {
    return (
        <Toaster
            position="bottom-right"
            richColors
            theme="light"
            closeButton
            style={{
                fontFamily: 'Montserrat, sans-serif'
            }}
        />
    );
}
