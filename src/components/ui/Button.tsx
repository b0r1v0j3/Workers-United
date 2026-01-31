import Link from "next/link";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "outline";
    size?: "sm" | "md" | "lg";
    href?: string;
    className?: string;
}

export function Button({
    children,
    variant = "primary",
    size = "md",
    href,
    className,
    ...props
}: ButtonProps) {
    const baseStyles = "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-gradient-to-r from-primary-soft to-[#1c4dd6] text-white shadow-lg shadow-primary-soft/30 hover:-translate-y-0.5 hover:shadow-xl",
        secondary: "bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20",
        ghost: "bg-white/70 text-primary border border-primary/10 hover:bg-white/90 hover:-translate-y-0.5",
        outline: "border border-border text-muted hover:text-primary hover:border-primary",
    };

    const sizes = {
        sm: "px-4 py-2 text-xs",
        md: "px-6 py-2.5 text-sm",
        lg: "px-8 py-3 text-base",
    };

    const styles = cn(baseStyles, variants[variant], sizes[size], className);

    if (href) {
        return (
            <Link href={href} className={styles}>
                {children}
            </Link>
        );
    }

    return (
        <button className={styles} {...props}>
            {children}
        </button>
    );
}
