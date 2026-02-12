import { describe, it, expect } from 'vitest';
import { getWorkerCompletion, getEmployerCompletion } from '@/lib/profile-completion';

describe('getWorkerCompletion', () => {
    it('returns 0% for completely empty profile', () => {
        const result = getWorkerCompletion({
            profile: null,
            candidate: null,
            documents: [],
        });
        expect(result.completion).toBe(0);
        expect(result.missingFields.length).toBe(16);
        expect(result.completedFields).toBe(0);
    });

    it('returns 100% for fully completed profile', () => {
        // lives_abroad/previous_visas can be `false` — that's a valid answer
        const result = getWorkerCompletion({
            profile: { full_name: 'Marko Petrović' },
            candidate: {
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
                lives_abroad: false,
                previous_visas: false,
            },
            documents: [
                { document_type: 'passport' },
                { document_type: 'biometric_photo' },
            ],
        });
        expect(result.completion).toBe(100);
        expect(result.missingFields).toHaveLength(0);
        expect(result.completedFields).toBe(16);
    });

    it('returns ~50% for half-complete profile', () => {
        const result = getWorkerCompletion({
            profile: { full_name: 'Test User' },
            candidate: {
                phone: '+1234567890',
                nationality: 'Serbian',
                current_country: 'Serbia',
                preferred_job: 'IT',
                gender: 'Male',
                date_of_birth: '1990-01-01',
                birth_country: 'Serbia',
                // Missing: birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas
            },
            documents: [],
        });
        // 8 out of 16 fields completed
        expect(result.completion).toBe(50);
        expect(result.missingFields.length).toBe(8);
    });

    it('missing fields use human-readable labels', () => {
        const result = getWorkerCompletion({
            profile: null,
            candidate: null,
            documents: [],
        });
        expect(result.missingFields).toContain('Full Name');
        expect(result.missingFields).toContain('Phone Number');
        expect(result.missingFields).toContain('Passport Document');
        expect(result.missingFields).toContain('Biometric Photo');
    });
});

describe('getEmployerCompletion', () => {
    it('returns 0% for empty employer', () => {
        const result = getEmployerCompletion({ employer: null });
        expect(result.completion).toBe(0);
        expect(result.missingFields.length).toBe(8);
    });

    it('returns 100% for fully completed employer', () => {
        const result = getEmployerCompletion({
            employer: {
                company_name: 'TechCorp',
                company_registration_number: 'REG123',
                company_address: '123 Main St',
                contact_phone: '+49123456',
                country: 'Germany',
                city: 'Berlin',
                industry: 'Technology',
                description: 'A tech company',
            },
        });
        expect(result.completion).toBe(100);
        expect(result.missingFields).toHaveLength(0);
    });

    it('missing fields use human-readable labels', () => {
        const result = getEmployerCompletion({ employer: null });
        expect(result.missingFields).toContain('Company Name');
        expect(result.missingFields).toContain('Registration Number');
        expect(result.missingFields).toContain('Contact Phone');
    });
});
