import Link from "next/link";

export function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="bg-bg-alt border-t border-border mt-auto">
            <div className="container mx-auto px-5 py-10 max-w-[1120px]">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left">
                        <div className="text-sm font-semibold text-primary mb-1">
                            Workers United LLC
                        </div>
                        <div className="text-xs text-muted">
                            75 E 3rd St., Sheridan, Wyoming 82801, USA
                        </div>
                        <div className="text-xs text-muted mt-2">
                            © {year} Workers United. All rights reserved.
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2">
                        <div className="flex gap-4 text-sm text-primary font-medium">
                            <a href="mailto:contact@workersunited.eu" className="hover:underline">
                                contact@workersunited.eu
                            </a>
                        </div>
                        <div className="flex gap-4 text-xs text-muted">
                            <Link href="/privacy-policy" className="hover:text-primary">
                                Privacy Policy
                            </Link>
                            <span>|</span>
                            <Link href="/terms" className="hover:text-primary">
                                Terms and Conditions
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center text-xs text-muted/60 font-medium tracking-wider uppercase">
                    Safe • Legal • Transparent
                </div>
            </div>
        </footer>
    );
}
