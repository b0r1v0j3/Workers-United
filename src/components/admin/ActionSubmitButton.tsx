"use client";

import { useFormStatus } from "react-dom";

export default function ActionSubmitButton({
    idleLabel,
    pendingLabel,
    className,
}: {
    idleLabel: string;
    pendingLabel: string;
    className: string;
}) {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`}
        >
            {pending ? pendingLabel : idleLabel}
        </button>
    );
}
