"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs = [
        {
            question: "Do you charge workers hidden fees?",
            answer: "We are against hidden fees and \"surprise payments\". Before we start any process, we explain clearly if there are any costs and who pays what – worker, employer or both.",
        },
        {
            question: "Which countries do you work with?",
            answer: "Our focus is on employers in Europe and workers from different regions who want legal work and long-term cooperation. If your country is not sure, write to us and we will tell you honestly if we can help or not.",
        },
        {
            question: "Do I need to speak English?",
            answer: "Basic communication is always helpful, but we understand that not everyone speaks perfect English. You may send messages in your local language, and we will do our best to understand and respond clearly.",
        },
        {
            question: "Are you a classic agency or more like an advisor?",
            answer: "We help connect workers and employers, but also act as advisors – especially around documents, contracts and expectations. In practice, our role is to protect both sides from misunderstandings and unsafe situations.",
        },
    ];

    return (
        <section id="faq" className="py-20 md:py-24 bg-white">
            <div className="container mx-auto px-5 max-w-[720px]">
                <div className="text-center mb-12">
                    <div className="text-xs uppercase tracking-[0.12em] text-muted mb-2">Questions & answers</div>
                    <h2 className="text-2xl md:text-3xl font-bold text-primary mb-3">Frequently asked questions</h2>
                    <p className="text-sm text-muted">
                        If you are not sure, send us a message – it is better to ask now than to regret later.
                    </p>
                </div>

                <div className="grid gap-3">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div
                                key={index}
                                className={cn(
                                    "bg-bg-alt rounded-[999px] border border-border overflow-hidden transition-all duration-200",
                                    isOpen && "rounded-2xl shadow-[0_18px_45px_rgba(9,30,66,0.15)] border-primary-soft/40"
                                )}
                            >
                                <button
                                    className="flex items-center justify-between w-full px-5 py-3.5 text-left"
                                    onClick={() => setOpenIndex(isOpen ? null : index)}
                                >
                                    <span className="text-sm font-medium text-primary">{faq.question}</span>
                                    <span className="w-[22px] h-[22px] rounded-full border border-[#183b56]/20 flex items-center justify-center text-muted shrink-0 text-sm">
                                        {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="px-5 pb-4 text-[13px] text-muted leading-relaxed">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
