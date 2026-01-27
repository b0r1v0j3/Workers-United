// Meta (Instagram + Facebook) Webhook Handler
// Receives messages from Instagram DM and Facebook Messenger

import { findFAQAnswer, faqDatabase } from './faq-database.js';

// Verify token for webhook subscription (set in Vercel env)
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'workersunited_verify_123';
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

export default async function handler(req, res) {
    // GET request = Webhook verification (Facebook requires this)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ Webhook verified successfully');
            return res.status(200).send(challenge);
        } else {
            console.error('❌ Webhook verification failed');
            return res.status(403).send('Forbidden');
        }
    }

    // POST request = Incoming message
    if (req.method === 'POST') {
        const body = req.body;

        // Verify this is from a page subscription
        if (body.object === 'page' || body.object === 'instagram') {
            // Process each entry (can be multiple)
            for (const entry of body.entry || []) {
                // Get messaging events
                const messagingEvents = entry.messaging || [];

                for (const event of messagingEvents) {
                    if (event.message && event.message.text) {
                        await handleIncomingMessage(event);
                    }
                }
            }

            // Always return 200 quickly to avoid timeout
            return res.status(200).send('EVENT_RECEIVED');
        }

        return res.status(404).send('Not Found');
    }

    return res.status(405).send('Method Not Allowed');
}

// Handle incoming text message
async function handleIncomingMessage(event) {
    const senderId = event.sender.id;
    const messageText = event.message.text;
    const timestamp = event.timestamp;

    console.log(`📩 Message from ${senderId}: "${messageText}"`);

    // Search FAQ database for matching answer
    const faqMatch = findFAQAnswer(messageText);

    let responseText;
    let quickReplies = [];

    if (faqMatch) {
        // Found a matching FAQ
        console.log(`✅ FAQ Match: ${faqMatch.category}`);
        responseText = faqMatch.answer.short;

        // Add quick replies for follow-up
        quickReplies = [
            { content_type: 'text', title: '📋 More Details', payload: `FAQ_DETAIL_${faqMatch.id}` },
            { content_type: 'text', title: '📧 Contact Us', payload: 'CONTACT_US' },
            { content_type: 'text', title: '🌐 Apply Now', payload: 'APPLY_NOW' }
        ];
    } else {
        // No match - send default response
        console.log('❓ No FAQ match, sending default');
        responseText = `Thanks for your message! 👋

I'm an automated assistant for Workers United.

For personalized help with your work visa questions:
📧 Email: contact@workersunited.eu
🌐 Website: workersunited.eu

A team member will respond within 24 hours.`;

        quickReplies = [
            { content_type: 'text', title: '📧 Email Us', payload: 'CONTACT_US' },
            { content_type: 'text', title: '🌐 Visit Website', payload: 'VISIT_WEBSITE' }
        ];
    }

    // Send response
    await sendMessage(senderId, responseText, quickReplies);
}

// Send message via Meta Send API
async function sendMessage(recipientId, text, quickReplies = []) {
    if (!PAGE_ACCESS_TOKEN) {
        console.error('❌ META_PAGE_ACCESS_TOKEN not configured');
        return;
    }

    const messageData = {
        recipient: { id: recipientId },
        message: {
            text: text
        }
    };

    // Add quick replies if provided
    if (quickReplies.length > 0) {
        messageData.message.quick_replies = quickReplies;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageData)
            }
        );

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ Message sent to ${recipientId}`);
        } else {
            console.error('❌ Send failed:', result);
        }

        return result;
    } catch (error) {
        console.error('❌ Send error:', error);
        throw error;
    }
}

// Handle quick reply button clicks
export async function handleQuickReply(senderId, payload) {
    let responseText;

    if (payload.startsWith('FAQ_DETAIL_')) {
        const faqId = parseInt(payload.replace('FAQ_DETAIL_', ''));
        const faq = faqDatabase.find(f => f.id === faqId);

        if (faq) {
            responseText = faq.answer.detailed;
        } else {
            responseText = 'Sorry, I could not find more details on that topic.';
        }
    } else if (payload === 'CONTACT_US') {
        responseText = `📧 Contact Workers United:

Email: contact@workersunited.eu
Website: www.workersunited.eu

Our team responds within 24 hours on business days.`;
    } else if (payload === 'APPLY_NOW' || payload === 'VISIT_WEBSITE') {
        responseText = `🌐 Ready to start your journey?

Visit our website to submit your application:
👉 www.workersunited.eu

The process takes just 5 minutes!`;
    }

    if (responseText) {
        await sendMessage(senderId, responseText);
    }
}
