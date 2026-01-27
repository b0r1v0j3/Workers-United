import { faqDatabase, findFAQAnswer } from './faq-database.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET /api/faq - Return all FAQs
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        faqs: faqDatabase
      });
    }

    // POST /api/faq - Smart search
    if (req.method === 'POST') {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a message/question'
        });
      }

      const matchedFAQ = findFAQAnswer(message);

      if (matchedFAQ) {
        return res.status(200).json({
          success: true,
          matched: true,
          faq: matchedFAQ,
          answer: matchedFAQ.answer.detailed
        });
      } else {
        return res.status(200).json({
          success: true,
          matched: false,
          message: "I couldn't find an exact answer to your question. Please check our full FAQ page or contact us at contact@workersunited.eu"
        });
      }
    }

    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error) {
    console.error('FAQ API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}
