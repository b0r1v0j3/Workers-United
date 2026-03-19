import { describe, it, expect } from 'vitest';
import { getEmailTemplate } from '@/lib/email-templates';
import type { EmailType } from '@/lib/email-templates';

const ALL_EMAIL_TYPES: EmailType[] = [
    'welcome',
    'profile_complete',
    'payment_success',
    'checkout_recovery',
    'job_offer',
    'offer_reminder',
    'refund_approved',
    'document_expiring',
    'job_match',
    'admin_update',
    'announcement',
    'profile_incomplete',
    'document_review_result',
    'profile_reminder',
    'profile_warning',
    'profile_deletion',
];

describe('getEmailTemplate', () => {
    it('returns subject and html for every email type', () => {
        for (const type of ALL_EMAIL_TYPES) {
            const result = getEmailTemplate(type, { name: 'Test User' });
            expect(result.subject).toBeTruthy();
            expect(result.subject.length).toBeGreaterThan(0);
            expect(result.html).toBeTruthy();
            expect(result.html).toContain('<!DOCTYPE html');
        }
    });

    it('welcome email includes user name', () => {
        const { html } = getEmailTemplate('welcome', { name: 'Marko' });
        expect(html).toContain('Marko');
    });

    it('profile_reminder includes todo list items', () => {
        const todoList = '<li>Upload Passport</li><li>Add Phone</li>';
        const { html } = getEmailTemplate('profile_reminder', {
            name: 'Ana',
            todoList,
        });
        expect(html).toContain('Upload Passport');
        expect(html).toContain('Add Phone');
    });

    it('profile_warning includes days left and urgency', () => {
        const { html, subject } = getEmailTemplate('profile_warning', {
            name: 'Petar',
            daysLeft: 3,
            todoList: '<li>Missing field</li>',
        });
        expect(subject).toContain('3');
        expect(html).toContain('3 days');
    });

    it('profile_deletion includes signup link', () => {
        const { html } = getEmailTemplate('profile_deletion', { name: 'Ivan' });
        expect(html).toContain('workersunited.eu/signup');
    });

    it('job_match includes job details', () => {
        const { html } = getEmailTemplate('job_match', {
            name: 'Stefan',
            jobTitle: 'Warehouse Worker',
            location: 'Munich',
            salary: '€2200',
        });
        expect(html).toContain('Warehouse Worker');
        expect(html).toContain('Munich');
    });

    it('payment_success includes amount', () => {
        const { html } = getEmailTemplate('payment_success', {
            name: 'Nikola',
            amount: '$9',
        });
        expect(html).toContain('$9');
    });

    it('checkout_recovery step 3 explains that a fresh checkout is needed', () => {
        const { html, subject } = getEmailTemplate('checkout_recovery', {
            name: 'Nikola',
            amount: '$9',
            recoveryStep: 3,
        });
        expect(subject).toContain('expired');
        expect(html).toContain('fresh checkout');
        expect(html).toContain('$9');
    });

    it('payment_success uses the premium monochrome queue layout', () => {
        const { html } = getEmailTemplate('payment_success', {
            name: 'Nikola',
            amount: '$9',
        });
        expect(html).toContain('What Happens Next');
        expect(html).toContain('Current Status');
        expect(html).not.toContain('rocket.png');
    });

    it('checkout_recovery uses the premium monochrome activation layout', () => {
        const { html } = getEmailTemplate('checkout_recovery', {
            name: 'Nikola',
            amount: '$9',
            recoveryStep: 2,
        });
        expect(html).toContain('What You Need To Know');
        expect(html).toContain('Job Finder activation');
        expect(html).not.toContain('bank-card-back-side.png');
    });

    it('document_review_result approved email uses the monochrome approved layout', () => {
        const { html, subject } = getEmailTemplate('document_review_result', {
            name: 'Nikola',
            approved: true,
            docType: 'biometric photo',
        });
        expect(subject).toBe('Your Biometric Photo Has Been Approved');
        expect(html).toContain('Biometric Photo Approved');
        expect(html).toContain('What Happens Next');
        expect(html).toContain('Current Status');
        expect(html).not.toContain('#d1fae5');
        expect(html).not.toContain('Continue Registration');
        expect(html).not.toContain('checked.png');
        expect(html).not.toContain('✅ Your');
    });

    it('document_review_result rejected email uses the monochrome re-upload layout', () => {
        const { html, subject } = getEmailTemplate('document_review_result', {
            name: 'Nikola',
            approved: false,
            docType: 'passport',
            feedback: 'Please upload a clearer passport photo.',
        });
        expect(subject).toBe('Your Passport Needs Attention');
        expect(html).toContain('Passport Needs Attention');
        expect(html).toContain('Issue Found');
        expect(html).toContain('Before You Upload Again');
        expect(html).not.toContain('⚠️ Your Passport needs attention');
        expect(html).not.toContain('Issue with your Passport:');
        expect(html).not.toContain('Continue Registration');
    });

    it('profile_incomplete uses the premium monochrome reminder layout', () => {
        const { html } = getEmailTemplate('profile_incomplete', {
            name: 'Nikola',
            missingFields: 'Phone number, passport upload',
        });
        expect(html).toContain('Why This Matters');
        expect(html).not.toContain('edit-property.png');
    });

    it('announcement_document_fix uses the updated monochrome system-fix layout', () => {
        const { html } = getEmailTemplate('announcement_document_fix', {
            name: 'Nikola',
        });
        expect(html).toContain('Next Step');
        expect(html).not.toContain('settings.png');
    });

    it('employer profile_reminder uses employer-specific text', () => {
        const { html, subject } = getEmailTemplate('profile_reminder', {
            name: 'Corp',
            recipientRole: 'employer',
            todoList: '<li>Company Name</li>',
        });
        expect(subject).toContain('company profile');
        expect(html).toContain('company profile');
    });

    it('agency welcome email opens the agency workspace', () => {
        const { html } = getEmailTemplate('welcome', {
            name: 'Agency Owner',
            recipientRole: 'agency',
        });
        expect(html).toContain('agency workspace');
        expect(html).toContain('Open Agency Workspace');
        expect(html).toContain('/profile/agency');
    });

    it('agency profile_reminder uses agency-specific text', () => {
        const { html, subject } = getEmailTemplate('profile_reminder', {
            name: 'Agency Owner',
            recipientRole: 'agency',
            todoList: '<li>Agency Name</li>',
        });
        expect(subject).toContain('agency workspace');
        expect(html).toContain('agency workspace');
    });

    it('all emails contain unsubscribe link', () => {
        for (const type of ALL_EMAIL_TYPES) {
            const { html } = getEmailTemplate(type, { name: 'Test' });
            // Footer should reference workersunited.eu
            expect(html).toContain('workersunited.eu');
        }
    });
});
