// FAQ Database - Most Common Candidate Questions
export const faqDatabase = [
    {
        id: 1,
        category: "Pricing",
        question: "How much does the work visa process cost?",
        keywords: ["cost", "price", "fee", "pay", "much", "expensive"],
        answer: {
            short: "Our service fee is €2,500-€3,500 depending on your destination country and job type.",
            detailed: `Our transparent pricing includes:
        ✅ Legal consultation and case evaluation
        ✅ Complete document preparation and verification  
        ✅ Work visa application processing
        ✅ Employer matching and job placement
        ✅ Employment contract review
        ✅ 3 months of post-arrival support
        
        💳 Payment plans available. No hidden fees.`
        }
    },
    {
        id: 2,
        category: "Timeline",
        question: "How long does the work visa process take?",
        keywords: ["long", "time", "duration", "when", "fast", "quick", "wait"],
        answer: {
            short: "The complete process typically takes 3-6 months from application to arrival in Europe.",
            detailed: `Timeline breakdown:
        📋 Week 1-2: Document review and verification
        🤝 Week 3-4: Employer matching and job offer
        📄 Month 2-4: Visa application processing
        ✈️ Month 5-6: Travel arrangements and arrival
        
        ⚡ Express processing available for urgent cases (additional fee).`
        }
    },
    {
        id: 3,
        category: "Countries",
        question: "Which European countries can I work in?",
        keywords: ["country", "countries", "where", "location", "destination", "europe"],
        answer: {
            short: "We currently place workers in Germany, Poland, Czech Republic, Romania, and Hungary.",
            detailed: `Popular destinations:
        🇩🇪 Germany - Strong economy, high wages, manufacturing & healthcare
        🇵🇱 Poland - Growing IT sector, logistics, construction
        🇨🇿 Czech Republic - Automotive, engineering, hospitality
        🇷🇴 Romania - Agriculture, tech, customer service
        🇭🇺 Hungary - Food processing, warehousing, IT
        
        💼 Country depends on your skills and employer availability.`
        }
    },
    {
        id: 4,
        category: "Documents",
        question: "What documents do I need?",
        keywords: ["document", "papers", "need", "require", "passport", "diploma"],
        answer: {
            short: "You need: Valid passport, educational certificates, updated CV, and proof of work experience (if any).",
            detailed: `Required documents:
        ✅ Valid passport (min. 6 months validity)
        ✅ Educational certificates (diploma, degree, or trade certificates)
        ✅ Updated CV/Resume with work history
        ✅ Birth certificate
        ✅ Police clearance certificate (criminal record check)
        ✅ Medical certificate (health check)
        ✅ Passport-sized photos (6 pcs, white background)
        
        📤 All documents can be uploaded securely via your candidate portal.`
        }
    },
    {
        id: 5,
        category: "Language",
        question: "Do I need to speak the local language?",
        keywords: ["language", "speak", "english", "german", "polish"],
        answer: {
            short: "Basic English is usually sufficient. Language requirements depend on the job type.",
            detailed: `Language requirements:
        ✅ BASIC JOBS (warehouse, manufacturing): Basic English OK
        ✅ SKILLED JOBS (IT, engineering): English fluent
        ✅ CUSTOMER-FACING (hospitality, sales): Local language preferred
        
        📚 We provide free language learning resources after placement.
        🎓 Some employers offer language training as part of employment.`
        }
    },
    {
        id: 6,
        category: "Family",
        question: "Can I bring my family?",
        keywords: ["family", "wife", "husband", "children", "kids", "spouse"],
        answer: {
            short: "Yes! Family reunification visas are available after you secure employment and residence.",
            detailed: `Family reunification process:
        👨‍👩‍👧 Spouse + children allowed
        ⏱️ Available 6-12 months after your arrival
        📄 Requires proof of stable income & accommodation
        💰 Additional fee: €1,500 per family member
        
        🏠 We assist with family visa applications.`
        }
    },
    {
        id: 7,
        category: "Payment",
        question: "How do I pay? Can I pay in installments?",
        keywords: ["payment", "installment", "plan", "split", "deposit"],
        answer: {
            short: "Yes! We offer flexible payment plans: 30% deposit + 3 monthly installments.",
            detailed: `Payment options:
        💳 OPTION 1: Full payment (€X) - 5% discount
        💳 OPTION 2: 50% now + 50% before visa submission
        💳 OPTION 3: 30% deposit + 3 monthly installments
        
        Accepted methods:
        ✅ Bank transfer
        ✅ PayPal
        ✅ Wise (TransferWise)
        ✅ Credit/Debit card
        
        🔒 Secure payment gateway. Money-back guarantee if visa denied due to our error.`
        }
    },
    {
        id: 8,
        category: "Rejection",
        question: "What happens if my visa is rejected?",
        keywords: ["reject", "denied", "fail", "refuse", "guarantee"],
        answer: {
            short: "If your visa is rejected due to our error, you get a full refund. If it's due to false documents, no refund.",
            detailed: `Rejection policy:
        ✅ OUR FAULT (documentation error): 100% refund
        ✅ YOUR FAULT (false info, missing docs): No refund
        ✅ REAPPLICATION: 50% discount on reapplication fee
        
        📊 Our success rate: 95% visa approval
        🛡️ We pre-screen all applications to minimize rejection risk.`
        }
    },
    {
        id: 9,
        category: "Jobs",
        question: "What kind of jobs are available?",
        keywords: ["job", "work", "position", "role", "career"],
        answer: {
            short: "We place workers in manufacturing, IT, healthcare, hospitality, logistics, and agriculture sectors.",
            detailed: `Current job categories:
        🏭 MANUFACTURING: Machine operators, assembly line, quality control
        💻 IT & TECH: Software developers, data analysts, tech support
        🏥 HEALTHCARE: Nurses, caregivers, medical assistants
        🏨 HOSPITALITY: Hotel staff, chefs, restaurant workers
        🚚 LOGISTICS: Warehouse workers, drivers, forklift operators
        🌾 AGRICULTURE: Farm workers, harvesting, food processing
        
        💼 Salary and benefits vary by country, employer, and role. Details will be provided during the placement process.`
        }
    },
    {
        id: 10,
        category: "Legal",
        question: "Is this process legal?",
        keywords: ["legal", "scam", "legit", "trust", "safe"],
        answer: {
            short: "Yes! We are a registered legal entity and fully comply with EU labor laws.",
            detailed: `Legal credentials:
        ✅ Registered company: Workers United LLC
        ✅ Licensed recruitment agency
        ✅ GDPR compliant
        ✅ Partnerships with verified European employers
        ✅ Transparent contracts and invoices
        
        🔍 You can verify our registration: [Company Registration Number]
        📜 All employment contracts reviewed by legal team before signing.`
        }
    }
];

// Keyword matcher function
export function findFAQAnswer(message) {
    const lowerMessage = message.toLowerCase();

    for (const faq of faqDatabase) {
        const matched = faq.keywords.some(keyword => lowerMessage.includes(keyword));
        if (matched) {
            return faq;
        }
    }

    return null; // No match found
}
