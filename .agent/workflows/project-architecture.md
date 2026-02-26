---
description: Full project architecture reference — tech stack, folder structure, data flow, key files, new-feature checklist, and common gotchas. Read this at the start of every chat.
---

# Workers United — Project Architecture

> **Source of truth:** `AGENTS.md` (business rules, design rules, TODO, env vars, setup)
> This file covers the **technical** side only. Always consult `AGENTS.md` for business context.

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | TypeScript, React 19 |
| Styling | **Tailwind CSS v4** + `globals.css` | PostCSS via `@tailwindcss/postcss` |
| Font | **Montserrat** (Google Fonts) | Loaded in `src/app/layout.tsx` via `next/font` |
| Auth | **Supabase Auth** | Email/password, Google OAuth, password reset |
| Database | **Supabase (PostgreSQL)** | RLS policies, cron-triggered functions |
| Storage | **Supabase Storage** | Documents (passport, diploma, biometric photo) |
| Payments | **Stripe** | Checkout Sessions + Webhooks |
| AI | **Gemini 2.0 Flash** (`@google/generative-ai`) | Document verification, contact form auto-reply |
| Email | **Nodemailer** + Google Workspace SMTP | `contact@workersunited.eu` |
| Hosting | **Vercel** | Cron jobs configured in `vercel.json` |
| Icons | **Lucide React** | — |
| WhatsApp | **Meta Cloud API v21.0** | Template messages, inbound bot, delivery tracking |

---

## 2. Folder Structure

```
Workers-United/
├── .agent/workflows/          # AI agent workflow docs
│   ├── add-profile-field.md   # Steps to add a new profile field
│   └── project-architecture.md  # ← this file
├── public/                    # Static assets (logo.png, logo-full.jpg, etc.)
├── scripts/                   # Utility scripts (screenshots, SQL setup)
├── supabase/                  # SQL migrations & schema files
│   ├── FULL_SETUP.sql         # Comprehensive DB setup
│   ├── schema.sql             # Core tables
│   ├── queue-schema.sql       # Queue & matching tables
│   ├── migrations/            # Incremental migrations
│   └── ...                    # Other SQL patches
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Montserrat, GodMode, CookieConsent)
│   │   ├── page.tsx           # Homepage (landing page)
│   │   ├── globals.css        # Global styles
│   │   ├── login/             # Login page
│   │   ├── signup/            # Signup page
│   │   ├── profile/
│   │   │   ├── page.tsx       # Auto-redirect (/profile → worker or employer)
│   │   │   ├── worker/        # Worker profile, edit, queue, offers, documents
│   │   │   ├── employer/      # Employer profile, jobs
│   │   │   └── settings/      # GDPR: delete account, export data
│   │   ├── admin/
│   │   │   ├── page.tsx       # Admin dashboard + FunnelChart
│   │   │   ├── layout.tsx     # Admin layout (AppShell)
│   │   │   ├── workers/       # Worker list + [id] detail
│   │   │   ├── employers/     # Employer list
│   │   │   ├── queue/         # Queue management
│   │   │   ├── jobs/          # Job listings
│   │   │   ├── announcements/ # Bulk email sender
│   │   │   ├── refunds/       # Refund management
│   │   │   └── settings/      # Platform settings
│   │   ├── api/               # API routes (25 total)
│   │   │   ├── account/       # delete, export (GDPR)
│   │   │   ├── admin/         # delete-user, employer-status, funnel-metrics
│   │   │   ├── cron/          # 5 cron jobs (see below)
│   │   │   ├── documents/     # verify, verify-passport
│   │   │   ├── contracts/     # prepare, generate (DOCX documents)
│   │   │   ├── stripe/        # create-checkout, webhook
│   │   │   ├── email-queue/   # Email queue processor
│   │   │   ├── godmode/       # Dev testing endpoint
│   │   │   ├── health/        # Health check
│   │   │   ├── offers/        # Job offers
│   │   │   ├── profile/       # Profile API
│   │   │   ├── queue/         # auto-match
│   │   │   ├── signatures/    # Signature storage
│   │   │   └── whatsapp/      # WhatsApp webhook (pending)
│   │   ├── auth/              # Auth callback + role selection
│   │   │   ├── callback/     # OAuth/email callback handler
│   │   │   └── select-role/  # Role picker for Google OAuth first-time users
│   │   ├── privacy-policy/    # GDPR privacy policy page
│   │   └── terms/             # Terms & conditions page
│   ├── components/
│   │   ├── AppShell.tsx        # Layout wrapper (sidebar + navbar + content)
│   │   ├── UnifiedNavbar.tsx   # Top navigation bar
│   │   ├── ContactForm.tsx     # Contact form + AI auto-reply
│   │   ├── CookieConsent.tsx   # GDPR cookie banner
│   │   ├── DocumentWizard.tsx  # Document upload flow
│   │   ├── DocumentGenerator.tsx # Admin: generate 4 DOCX visa docs
│   │   ├── SignaturePad.tsx    # Digital signature component
│   │   ├── DeleteUserButton.tsx # Admin: delete user completely
│   │   ├── EmployerStatusButton.tsx # Admin: change employer status
│   │   ├── GodModePanel.tsx    # Dev testing panel
│   │   └── GodModeWrapper.tsx  # GodMode conditional loader
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # Browser Supabase client
│   │   │   ├── server.ts      # Server Supabase client (SSR)
│   │   │   ├── admin.ts       # Service-role Supabase client (bypasses RLS)
│   │   │   └── middleware.ts  # Auth middleware / proxy
│   │   ├── mailer.ts          # sendEmail() via Nodemailer
│   │   ├── email-templates.ts # HTML email templates
│   │   ├── gemini.ts          # Gemini AI functions (verify docs, auto-reply)
│   │   ├── stripe.ts          # Stripe client initialization
│   │   ├── notifications.ts   # Email notification helpers
│   │   ├── admin.ts           # Admin utility functions
│   │   ├── constants.ts       # Shared constants
│   │   ├── godmode.ts         # GodMode utilities
│   │   ├── docx-generator.ts  # DOCX generation (docxtemplater + nationality mapping)
│   │   └── imageUtils.ts      # Image processing helpers
│   └── types/                 # TypeScript types (currently empty)
├── vercel.json                # Vercel config: security headers + 5 cron jobs
├── next.config.ts             # Next.js config
├── tsconfig.json              # TypeScript config
├── package.json               # Dependencies & scripts
├── AGENTS.md                  # 🔑 THE source of truth (business + tech, env vars, rules, TODO)
└── IMPROVEMENTS.md            # UI/UX improvement ideas
```

