import { describe, it, expect } from 'vitest';
import { getWorkerCompletion, getEmployerCompletion, getAgencyCompletion } from '@/lib/profile-completion';

describe('getWorkerCompletion', () => {
    it('returns 0% for completely empty profile', () => {
        const result = getWorkerCompletion({
            profile: null,
            worker: null,
            documents: [],
        });
        expect(result.completion).toBe(0);
        expect(result.missingFields.length).toBe(20);
        expect(result.completedFields).toBe(0);
    });

    it('returns 100% for fully completed profile', () => {
        // lives_abroad/previous_visas can be `false` — that's a valid answer
        const result = getWorkerCompletion({
            profile: { full_name: 'Marko Petrović' },
            worker: {
                phone: '+381601234567',
                nationality: 'Serbian',
                current_country: 'Serbia',
                preferred_job: 'Construction',
                gender: 'Male',
                date_of_birth: '1990-01-15',
                birth_country: 'Serbia',
                birth_city: 'Belgrade',
                citizenship: 'Serbian',
                marital_status: 'Single',
                passport_number: 'P12345678',
                passport_issued_by: 'Authority',
                passport_issue_date: '2019-01-01',
                passport_expiry_date: '2029-01-01',
                lives_abroad: false,
                previous_visas: false,
            },
            documents: [
                { document_type: 'passport' },
                { document_type: 'biometric_photo' },
                { document_type: 'diploma' },
            ],
        });
        expect(result.completion).toBe(100);
        expect(result.missingFields).toHaveLength(0);
        expect(result.completedFields).toBe(20);
    });

    it('returns expected completion for partially complete profile', () => {
        const result = getWorkerCompletion({
            profile: { full_name: 'Test User' },
            worker: {
                phone: '+1234567890',
                nationality: 'Serbian',
                current_country: 'Serbia',
                preferred_job: 'IT',
                gender: 'Male',
                date_of_birth: '1990-01-01',
                birth_country: 'Serbia',
                // Missing other required fields + all documents
            },
            documents: [],
        });
        // 8 out of 20 fields completed
        expect(result.completion).toBe(40);
        expect(result.missingFields.length).toBe(12);
    });

    it('missing fields use human-readable labels', () => {
        const result = getWorkerCompletion({
            profile: null,
            worker: null,
            documents: [],
        });
        expect(result.missingFields).toContain('Full Name');
        expect(result.missingFields).toContain('Phone Number');
        expect(result.missingFields).toContain('Passport Document');
        expect(result.missingFields).toContain('Biometric Photo');
    });

    it('uses a fallback full name when the profile row is temporarily out of sync', () => {
        const result = getWorkerCompletion({
            profile: { full_name: null },
            worker: {
                phone: '+381601234567',
                nationality: 'Serbian',
                current_country: 'Serbia',
                preferred_job: 'Construction',
                gender: 'Male',
                date_of_birth: '1990-01-15',
                birth_country: 'Serbia',
                birth_city: 'Belgrade',
                citizenship: 'Serbian',
                marital_status: 'Single',
                passport_number: 'P12345678',
                passport_issued_by: 'Authority',
                passport_issue_date: '2019-01-01',
                passport_expiry_date: '2029-01-01',
                lives_abroad: false,
                previous_visas: false,
            },
            documents: [
                { document_type: 'passport' },
                { document_type: 'biometric_photo' },
                { document_type: 'diploma' },
            ],
        }, {
            fullNameFallback: 'Marko Petrovic',
        });

        expect(result.completion).toBe(100);
        expect(result.missingFields).not.toContain('Full Name');
    });

    it('treats whitespace-only strings as missing values', () => {
        const result = getWorkerCompletion({
            profile: { full_name: '   ' },
            worker: {
                phone: '   ',
                nationality: 'Serbian',
                current_country: 'Serbia',
                preferred_job: 'Construction',
                gender: 'Male',
                date_of_birth: '1990-01-15',
                birth_country: 'Serbia',
                birth_city: 'Belgrade',
                citizenship: 'Serbian',
                marital_status: 'Single',
                passport_number: 'P12345678',
                passport_issued_by: 'Authority',
                passport_issue_date: '2019-01-01',
                passport_expiry_date: '2029-01-01',
                lives_abroad: false,
                previous_visas: false,
            },
            documents: [
                { document_type: 'passport' },
                { document_type: 'biometric_photo' },
                { document_type: 'diploma' },
            ],
        });

        expect(result.missingFields).toContain('Full Name');
        expect(result.missingFields).toContain('Phone Number');
    });
});

describe('getEmployerCompletion', () => {
    it('returns 0% for empty employer', () => {
        const result = getEmployerCompletion({ employer: null });
        expect(result.completion).toBe(0);
        expect(result.missingFields.length).toBe(4);
    });

    it('returns 100% for fully completed employer', () => {
        const result = getEmployerCompletion({
            employer: {
                company_name: 'TechCorp',
                contact_phone: '+49123456',
                country: 'Germany',
                industry: 'Technology',
            },
        });
        expect(result.completion).toBe(100);
        expect(result.missingFields).toHaveLength(0);
    });

    it('uses the same country-neutral completion rules for Serbia and other countries', () => {
        const germany = getEmployerCompletion({
            employer: {
                company_name: 'TechCorp',
                contact_phone: '+49123456',
                country: 'Germany',
                industry: 'Technology',
            },
        });
        const serbia = getEmployerCompletion({
            employer: {
                company_name: 'Gradnja Plus',
                contact_phone: '+381601234567',
                country: 'Serbia',
                industry: 'Construction',
                company_registration_number: '',
                company_address: '',
                city: '',
                postal_code: '',
                description: '',
                business_registry_number: '',
                founding_date: '',
            },
        });

        expect(germany.completion).toBe(100);
        expect(serbia.completion).toBe(100);
        expect(serbia.totalFields).toBe(germany.totalFields);
        expect(serbia.missingFields).toHaveLength(0);
    });

    it('missing fields use human-readable labels', () => {
        const result = getEmployerCompletion({ employer: null });
        expect(result.missingFields).toContain('Company Name');
        expect(result.missingFields).toContain('Country');
        expect(result.missingFields).toContain('Contact Phone');
    });
});

describe('getAgencyCompletion', () => {
    it('returns 0% for empty agency record', () => {
        const result = getAgencyCompletion({ agency: null });
        expect(result.completion).toBe(0);
        expect(result.missingFields).toContain('Agency Name');
        expect(result.missingFields).toContain('Contact Email');
    });

    it('returns 100% for a filled agency record', () => {
        const result = getAgencyCompletion({
            agency: {
                display_name: 'Global Recruiters',
                legal_name: 'Global Recruiters LLC',
                contact_email: 'agency@example.com',
            },
        });
        expect(result.completion).toBe(100);
        expect(result.missingFields).toHaveLength(0);
    });
});
