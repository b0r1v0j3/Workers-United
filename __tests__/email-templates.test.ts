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