---

## 3. Cron Jobs (Vercel)

Configured in `vercel.json`:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/check-expiry` | Every hour | Check for expired sessions/tokens |
| `/api/cron/profile-reminders` | Daily 9 AM UTC | Remind users with incomplete profiles |
| `/api/cron/check-expiring-docs` | Daily 8 AM UTC | Alert when passport expires within 6 months |
| `/api/cron/match-jobs` | Every hour | Auto-match workers to employer job requests |
| `/api/cron/check-incomplete-profiles` | Daily 10 AM UTC | Send email listing missing profile fields |

---

## 4. Data Flow

```
User (Browser)
  │
  ├─► Next.js App Router (SSR + Client Components)
  │     ├─► Supabase Auth (login, signup, password reset)
  │     ├─► Supabase Database (profiles, candidates, employers, documents, queue)
  │     ├─► Supabase Storage (passport, diploma, biometric_photo uploads)
  │     ├─► Stripe (entry fee $9, placement fee $190)
  │     │     └─► Webhook → /api/stripe/webhook (post-payment actions)
  │     └─► Gemini AI (document verification, contact auto-reply)
  │
  ├─► Email (Nodemailer + SMTP)
  │     ├─► Contact form auto-reply
  │     ├─► Status change notifications
  │     ├─► Profile reminders (cron)
  │     └─► Admin bulk announcements
  │
  └─► Vercel Cron → /api/cron/* (scheduled background jobs)
```

### Authentication Flow
1. User signs up (email/password OR Google OAuth) → Supabase creates auth user
2. For Google OAuth from signup page: `user_type` is passed via URL param and set in metadata
3. For Google OAuth from login page (first time): user is redirected to `/auth/select-role` to choose worker/employer
4. On first login → user creates profile in `candidates` or `employers` table
5. `profiles` table links auth user to their role
6. Middleware checks auth state on protected routes

### Payment Flow
1. Worker completes profile to 100% → gets verified
2. Worker clicks "Pay" → Stripe Checkout Session created (`/api/stripe/create-checkout`)
3. Stripe redirects back → Webhook confirms payment (`/api/stripe/webhook`)
4. Worker enters queue (`IN_QUEUE` status)
5. Cron job (`match-jobs`) attempts to match with employer requests

---

## 5. Key Files & Their Roles

### Layout & Navigation
| File | Role |
|---|---|
| `src/app/layout.tsx` | Root layout — loads Montserrat font, GodModeWrapper, CookieConsent |
| `src/components/AppShell.tsx` | Authenticated page wrapper — sidebar, navbar, mobile bottom nav |
| `src/components/UnifiedNavbar.tsx` | Top navigation bar (logo, links, user menu) |

### Worker Flow
| File | Role |
|---|---|
| `src/app/profile/worker/page.tsx` | Worker profile with 3 tabs (Profile Info, Documents, Status) |
| `src/app/profile/worker/DashboardClient.tsx` | Client component for worker profile |
| `src/app/profile/worker/edit/` | Single-page profile edit form |
| `src/app/profile/worker/documents/` | Document upload (passport, diploma, photo) |
| `src/app/profile/worker/queue/` | Queue status page |
| `src/app/profile/worker/offers/[id]/` | Individual job offer details |

### Employer Flow
| File | Role |
|---|---|
| `src/app/profile/employer/page.tsx` | Employer profile (EmployerProfileClient) |
| `src/app/profile/employer/jobs/` | Job request management |
| `src/app/profile/employer/jobs/new/` | Create new job request |

### Admin
| File | Role |
|---|---|
| `src/app/admin/page.tsx` | Admin dashboard with FunnelChart |
| `src/app/admin/workers/page.tsx` | Worker list with filter tabs |
| `src/app/admin/workers/[id]/page.tsx` | Worker detail with document review |
| `src/app/admin/announcements/page.tsx` | Bulk email (Workers / Employers / Everyone) |
| `src/app/admin/settings/page.tsx` | Platform settings |

### Backend (lib)
| File | Role |
|---|---|
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client (SSR) |
| `src/lib/supabase/admin.ts` | Service-role client (bypasses RLS) |
| `src/lib/mailer.ts` | `sendEmail()` — Nodemailer wrapper |
| `src/lib/email-templates.ts` | All HTML email templates |
| `src/lib/gemini.ts` | All Gemini AI functions |
| `src/lib/stripe.ts` | Stripe client init |
| `src/lib/notifications.ts` | Email notification dispatch helpers |
| `src/lib/docx-generator.ts` | DOCX generation from templates (docxtemplater + pizzip) |
| `src/lib/whatsapp.ts` | WhatsApp Cloud API — template sending, text sending, logging |
| `src/lib/constants.ts` | Shared constants (industries, countries, etc.) |

---

## 6. New Feature Checklist

When adding a new feature, follow this order:

### Step 1: Database
- [ ] Add columns/tables in Supabase (write migration SQL in `supabase/migrations/`)
- [ ] Update RLS policies if needed
- [ ] If adding a new profile field → follow `.agent/workflows/add-profile-field.md`

### Step 2: Backend (API + Lib)
- [ ] Create or update API route in `src/app/api/`
- [ ] Add helper functions in `src/lib/` if needed
- [ ] If the feature sends email → update `src/lib/email-templates.ts` and use `src/lib/mailer.ts`
- [ ] If the feature involves AI → update `src/lib/gemini.ts`

### Step 3: Frontend (UI)
- [ ] Create/update page in `src/app/` (follow App Router conventions)
- [ ] Use `AppShell` for authenticated pages
- [ ] Add navigation links in `AppShell.tsx` sidebar (and mobile bottom nav)
- [ ] Add navigation links in `UnifiedNavbar.tsx` if it's a top-level section

### Step 4: Profile Completion (if applicable)
- [ ] Update completion % logic in the relevant profile page
- [ ] Update admin workers list completion in `src/app/admin/workers/page.tsx`
- [ ] Update cron field maps in `src/app/api/cron/check-incomplete-profiles/route.ts`

### Step 5: Admin (if applicable)
- [ ] Add admin management UI in `src/app/admin/`
- [ ] Add sidebar link in `src/app/admin/layout.tsx` or `AppShell.tsx`

### Step 6: Documentation
- [ ] Update `AGENTS.md` section 5 (Stanje Projekta) and section 6 (Arhitektura)
- [ ] Update `.agent/workflows/project-architecture.md` if architecture changed

### Step 7: Testing & Deploy
- [ ] Test locally with `npm run dev`
- [ ] Verify no TypeScript errors with `npm run build`
- [ ] Check mobile responsiveness
- [ ] Deploy to Vercel

---

## 7. Environment Variables

| Variable | Service | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (admin) | ✅ |
| `STRIPE_SECRET_KEY` | Stripe | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | ✅ |
| `GEMINI_API_KEY` | Google Gemini AI | ✅ |
| `SMTP_USER` | Google Workspace email | ✅ |
| `SMTP_PASS` | Google Workspace app password | ✅ |
| `CRON_SECRET` | Vercel cron auth | ✅ |
| `NEXT_PUBLIC_BASE_URL` | App base URL | ✅ |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API | For sending |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp | For sending |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification | For webhook |

---

## 8. Common Gotchas

### Database Field Naming
- **Always check Supabase column names** before sending data. Example: the column is `experience_years`, NOT `years_experience`. Sending the wrong name causes Supabase to silently reject the entire update.
- **Supabase silent failures** — if you send a field that doesn't exist in the table, the whole upsert can silently fail. Always verify column names match.

### Profile Field Consistency
- When adding/changing a dropdown field (e.g., `preferred_job`), ensure the **same options** are used everywhere: onboarding form, edit form, employer form, admin display.
- **Case sensitivity matters** — `construction` ≠ `Construction`. All dropdown values should be **uppercase first letter** (e.g., `Construction`, `Healthcare`).

### Email Queue
- The `email_queue` table has a CHECK constraint on the `type` column. Only use types that exist in the constraint (e.g., `document_reminder`, `profile_incomplete`). New types must be added to the DB constraint first.

### Stripe Webhook
- The user metadata key is `user_id` (not `userId`). Mismatch causes payment to succeed but post-payment actions to fail silently.
- The webhook handles both `entry_fee` ($9) and `confirmation_fee` ($190) — check the metadata `fee_type` field.

### Next.js 16 Specifics
- `middleware.ts` is deprecated → use `proxy.ts` instead (`src/lib/supabase/middleware.ts`)
- No `config` export in API routes (Pages Router leftover — remove if found)

### Naming Conventions
- User-facing text: **"worker"** (never "candidate")
- User-facing text: **"Sign In"** (never "Log In")
- Internal DB tables still use `candidates` for workers
- Date format: **DD/MM/YYYY** — use `toLocaleDateString('en-GB')`, NEVER US format

### Logo
- **Never regenerate or replace `public/logo.png`** — it's the official logo
- Navbar size: `h-[60px]` (h-15) — do not change
- `logo-full.jpg` is for OG/meta images only, NOT navbar

### Vercel Deployment
- Security headers are in `vercel.json` (X-Frame-Options: DENY, etc.)
- Cron jobs require `CRON_SECRET` Bearer token auth
- All 5 cron jobs must stay in `vercel.json` — don't remove them

### AI Document Verification
- **Prompts must be STRICT** — never say "be lenient" or "accept any". Explicitly list what IS and IS NOT acceptable.
- **Error handlers must be fail-closed** — if AI crashes, return `success: false`, never `success: true`.
- **Wrong document type = rejected** — not `manual_review`. Worker must re-upload the correct document.

### Supabase Auth Pagination
- **`listUsers()` only returns 50 users per page by default.** Always use `getAllAuthUsers()` from `src/lib/supabase/admin.ts` — it loops through all pages with `perPage: 1000`. Without this, admin panels, cron jobs, and announcements silently ignore users beyond page 1.

### Supabase Query Limits
- **`.select()` returns max 1000 rows by default.** If any table could exceed 1000 rows (e.g., `email_queue`, `candidate_documents`), use `.range()` or pagination. Never use `.limit()` on cron job queries that must process ALL records.
- **Never add `.limit()` to cron job queries** unless you implement pagination. This silently drops records beyond the limit.

### Stripe Webhook Idempotency
- **Always guard status updates with a precondition check.** Example: `.eq("entry_fee_paid", false)` prevents double webhook delivery from resetting `queue_joined_at`.

### Cron Job Batch Patterns
- **Pre-fetch dedup data in bulk, not per-record.** Use the same pattern as `profile-reminders` and `match-jobs`: fetch all relevant emails into a Set, then do O(1) lookups in the loop. Never query inside a nested loop.

---

## 9. Architecture Update Rule

> **After every significant architectural change, update:**
> 1. `.agent/workflows/project-architecture.md` (this file)
> 2. `AGENTS.md` Section 6 (Arhitektura)
>
> This ensures all documentation reflects the current state of the project.
