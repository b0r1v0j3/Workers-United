# 📋 Workers United — Changelog

> Ovaj fajl sadrži istoriju svih završenih promena. Za aktivne taskove i pravila pogledaj `AGENTS.md`.

---

**Legacy Automation Retirement Cleanup (18.03.2026)**
- Uklonjeni preostali legacy automation runtime tragovi iz health/smoke/email-queue tokova i cloud dijagnostike
- Dokumentacija i istorijski opisi preformulisani tako da retired automation servis više nije prikazan kao aktivni deo platforme

**WhatsApp AI Chatbot LIVE (28.02.2026)**
- Implementiran AI chatbot za WhatsApp odgovore
- Vercel šalje odgovor korisniku koristeći sopstveni `WHATSAPP_TOKEN`
- Kritičan fix: `POST /{WABA-ID}/subscribed_apps` API poziv — bez njega Meta ne isporučuje webhook event-ove

**Stripe Live + Cron + Analytics (28.02.2026)**
- Stripe $9 Entry Fee live sa real payment processing
- Cron jobovi re-enabled (profile-reminders, check-expiring-docs, match-jobs, check-expiry)
- Analytics dashboard sa Recharts (User Growth, Revenue, Conversion Funnel)
- Mobile navbar fix + profile completion % badge

**Redizajn logotipa i Navigacije (27.02.2026)**
- Prebačeno sa starog FB-heksagon logotipa na novi minimalistički flat dizajn (samo linijske ruke)
- Implementiran dvokomponentni sistem logotipa: `logo-icon.png` (ruke) + `logo-wordmark.png` (tekst)
- `UnifiedNavbar.tsx` permanentni tanki profil sa glassmorphism efektom

**WhatsApp Business API Integration (26.02.2026)**
- Kreiran `src/lib/whatsapp.ts` — Meta Cloud API helper sa svim template wrapper-ima
- Prepisan webhook `route.ts` za Meta Cloud API format
- `queueEmail()` sada prima opcionalni `recipientPhone` i automatski šalje WhatsApp template
- SQL migracija `012_whatsapp_template_columns.sql`

**Supabase Pro + Password Strength (26.02.2026)**
- Unapređen na Supabase Pro ($25/mo) — Leaked Password Protection
- Klijentska validacija jačine šifre na signup formu

**Google OAuth Login (25.02.2026)**
- "Sign in with Google" na login i signup
- OAuth korisnici bez `user_type` se šalju na `/auth/select-role`

**Document Preview + Favicon Fix (14.02.2026)**
- Admin Document Preview komponenta
- Favicon fix — obrisan stari `favicon.ico`

**Performance Optimization (11.02.2026)**
- Homepage statički keširan, obrisano ~35 `console.log`

**Site Audit Cleanup (11.02.2026)**
- Obrisani dupli fajlovi, legacy folder, nekorišćeni paketi

**Konsolidacija dokumentacije (10.02.2026)**
- Spojeni `PROJECT_PLAN.md` + `README.md` u `AGENTS.md`
- Kreiran `.agent/workflows/project-architecture.md`

**Email Template Fixes v2 — Gmail Compatibility (12.02.2026)**
- Logo fix, Flexbox → Table, profile-reminders fix, preheader text

**Email konsolidacija u jedan sistem (12.02.2026)**
- Sva email renderinga prebačena u `email-templates.ts`

**Auto-rotacija i crop dokumenata + PDF konverzija (12.02.2026)**
- AI detekcija rotacije, PDF→JPEG konverzija, auto-crop

**Diploma verifikacija fix (12.02.2026)**
- AI prompt striktan, error handler fail-closed

**Email Template Fixes + Social Links (09.02.2026)**
- Pravi social media linkovi sa Icons8 ikonicama

**Bulk Email & Admin Notifications (09.02.2026)**
- Admin Announcements, status update emails, incomplete profile reminders

**Mobilna responsivnost + Dizajn konzistencija (08.02.2026)**
- Kompletna mobilna responsivnost, bottom navigation, Facebook-style dizajn

**GDPR Usklađenost (08.02.2026)**
- Privacy Policy, Terms, consent checkbox, Cookie banner, Delete Account, Data Export

**Email infrastruktura + AI upgrade (07-08.02.2026)**
- Nodemailer + SMTP, Gemini 2.0 Flash, AI auto-reply, cron reminderi

**Raniji radovi (Feb 2026)**
- Education polje uklonjeno, Dropdown sync, Employer Country
- Kritični bug fix, Forgot Password, Coming Soon
- UI čišćenje, lažni elementi uklonjeni
- Admin Panel Upgrade, URL restrukturisanje
- Dashboard Redesign, Facebook-Style Layout
