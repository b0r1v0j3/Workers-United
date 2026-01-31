"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: "Home", href: "/" },
        { name: "How it works", href: "/#how-it-works" },
        { name: "For workers", href: "/#workers" },
        { name: "For employers", href: "/#employers" },
        { name: "Check Status", href: "/status", className: "text-primary-soft font-semibold" },
    ];

    return (
        <header
            className={cn(
                "sticky top-0 z-50 w-full transition-all duration-300",
                scrolled
                    ? "bg-[#f4f6fb]/90 backdrop-blur-md border-b border-[#dde3ec]/70"
                    : "bg-transparent"
            )}
        >
            <div className="container mx-auto px-5 max-w-[1120px]">
                <div className="flex items-center justify-between h-[80px]">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="relative w-12 h-12">
                            <Image
                                src="/assets/workers-united-logo.png"
                                alt="Workers United"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        <span className="font-bold text-lg text-primary tracking-tight font-montserrat">
                            Workers United
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={cn(
                                    "text-sm font-medium text-muted transition-colors hover:text-primary relative py-1",
                                    "after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-primary-soft after:scale-x-0 after:origin-right after:transition-transform hover:after:scale-x-100 hover:after:origin-left",
                                    link.className
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <Button href="/#contact" size="sm" className="rounded-full">
                            Contact us
                        </Button>
                    </nav>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-primary"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle menu"
                    >
                        {isOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Nav */}
            {isOpen && (
                <div className="absolute top-[80px] left-0 w-full bg-white border-b border-border shadow-soft p-5 flex flex-col gap-4 md:hidden">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                "text-base font-medium text-muted py-2 hover:text-primary",
                                link.className
                            )}
                            onClick={() => setIsOpen(false)}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <Button href="/#contact" className="w-full justify-center" onClick={() => setIsOpen(false)}>
                        Contact us
                    </Button>
                </div>
            )}
        </header>
    );
}
