// AI Document Verification API
// Uses OpenAI GPT-4 Vision to verify passport, photo, and diploma documents

import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const config = {
    api: {
        bodyParser: false, // We need raw body for file upload
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse multipart form data
        const formData = await parseFormData(req);
        const { file, type, email, candidateName } = formData;

        if (!file || !type || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`📄 Verifying ${type} for ${email}`);

        // Upload file to Vercel Blob
        const blob = await put(`documents/${email}/${type}_${Date.now()}`, file.buffer, {
            access: 'public',
            contentType: file.contentType
        });

        console.log(`📤 File uploaded: ${blob.url}`);

        // Get candidate ID (case-insensitive email match)
        const candidateResult = await sql`
            SELECT id FROM candidates WHERE LOWER(email) = LOWER(${email}) LIMIT 1
        `;

        if (candidateResult.rows.length === 0) {
            return res.status(404).json({
                verified: false,
                error: 'Your application was not found. Please make sure you used the correct link from your email.'
            });
        }

        const candidateId = candidateResult.rows[0].id;

        // Store document in database
        await sql`
            INSERT INTO documents (candidate_id, type, url, filename, verified)
            VALUES (${candidateId}, ${type}, ${blob.url}, ${file.filename}, false)
            ON CONFLICT (candidate_id, type) 
            DO UPDATE SET url = ${blob.url}, filename = ${file.filename}, verified = false, uploaded_at = NOW()
        `;

        // If no OpenAI key, skip AI verification but accept the document
        if (!OPENAI_API_KEY) {
            console.log('⚠️ No OpenAI key - skipping AI verification');

            // Mark as verified (manual review later)
            await updateVerificationStatus(candidateId, type, true);

            return res.status(200).json({
                verified: true,
                message: 'Document uploaded successfully. Manual review pending.',
                url: blob.url
            });
        }

        // AI Verification using OpenAI Vision
        const verificationResult = await verifyDocumentWithAI(
            blob.url,
            type,
            candidateName
        );

        // Update verification status
        await updateVerificationStatus(candidateId, type, verificationResult.verified);

        // Update document record
        await sql`
            UPDATE documents
            SET verified = ${verificationResult.verified},
                verification_data = ${JSON.stringify(verificationResult)}
            WHERE candidate_id = ${candidateId} AND type = ${type}
        `;

        // Check if all documents are verified
        await checkAllDocumentsVerified(candidateId, email);

        return res.status(200).json({
            verified: verificationResult.verified,
            message: verificationResult.message,
            extractedData: verificationResult.extractedData,
            error: verificationResult.error
        });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({
            verified: false,
            error: 'Verification failed. Please try again.'
        });
    }
}

// Parse multipart form data
async function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = req.headers['content-type'];

            // Simple multipart parser
            const boundary = contentType.split('boundary=')[1];
            const parts = buffer.toString().split(`--${boundary}`);

            const result = {};

            for (const part of parts) {
                if (part.includes('name="file"')) {
                    const filenameMatch = part.match(/filename="([^"]+)"/);
                    const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);

                    // Extract binary data
                    const headerEnd = part.indexOf('\r\n\r\n');
                    const dataStart = headerEnd + 4;
                    const dataEnd = part.lastIndexOf('\r\n');

                    result.file = {
                        filename: filenameMatch ? filenameMatch[1] : 'document',
                        contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                        buffer: Buffer.from(part.slice(dataStart, dataEnd), 'binary')
                    };
                } else if (part.includes('name="type"')) {
                    result.type = extractFormValue(part);
                } else if (part.includes('name="email"')) {
                    result.email = extractFormValue(part);
                } else if (part.includes('name="candidateName"')) {
                    result.candidateName = extractFormValue(part);
                }
            }

            resolve(result);
        });
        req.on('error', reject);
    });
}

function extractFormValue(part) {
    const lines = part.split('\r\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === '' && lines[i + 1]) {
            return lines[i + 1].trim();
        }
    }
    return '';
}

