"use server";

import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { redirect } from "next/navigation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-04-10" as any,
});

export async function createCheckoutSession() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Feature flag check
    const paymentsEnabled = process.env.PAYMENTS_ENABLED === "true";
    const hasKeys = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_ENTRY_FEE_PRICE_ID;

    if (!paymentsEnabled || !hasKeys) {
        throw new Error("Payments are currently disabled.");
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price: process.env.STRIPE_ENTRY_FEE_PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile/worker?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile/worker`,
            customer_email: user.email,
            metadata: {
                userId: user.id,
            },
        });

        if (session.url) {
            redirect(session.url);
        }
    } catch (err: any) {
        // Next.js redirect() works by throwing — don't catch it
        if (err?.digest?.startsWith("NEXT_REDIRECT")) {
            throw err;
        }
        console.error("Stripe error:", err);
        throw new Error("Failed to create checkout session.");
    }
}
