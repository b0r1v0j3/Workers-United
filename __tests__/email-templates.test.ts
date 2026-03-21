import { describe, it, expect, vi } from 'vitest';
import { getCheckoutRecoveryStatusMessage, getEmailTemplate } from '@/lib/email-templates';
import type { EmailType } from '@/lib/email-templates';

const ALL_EMAIL_TYPES: EmailType[] = [
    'welcome',
    'profile_complete',
    'payment_success',
    'checkout_recovery',
    'job_offer',
    'offer_reminder',
    'offer_expired',
    'refund_approved',
    'document_expiring',
    'job_match',
    'admin_update',
    'announcement',
    'employer_outreach',
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
            expect(result.html.match(/<!DOCTYPE html/g)?.length).toBe(1);
        }
    });

    it('welcome email includes user name', () => {
        const { html } = getEmailTemplate('welcome', { name: 'Marko' });
        expect(html).toContain('Marko');
    });

    it('welcome emails use checkout wording for worker and agency flows', () => {
        const { html: workerHtml } = getEmailTemplate('welcome', {
            name: 'Marko',
            recipientRole: 'worker',
        });
        const { html: agencyHtml } = getEmailTemplate('welcome', {
            name: 'Agency Owner',
            recipientRole: 'agency',
        });

        expect(workerHtml).toContain('Open Job Finder Checkout');
        expect(workerHtml).toContain('Complete the $9 service charge after approval');
        expect(workerHtml).not.toContain('Activate Job Finder');

        expect(agencyHtml).toContain('Open Checkout Per Case');
        expect(agencyHtml).toContain('Open approved worker checkouts one by one');
        expect(agencyHtml).not.toContain('Unlock Job Finder Per Case');
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

    it('normalizes bare NEXT_PUBLIC_BASE_URL in email links and assets', async () => {
        const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        try {
            vi.resetModules();
            process.env.NEXT_PUBLIC_BASE_URL = 'workersunited.example';
            const { getEmailTemplate: getEmailTemplateWithEnv } = await import('@/lib/email-templates');

            const { html } = getEmailTemplateWithEnv('profile_deletion', { name: 'Ivan' });

            expect(html).toContain('https://workersunited.example/signup');
            expect(html).toContain('https://workersunited.example/logo-wordmark.png');
            expect(html).toContain('https://workersunited.example/privacy-policy');
        } finally {
            process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
            vi.resetModules();
        }
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
        expect(html).toContain('Job Finder service charge received successfully');
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
        expect(html).toContain('required documents');
        expect(html).toContain('admin review');
    });

    it('checkout_recovery step 2 keeps payment as the final post-approval step', () => {
        const { html, subject } = getEmailTemplate('checkout_recovery', {
            name: 'Nikola',
            amount: '$9',
            recoveryStep: 2,
        });
        expect(subject).toContain('still waiting');
        expect(html).toContain('required documents');
        expect(html).toContain('admin review');
        expect(html).toContain('active queue and support unlocks');
        expect(html).not.toContain('Your profile is still waiting for the $9 Job Finder payment.');
    });

    it('offer_expired includes queue continuity messaging', () => {
        const { html, subject } = getEmailTemplate('offer_expired', {
            name: 'Nikola',
            jobTitle: 'Warehouse Worker',
            queuePosition: 7,
        });
        expect(subject).toContain('Warehouse Worker');
        expect(html).toContain('Offer Expired');
        expect(html).toContain('queue position');
        expect(html).toContain('#7');
    });

    it('job_offer and job_match stay in the monochrome system without colored gradients', () => {
        const { html: offerHtml } = getEmailTemplate('job_offer', {
            name: 'Nikola',
            jobTitle: 'Warehouse Worker',
            companyName: 'Steel Concept',
            country: 'Serbia',
        });
        const { html: matchHtml } = getEmailTemplate('job_match', {
            name: 'Nikola',
            jobTitle: 'Warehouse Worker',
            industry: 'Logistics',
            location: 'Belgrade',
            salary: '€2200',
            offerLink: 'https://workersunited.eu/profile/worker/offers/123',
        });
        expect(offerHtml).not.toContain('linear-gradient(90deg, #3B82F6 0%, #10B981 100%)');
        expect(matchHtml).not.toContain('linear-gradient(90deg, #3B82F6 0%, #10B981 100%)');
    });

    it('payment_success uses the premium monochrome queue layout', () => {
        const { html } = getEmailTemplate('payment_success', {
            name: 'Nikola',
            amount: '$9',
        });
        expect(html).toContain('What Happens Next');
        expect(html).toContain('Current Status');
        expect(html).toContain('Stay connected');
        expect(html).toContain('facebook-new.png');
    });

    it('checkout_recovery uses the premium monochrome activation layout', () => {
        const { html } = getEmailTemplate('checkout_recovery', {
            name: 'Nikola',
            amount: '$9',
            recoveryStep: 2,
        });
        expect(html).toContain('What You Need To Know');
        expect(html).toContain('Job Finder checkout');
        expect(html).not.toContain('bank-card-back-side.png');
    });

    it('profile_complete keeps checkout as the post-approval payment step', () => {
        const { html } = getEmailTemplate('profile_complete', {
            name: 'Nikola',
        });

        expect(html).toContain('unlock Job Finder checkout in your dashboard');
        expect(html).toContain('Job Finder checkout unlocks after approval');
        expect(html).toContain('complete the $9 Job Finder checkout');
        expect(html).not.toContain('activate the $9 service');
    });

    it('checkout recovery WhatsApp helper keeps payment as a post-approval final step', () => {
        const stepOneMessage = getCheckoutRecoveryStatusMessage(undefined, '$9');
        const stepTwoMessage = getCheckoutRecoveryStatusMessage(2, '$9');

        expect(stepOneMessage).toContain('required documents');
        expect(stepOneMessage).toContain('admin review');
        expect(stepOneMessage).toContain('enter the active queue');
        expect(stepOneMessage).not.toContain('activate job search');

        expect(stepTwoMessage).toContain('required documents');
        expect(stepTwoMessage).toContain('admin review');
        expect(stepTwoMessage).toContain('unlock support');
        expect(stepTwoMessage).not.toContain('activate job search and unlock support');
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

    it('admin_update supports custom approval-unlock CTA copy', () => {
        const { html, subject } = getEmailTemplate('admin_update', {
            name: 'Nikola',
            subject: 'Job Finder Is Now Unlocked',
            title: 'Profile Approved',
            message: 'Your profile has been approved by our team.',
            actionText: 'Open Job Finder',
            actionLink: 'https://workersunited.eu/profile/worker',
        });
        expect(subject).toBe('Job Finder Is Now Unlocked');
        expect(html).toContain('Profile Approved');
        expect(html).toContain('Open Job Finder');
        expect(html).toContain('https://workersunited.eu/profile/worker');
    });

    it('profile_incomplete uses the premium monochrome reminder layout', () => {
        const { html } = getEmailTemplate('profile_incomplete', {
            name: 'Nikola',
            missingFields: 'Phone number, passport upload',
        });
        expect(html).toContain('Why This Matters');
        expect(html).toContain('required documents');
        expect(html).toContain('unlock Job Finder checkout');
        expect(html).toContain('box-important--v1.png');
    });

    it('announcement_document_fix uses the updated monochrome system-fix layout', () => {
        const { html } = getEmailTemplate('announcement_document_fix', {
            name: 'Nikola',
        });
        expect(html).toContain('Next Step');
        expect(html).toContain('admin review');
        expect(html).toContain('Job Finder checkout opens in your dashboard');
        expect(html).not.toContain('join the hiring queue');
        expect(html).toContain('checked--v1.png');
    });

    it('welcome email restores the earlier Icons8 journey and footer iconography', () => {
        const { html } = getEmailTemplate('welcome', { name: 'Marko' });
        expect(html).toContain('Your Journey');
        expect(html).toContain('conference-call.png');
        expect(html).toContain('edit-user-male.png');
        expect(html).toContain('upload-to-cloud.png');
        expect(html).toContain('facebook-new.png');
        expect(html).toContain('whatsapp.png');
    });

    it('employer_outreach uses the shared monochrome employer campaign layout', () => {
        const { html, subject } = getEmailTemplate('employer_outreach', {
            name: 'Steel Concept',
            companyName: 'Steel Concept',
            campaignLanguage: 'en',
        });
        expect(subject).toContain('Steel Concept');
        expect(html).toContain('International hiring support');
        expect(html).toContain('Create Employer Account');
        expect(html).not.toContain('linear-gradient(135deg,#16a34a 0%,#15803d 100%)');
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
