// Stripe Webhook Handler
// POST /api/stripe-webhook

import { buffer } from 'micro';

export const config = {
    api: {
        bodyParser: false, // Required for Stripe webhook verification
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeSecretKey);

        // Get the raw body
        const buf = await buffer(req);
        const sig = req.headers['stripe-signature'];

        let event;

        // Verify webhook signature if secret is configured
        if (webhookSecret && sig) {
            try {
                event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                return res.status(400).json({ error: 'Webhook signature verification failed' });
            }
        } else {
            // For testing without signature verification
            event = JSON.parse(buf.toString());
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutComplete(event.data.object);
                break;

            case 'payment_intent.succeeded':
                console.log('Payment intent succeeded:', event.data.object.id);
                break;

            case 'payment_intent.payment_failed':
                console.log('Payment failed:', event.data.object.id);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleCheckoutComplete(session) {
    const email = session.metadata?.email || session.customer_email;
    const product = session.metadata?.product || 'waitlist';
    const amountPaid = session.amount_total;

    console.log(`✅ Payment completed: ${email} paid ${amountPaid} cents for ${product}`);

    try {
        const { sql } = await import('@vercel/postgres');

        // Update payment record
        await sql`
      UPDATE payments 
      SET status = 'PAID', paid_at = NOW()
      WHERE stripe_session_id = ${session.id}
    `;

        // Update candidate status based on product type
        if (product === 'waitlist') {
            await sql`
        UPDATE candidates 
        SET status = 'WAITLIST',
            updated_at = NOW()
        WHERE email = ${email}
      `;

            // Queue payment confirmation email
            await sql`
        INSERT INTO email_queue (candidate_email, candidate_name, email_type, send_at)
        SELECT ${email}, name, 'payment_confirm', NOW()
        FROM candidates WHERE email = ${email}
      `;

        } else if (product === 'serbia') {
            await sql`
        UPDATE candidates 
        SET status = 'PAID_FULL',
            updated_at = NOW()
        WHERE email = ${email}
      `;

            // TODO: Queue contract signing email
        }

        console.log(`✅ Updated status for ${email} to ${product === 'waitlist' ? 'WAITLIST' : 'PAID_FULL'}`);

    } catch (dbError) {
        console.error('Failed to update database after payment:', dbError);
    }
}