// AI Document Verification with OpenAI Vision
async function verifyDocumentWithAI(imageUrl, documentType, candidateName) {
    const prompts = {
        passport: `Analyze this passport image. Extract and return:
1. Full name on passport
2. Passport number
3. Nationality
4. Date of birth
5. Expiry date
6. Is the passport valid (not expired, must be valid for at least 1 YEAR from today, readable, genuine-looking)?

The candidate claims their name is: "${candidateName}"

Respond in JSON format:
{
    "fullName": "...",
    "passportNumber": "...",
    "nationality": "...",
    "dateOfBirth": "...",
    "expiryDate": "...",
    "isValid": true/false,
    "nameMatches": true/false,
    "issues": ["list any issues found"]
}`,

        photo: `Analyze this passport-style photo. Check:
1. Is there a clear human face visible?
2. Is the background white or light colored?
3. Is the person looking at the camera?
4. Is the photo high quality (not blurry)?
5. Is the person wearing glasses or head covering?

Respond in JSON format:
{
    "faceDetected": true/false,
    "backgroundOk": true/false,
    "lookingAtCamera": true/false,
    "photoQuality": "good/acceptable/poor",
    "hasGlasses": true/false,
    "hasHeadCovering": true/false,
    "isAcceptable": true/false,
    "issues": ["list any issues"]
}`,

        diploma: `Analyze this diploma/certificate image. Extract:
1. Name on the document
2. Institution name
3. Degree/qualification type
4. Date issued
5. Is it a legitimate-looking document?

The candidate claims their name is: "${candidateName}"

Respond in JSON format:
{
    "nameOnDocument": "...",
    "institution": "...",
    "qualification": "...",
    "dateIssued": "...",
    "appearsLegitimate": true/false,
    "nameMatches": true/false,
    "issues": ["list any issues"]
}`
    };

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompts[documentType] || 'Describe this document.' },
                            { type: 'image_url', image_url: { url: imageUrl } }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'OpenAI API error');
        }

        const content = data.choices[0].message.content;

        // Parse JSON from response
        let extractedData;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch (e) {
            extractedData = { rawResponse: content };
        }

        // Determine verification result based on document type
        let verified = false;
        let message = '';
        let error = null;

        if (documentType === 'passport') {
            verified = extractedData.isValid && extractedData.nameMatches;
            if (!extractedData.isValid) {
                error = 'Passport appears invalid or expires too soon. Your passport must be valid for at least 1 year.';
            } else if (!extractedData.nameMatches) {
                error = `Name mismatch: Passport shows "${extractedData.fullName}" but you entered "${candidateName}". Please check your information.`;
            } else {
                message = `Passport verified! Name: ${extractedData.fullName}, Expires: ${extractedData.expiryDate}`;
            }
        } else if (documentType === 'photo') {
            verified = extractedData.isAcceptable && extractedData.faceDetected;
            if (!extractedData.faceDetected) {
                error = 'No clear face detected. Please upload a proper passport photo.';
            } else if (!extractedData.isAcceptable) {
                error = `Photo issues: ${(extractedData.issues || []).join(', ')}`;
            } else {
                message = 'Photo verified! Meets passport photo requirements.';
            }
        } else if (documentType === 'diploma') {
            verified = extractedData.appearsLegitimate && (extractedData.nameMatches !== false);
            if (!extractedData.appearsLegitimate) {
                error = 'Document does not appear to be a valid diploma or certificate.';
            } else if (extractedData.nameMatches === false) {
                error = `Name mismatch on diploma. Document shows "${extractedData.nameOnDocument}".`;
            } else {
                message = `Diploma verified! ${extractedData.qualification} from ${extractedData.institution}`;
            }
        }

        return {
            verified,
            message,
            error,
            extractedData
        };

    } catch (error) {
        console.error('OpenAI Vision error:', error);
        return {
            verified: false,
            error: 'AI verification failed. Document will be manually reviewed.',
            extractedData: null
        };
    }
}

// Update verification status in document_requirements table
async function updateVerificationStatus(candidateId, documentType, verified) {
    const columnMap = {
        passport: 'passport_verified',
        photo: 'photo_verified',
        diploma: 'diploma_verified'
    };

    const column = columnMap[documentType];
    if (!column) return;

    // Check if record exists
    const existing = await sql`
        SELECT id FROM document_requirements WHERE candidate_id = ${candidateId} LIMIT 1
    `;

    if (existing.rows.length === 0) {
        // Create record
        await sql`
            INSERT INTO document_requirements (candidate_id, ${sql.identifier([column])})
            VALUES (${candidateId}, ${verified})
        `;
    } else {
        // Update specific column
        if (documentType === 'passport') {
            await sql`UPDATE document_requirements SET passport_verified = ${verified} WHERE candidate_id = ${candidateId}`;
        } else if (documentType === 'photo') {
            await sql`UPDATE document_requirements SET photo_verified = ${verified} WHERE candidate_id = ${candidateId}`;
        } else if (documentType === 'diploma') {
            await sql`UPDATE document_requirements SET diploma_verified = ${verified} WHERE candidate_id = ${candidateId}`;
        }
    }
}

// Check if all documents are verified and trigger auto-approval
async function checkAllDocumentsVerified(candidateId, email) {
    const result = await sql`
        SELECT passport_verified, photo_verified, diploma_verified
        FROM document_requirements
        WHERE candidate_id = ${candidateId}
    `;

    if (result.rows.length === 0) return;

    const { passport_verified, photo_verified, diploma_verified } = result.rows[0];

    if (passport_verified && photo_verified && diploma_verified) {
        console.log(`🎉 All documents verified for ${email} - triggering auto-approval`);

        // Update status
        await sql`
            UPDATE document_requirements
            SET all_completed = true, updated_at = NOW()
            WHERE candidate_id = ${candidateId}
        `;

        // Update candidate status to approved
        await sql`
            UPDATE candidates
            SET status = 'APPROVED'
            WHERE id = ${candidateId}
        `;

        // TODO: Send approval email automatically
        console.log(`✅ Candidate ${email} auto-approved!`);
    }
}
