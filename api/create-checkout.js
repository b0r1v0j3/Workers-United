// Create Stripe Checkout Session
// POST /api/create-checkout

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, product, amount } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
            return res.status(500).json({ error: 'Stripe not configured. Please add STRIPE_SECRET_KEY to environment variables.' });
        }

        // Import Stripe
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeSecretKey);

        // Determine product details based on type
        let productName, productAmount, productDescription;

        if (product === 'waitlist') {
            productName = 'Priority Waitlist';
            productAmount = 900; // $9
            productDescription = 'Join the priority waitlist for job matching. 90-day money-back guarantee.';
        } else if (product === 'serbia') {
            productName = 'Serbia Work Visa Package';
            productAmount = 19000; // $190
            productDescription = 'Complete work visa package for Serbia including contract preparation and legal support.';
        } else {
            productName = 'Custom Payment';
            productAmount = amount || 900;
            productDescription = 'Workers United Service';
        }

        // Get or create customer
        let customer;
        const existingCustomers = await stripe.customers.list({ email: email, limit: 1 });

        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            customer = await stripe.customers.create({ email: email });
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: productName,
                            description: productDescription,
                        },
                        unit_amount: productAmount,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                email: email,
                product: product || 'waitlist',
            },
            success_url: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://www.workersunited.eu'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://www.workersunited.eu'}/payment?email=${encodeURIComponent(email)}`,
        });

        // Store pending payment in database
        try {
            const { sql } = await import('@vercel/postgres');

            await sql`
        INSERT INTO payments (candidate_email, stripe_session_id, amount_cents, status)
        VALUES (${email}, ${session.id}, ${productAmount}, 'PENDING')
        ON CONFLICT DO NOTHING
      `;
        } catch (dbError) {
            console.error('Failed to store payment record:', dbError);
            // Continue anyway - payment still works
        }

        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error('Stripe error:', error);
        return res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
}
