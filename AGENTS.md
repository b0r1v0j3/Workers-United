# 🏗️ Workers United — AGENTS.md

> **Poslednje ažuriranje:** 14.02.2026 (Sprint 3 — admin panel: document preview, favicon fix, test profiles, manual match, edit data, re-verify, bulk docs, ZIP download)

---

## ⚠️ UPUTSTVO ZA AI (OBAVEZNO PROČITAJ PRVO)

Ovaj fajl je **jedini izvor istine** za ceo projekat. Svaki novi chat MORA da pročita ovaj fajl na početku rada.

### Pravila za čitanje:
1. Pročitaj **ceo** ovaj fajl pre nego što napišeš jednu liniju koda
2. Ako korisnik traži nešto što se kosi sa ovim planom — **pitaj ga** pre nego što uradiš bilo šta
3. Ne krpi — svaku promenu radi kompletno i ispravno
4. **UVEK predlaži unapređenja** — ti si partner u razvoju, ne samo izvršilac. Kad vidiš priliku za poboljšanje (UX, performanse, sigurnost, arhitektura), predloži i objasni zašto. Dodaj predloge u Sekciju 7 (Predlozi).
5. Kad završiš task, razmisli da li nešto može bolje i predloži
6. **PROAKTIVNO USKLAĐIVANJE** — kad menjaš jednu formu, UVEK proveri da li se ista polja koriste na drugom mestu (onboarding, edit, profil prikaz, employer, admin). Ako vidiš neusklađenost (npr. text input vs dropdown, lowercase vs uppercase vrednosti, polje postoji na jednom mestu a ne na drugom) — ODMAH to popravi ili predloži. **NE ČEKAJ da korisnik primeti.**
7. **POSTAVLJAJ PITANJA** — ako vidiš nešto sumnjivo ili neusklađeno, pitaj korisnika pre nego što nastaviš. Bolje pitati 1 pitanje i uštedeti 30 minuta popravljanja.
8. **PREDLAŽI UNAPREĐENJA** — na kraju svakog task-a, pogledaj šta se može poboljšati i predloži. Ti si partner u razvoju.
9. **AŽURIRAJ DOKUMENTACIJU** — posle svake značajne promene u arhitekturi (novi fajlovi, nove rute, novi env vars, promena tech stack-a), ažuriraj `AGENTS.md` i `.agent/workflows/project-architecture.md` da odražavaju trenutno stanje projekta.
10. **ZAVRŠI ŠTO POČNEŠ** — NIKAD ne implementiraj feature polovično. Ako dodaješ PWA, dodaj i service worker — ne samo manifest. Ako dodaješ notifikacije, dodaj i read tracking — ne hardkodiraj `read: false`. Ako nešto ne može da se završi u jednom chatu, RECI to korisniku ODMAH na početku. Polovičan feature je gori od nula feature-a jer stvara lažnu sliku da nešto radi.

### Pravila za ažuriranje ovog fajla:
1. **NIKAD ne briši Sekcije 1-4** — one su trajne i menjaju se samo kad vlasnik projekta to eksplicitno traži
2. **Sekcija 5 (Stanje Projekta)** — ažuriraj posle svakog završenog posla:
   - Dodaj novi unos u "✅ Završeno" sa datumom i kratkim opisom (1-2 reda max)
   - Ažuriraj TODO listu ako si nešto završio ili dodao
   - **Nikad ne briši stare unose iz "Završeno"**
3. **Sekcija 6 (Arhitektura)** — ažuriraj SAMO kad se menja struktura fajlova ili ruta
4. **Ako nisi siguran da li treba nešto da menjaš — pitaj korisnika**
5. **Uvek uradi `git pull` pre početka rada**
6. Ovaj fajl je na srpskom jeziku. Sajt je na engleskom.
7. Kad ažuriraš ovaj fajl, promeni datum "Poslednje ažuriranje" na vrhu

### Primer ažuriranja Sekcije 5:
```markdown
**Naziv promene (DD.MM.YYYY)**
- Kratak opis šta je urađeno
```

---

## 1. 📌 ŠTA JE WORKERS UNITED

Workers United je **platforma za radne vize**. Povezujemo radnike koji traže posao u Evropi sa evropskim poslodavcima, i **mi odradimo SVE** — ugovore, apliciranje za vizu, intervjue, kompletnu papirologiju. Radnici i poslodavci se samo registruju i popune profile, a mi se bavimo svim ostalim.

### Ključni principi:
- **Zatvoreni sistem** — radnici i poslodavci se NE kontaktiraju međusobno. Tek kad viza bude odobrena, mi sprovedemo radnika do poslodavca.
- **NIKAD ne pominjemo odakle radnici dolaze** — nema "Afrika", "Azija", ništa. Samo "international workers" ili "workers".
- **Potpuna usluga** — mi nismo job board. Mi radimo SVE od A do Ž.
- **Poslodavci ne plaćaju ništa** — usluga je besplatna za poslodavce, zauvek.
- **NIŠTA LAŽNO** — nikad ne pravimo placeholder sadržaj, lažne reklame, lažne kontakte ili bilo šta što izgleda kao da postoji a ne postoji. Svaki element na sajtu mora biti funkcionalan i realan.
- **POTPUNA AI AUTOMATIZACIJA** — one-man operacija, sve se radi automatski. n8n + AI obrađuje svu komunikaciju (email, WhatsApp). Nema ručnog odgovaranja na poruke. Kontakt forma automatski odgovara uz AI.

---

## 2. 💰 BIZNIS MODEL

| Stavka | Cena | Ko plaća | Napomena |
|---|---|---|---|
| Entry fee (traženje posla) | $9 | Radnik | Univerzalna cena za sve zemlje |
| Placement fee (Srbija) | $190 | Radnik | Plaća se KAD se posao nađe |
| Placement fee (druge zemlje) | TBD | Radnik | Svaka zemlja ima svoju cenu |
| Za poslodavce | BESPLATNO | — | Zauvek besplatno |

### Garancija:
- Ako se radniku ne nađe posao u roku od **90 dana**, entry fee ($9) se refundira.

---

## 3. 👤 TOK KORISNIKA

### Radnik (Worker/Candidate):
```
1. Registracija (signup)
2. Popuni profil (lični podaci, radne preferencije, potpis)
3. Upload dokumenata (pasoš, biometrijska foto, diploma)
4. AI automatski verifikuje dokumenta
5. Profil mora biti 100% popunjen da bi bio verifikovan
6. Kad je verifikovan → može da plati $9 za traženje posla
7. Ulazi u QUEUE (red čekanja) — čeka da se nađe match
8. Ako se nađe posao → doplatiti placement fee (npr. $190 za Srbiju)
9. Mi pokrećemo proces apliciranja za radnu vizu
10. Kad viza bude odobrena → sprovodimo radnika do poslodavca
```

### Poslodavac (Employer):
```
1. Registracija (signup)
2. Popuni profil kompanije (naziv, PIB, adresa, delatnost, itd.)
3. Profil mora biti 100% popunjen da bi bio verifikovan
4. U profilu ima odeljak za traženje radnika:
   - Broj radnika, plata, lokacija rada, opis posla
5. Mi tražimo match iz naše baze verifikovanih kandidata
6. Kad nađemo match → realizujemo vizu i sprovedemo radnika
```

### Admin:
```
- Pregled svih kandidata i poslodavaca
- Ručna verifikacija dokumenata (backup za AI)
- Upravljanje queue-om i ponudama
- God Mode za testiranje
```

---

## 4. 🎨 DIZAJN I RAZVOJ — PRAVILA

### Filozofija razvoja:
- **NE KRPIMO — PRAVIMO SAVRŠENSTVO** — svaka promena se radi kompletno
- **NIŠTA LAŽNO** — nema placeholder reklama, lažnih kontakata, mock podataka na produkciji
- Bolje potrošiti više vremena sada nego večno krpiti
- Ako treba preimenovati nešto — menja se SVUDA, ne samo na jednom mestu
- Svaka odluka se dokumentuje u ovom fajlu

### Dizajn:
- **Facebook stil** — koristimo FB estetiku (kartice, boje, tipografiju) ali prilagođeno našim potrebama
- **NEMA socijalnih feature-ova** — nema prijatelja, feed-a, Like/Comment/Share, sponzorisanog sadržaja
- **Jednostavno i čisto** — profil → dokumenta → verifikacija → čekanje
- **Sajt je 100% na engleskom jeziku**
- **Mobile-first** — većina korisnika će koristiti mobilne telefone
- **Format datuma: DD/MM/YYYY** — uvek koristiti `toLocaleDateString('en-GB')` ili `toLocaleString('en-GB')`. NIKAD američki format MM/DD/YYYY.

### Logo:
- **Fajl:** `public/logo.png` — plavi heksagon sa belim rukovanjem na BELOJ pozadini (NE plava pozadina). Veličina fajla ~26KB.
- **NIKAD NE MENJAJ logo.png** — ne generiši novi, ne kopiraj screenshot, ne zamenjuj drugim fajlom. Ako korisnik traži promenu loga, koristi samo fajl koji korisnik eksplicitno pruži.
- **Veličina u navbar-u:** `h-[60px]` (h-15) — NE MENJAJ OVU VREDNOST. Korisnik je eksplicitno tražio h-15.
- **Layout u navbar-u:** ikona levo + tekst "Workers United" desno (`flex items-center gap-2`)
- **`logo-full.jpg`** — full logo sa plavom pozadinom, koristi se za OG/meta slike, NE za navbar

### URL Struktura:
- `/profile` — auto-redirect na worker ili employer
- `/profile/worker` — profil radnika (3 taba: Profile Info, Documents, Status)
- `/profile/worker/edit` — editovanje profila (single-page form, ne wizard)
- `/profile/worker/queue` — status u redu čekanja
- `/profile/worker/offers/[id]` — detalji ponude
- `/profile/employer` — profil poslodavca
- `/profile/employer/jobs` — lista job request-ova
- `/profile/employer/jobs/new` — kreiranje novog job request-a
- `/admin` — admin panel
- `/admin/workers` — lista radnika (ranije /admin/candidates)
- `/admin/workers/[id]` — detalji radnika
- `/admin/employers` — lista poslodavaca
- `/admin/queue` — queue management
- `/admin/settings` — admin podešavanja

### Tehnički stack:
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4, Montserrat font
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **Plaćanja:** Stripe (Checkout Sessions + Webhooks)
- **AI:** Gemini 2.0 Flash (verifikacija dokumenata, auto-reply na kontakt formu)
- **Email:** Nodemailer + Google Workspace SMTP (contact@workersunited.eu)
- **Hosting:** Vercel (sa cron jobovima)
- **Icons:** Lucide React

### Setup i pokretanje:
```bash
npm install        # Instalacija dependency-ja
npm run dev        # Development server (localhost:3000)
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint provera
```

### Environment Variables:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Google Gemini AI
GEMINI_API_KEY=your-gemini-key

# Email (Google Workspace SMTP)
SMTP_USER=contact@workersunited.eu
SMTP_PASS=your-app-password

# Vercel Cron
CRON_SECRET=your-cron-secret

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Dokumenta koja radnik mora da upload-uje:
1. **Pasoš** (passport)
2. **Biometrijska fotografija** (biometric_photo)
3. **Diploma** (diploma)
- ~~Policijski izvod~~ — UKLONJENO
- ~~Lekarsko uverenje~~ — UKLONJENO

### Profil verifikacija:
- Radnik: profil MORA biti na **100%** da bi mogao da se verifikuje
- Poslodavac: profil MORA biti na **100%** da bi mogao da se verifikuje
- 100% znači: sva obavezna polja popunjena + svi dokumenti uploadovani i AI-verifikovani

### ⚠️ Dodavanje novih obaveznih polja u profil:
Kad se doda novo obavezno polje, MORA se uraditi sledeće:
1. **Profil completion % se automatski smanjuje** — jer novo polje nije popunjeno, procenat pada (npr. 100% → 93%)
2. **Poslati email svim radnicima** sa obaveljenjem da je novo polje dodato:
   - **Za radnike koji NISU platili** — standardan podsetnik da dopune profil pre nego što mogu da apliciraju
   - **Za radnike koji SU platili (IN_QUEUE)** — drugačija poruka: traženje posla se NE prekida, ali ih zamoliti da dopune profil jer je potrebno za vizni proces / aplikaciju
3. **Cron logika i profil stranica** moraju se ažurirati da uključe novo polje
4. **NIKAD ne blokirati plaćene korisnike** zbog novog polja — oni ostaju u queue-u, samo ih zamoliti da dopune

---

## 5. 📋 STANJE PROJEKTA

### ✅ Završeno

**Document Preview + Favicon Fix (14.02.2026)**
- **Admin Document Preview** — nova komponenta `DocumentPreview.tsx` na worker detail stranici prikazuje SVE placeholder vrednosti koje idu u DOCX dokumenta (radnik, pasoš, nacionalnost, poslodavac, posao, datumi, kontakt). Nedostajuća polja su crveno označena.
- **API endpoint** — `GET /api/contracts/preview?profileId=...` koristi postojeću `buildPlaceholderData()` iz `docx-generator.ts` za potpuno tačan preview.
- **Favicon fix** — obrisan stari `src/app/favicon.ico` (Vercel default). `layout.tsx` metadata `icons: { icon: '/logo.png' }` sada radi jer ga `favicon.ico` više ne override-uje.

**Performance Optimization (11.02.2026)**
- Homepage sad statički keširan (uklonjen `force-dynamic`, auth prebačen na klijentsku stranu u `UnifiedNavbar.tsx`)
- Obrisano svih ~35 `console.log` iz produkcijskog koda (10 fajlova), ostali samo `console.error`/`console.warn`
- Uklonjen `playwright` iz production dependencies

**Site Audit Cleanup (11.02.2026)**
- Obrisan dupli `public/robots.txt` — koristimo dinamički `src/app/robots.ts`
- Obrisan zastareli `public/sitemap.xml` (pogrešni .html URL-ovi, nepostojeće sekcije) — koristimo `src/app/sitemap.ts`
- Obrisan `openai` paket iz dependencies (zamenjen Gemini-jem)
- Obrisano 9 nekorišćenih fajlova iz `public/` (Next.js template SVG-ovi, backup logo, duplikat logo-email.jpg, stari PDF-ovi, humans.txt)
- Obrisan ceo `legacy/` folder (stari statički HTML sajt, 22 fajla)

**Konsolidacija dokumentacije (10.02.2026)**
- Spojeni `PROJECT_PLAN.md` + `README.md` u jedan `AGENTS.md` fajl
- Kreiran `.agent/workflows/project-architecture.md` (tehnička arhitektura)
- Obrisan `README.md` i `PROJECT_PLAN.md`

**Email Template Fixes v2 — Gmail Compatibility (12.02.2026)**
- **Logo fix** — kreiran `logo-white.png` (beli logo sa prozirnom pozadinom). Gmail ne podržava CSS `filter`, pa je stari pristup (CSS filter na `logo.png`) zamenjen direktnim korišćenjem `logo-white.png`
- **Flexbox → Table** — svi `display: flex` u `email-templates.ts` zamenjeni `<table>` layoutom (Gmail ne podržava flexbox)
- **Profile-reminders fix** — dodan logo + zamenjene text-character social ikonice (f, 📷, ♪) sa pravim icons8 slikama
- **HTML wrapper** — `profile-reminders` mejlovi nisu imali `<!DOCTYPE html>` / `<meta charset>` — sad imaju
- **Broken linkovi** — `profile_complete` → `/profile/worker`, `profile_incomplete` → `/profile/worker/edit`
- **document_expiring** — koristio pogrešna polja (`jobTitle`/`startDate` umesto `documentType`/`expirationDate`), popravljeno i u šablonu i u `check-expiring-docs` cron jobu
- **Parenthetical explanations** — uklonjeni iz field labela u `check-incomplete-profiles` ("Passport Number (Crucial for...)" → "Passport Number")
- **Preheader text** — dodat skriveni preheader u `wrapModernTemplate` za bolji inbox preview

**Email konsolidacija u jedan sistem (12.02.2026)**
- Sva email renderinga prebačena u `email-templates.ts` — `profile-reminders/route.ts` više NEMA sopstvene buildere
- ⚠️ **Kad dodaješ novi `EmailType`, ažuriraj ČETIRI mesta:**
  1. `EmailType` union u `email-templates.ts`
  2. `getEmailTemplate()` case u `email-templates.ts`
  3. `VALID_TYPES` niz u `admin/email-preview/route.ts`
  4. Title/icon mape u `notifications/route.ts`
- **Funnel metrics bug** — `uploaded_documents` i `verified` brojali SVE korisnike a `total_users` samo workere → inflatirani analytics. Sad filtrirano na worker ID-ove

**Auto-rotacija i crop dokumenata + PDF konverzija (12.02.2026)**
- Dokumenti se sada automatski rotiraju na ispravan položaj pomoću AI detekcije (0°/90°/180°/270°)
- PDF-ovi se automatski konvertuju u JPEG na serveru pre obrade
- Auto-crop radi za SVE tipove dokumenata (pasoš, diploma, biometrijska foto), ne samo za pasoš/diplomu
- Pipeline: PDF→JPEG → AI detekcija rotacije/granica → sharp rotira → sharp crop-uje → zameni u storage

**Diploma verifikacija — AI previše popustljiv (12.02.2026)**
- ⚠️ **AI prompt za verifikaciju dokumenata MORA biti striktan** — prethodni prompt je govorio "Be very lenient" i prihvatao bilo koji sertifikat. Sada zahteva formalni školski diploma (srednja škola, fakultet, zanat). Profesionalni sertifikati, kursevi i trening dokumenti se odbijaju.
- ⚠️ **Error handler u verifikaciji MORA biti fail-closed** — `catch` blok u `verifyDiploma()` je ranije vraćao `success: true` (auto-approve na grešku). Sada vraća `success: false`.
- ⚠️ **Pogrešan tip dokumenta = rejected (ne manual_review)** — kad radnik upload-uje pogrešan dokument, status mora biti `rejected` da bi bio primoran da upload-uje ispravno

**filter(Boolean) bug popravljen (12.02.2026)**
- ⚠️ **NIKAD ne koristi `filter(Boolean)` za prover polja u profile completion** — `false` je validan odgovor za `lives_abroad` i `previous_visas` (korisnik je odgovorio "Ne"). Koristi `isFieldFilled()` helper iz `profile-completion.ts` koji razlikuje boolean odgovore od computed polja.
- Isti fix primenjen u `funnel-metrics/route.ts`

**email_queue tabela (12.02.2026)**
- ⚠️ **Tabela `email_queue` MORA postojati u Supabase** — SQL migracija u `supabase/migrations/001_create_email_queue.sql`. Bez nje ne rade: notifikacije, email preview, cron reminderi, analytics funnel.

**Email Template Fixes + Social Links (09.02.2026)**
- **Social Media Links** — dodati pravi linkovi (Facebook, Instagram, LinkedIn, X, TikTok, Threads, Reddit) sa Icons8 ikonicama umesto lažnih placeholder-a
- **Missing Field Descriptions** — cron job za nepotpune profile sada šalje objašnjenja zašto je svako polje potrebno (npr. "Passport Number — Crucial for all travel documents")

**Bulk Email & Admin Notifications + Incomplete Profile Reminders (09.02.2026)**
- **Admin Announcements** — nova stranica (`/admin/announcements`) za masovno slanje obaveštenja (Workers / Employers / Everyone)
- **Admin Update Emails** — automatsko slanje emaila kandidatima pri promeni statusa (Verified/Rejected) ili dokumenta (Approve/Reject/Request New)
- **Incomplete Profile Reminders** — novi cron job (`/api/cron/check-incomplete-profiles`) šalje email sa listom nedostajućih polja (daily 10 AM UTC)
- **Developer Workflow** — dokumentovan proces za dodavanje novih polja (`.agent/workflows/add-profile-field.md`)
- **AppShell Sidebar** — dodat link za Announcements

**Admin worker 404 fix + Cron reminder fix + email_queue fix (09.02.2026)**
- **Admin worker detail 404** — profili bez `profiles` reda davali 404. Sada koristi auth user data kao fallback + amber banner "profile not completed"
- **Profile reminder cron** — proveravao samo 3 dokumenta, sada proverava **svih 15 polja profila** (ista logika kao worker profil stranica)
- **email_queue CHECK constraint** — cron koristio `profile_reminder` type koji ne postoji u bazi → insert tiho padao. Zamenjeno sa `document_reminder`

**Mobilna responsivnost + Dizajn konzistencija + Cleanup (08.02.2026)**
- Kompletna **mobilna responsivnost** — login, signup, homepage, worker profil, employer profil, admin stranice
- Dodat **bottom navigation** za mobilne uređaje (AppShell) — worker i admin varijante
- **Facebook-style dizajn konzistencija** — sve stranice koriste iste boje, navbar, kartice
- Queue stranica potpuno redizajnirana (branded navbar, bg-[#f0f2f5], inline button styles)
- Employer profil — popravljene minor boje (border, text)
- Login/signup logo — bio sakriven u tamnom kontejneru, sada vidljiv sa drop-shadow
- **Naming standardizacija** — svi user-facing "candidate" → "worker", svi "Log In" → "Sign In"
- **Admin ruta preimenovana** — `/admin/candidates` → `/admin/workers` (URL, linkovi, tekst)
- **Bug fix**: Queue page linkovao sa `candidate.id` umesto `candidate.profile_id` → 404 na detail stranici
- **Dead code obrisan** — application page, ApplicationDataForm, application types, 2 API rute (931 linija)
- Obrisan nekorišćeni onboarding page
- Terms page — uklonjeno "(candidates)" iz teksta
- **Admin workers lista** — filtrira samo korisnike sa profilom (uklanjeni stale auth-only useri)
- **Admin Delete dugme** — dodato na svaku worker karticu, briše kompletno (storage, dokumenta, potpise, kandidata, profil, auth)
- **Login/signup gradient** — zamenjen `#183b56` (zelenkasto-plav) sa čistim plavim gradijentom koji odgovara signup stranici
- **Homepage footer** — isti gradient fix (`#0F172A → #1E3A5F`)
- **Brand text boja** — "Workers United" tekst standardizovan na `#1E3A5F` (tamno plava koja odgovara logu) na svih 10 stranica
- **Logo na login/signup** — beli filter samo na desktop-u (`lg:brightness-0 lg:invert`), normalan na mobilnom

**GDPR Usklađenost — Kompletna implementacija (08.02.2026)**
- Potpuno prepisana **Privacy Policy** stranica — 13 GDPR-compliant sekcija (data controller, legal basis, prava korisnika, cookies, data retention, security, itd.)
- Potpuno prepisana **Terms & Conditions** stranica — relevantne sekcije za viznu platformu (fees, documents, GDPR prava, zabranjene aktivnosti)
- Dodat **aktivan GDPR consent checkbox** na signup formu — checkbox mora biti čekiran, consent se snima u user metadata sa timestamp-om
- Dodat **consent checkbox na kontakt formu** — blokira slanje ako nije čekiran
- Kreiran **Cookie Consent banner** (`CookieConsent.tsx`) — informativni banner za essential cookies, localStorage persistence
- Kreiran **self-service Delete Account** (`/api/account/delete` + `/profile/settings`) — korisnik može sam da obriše nalog i sve podatke (GDPR Article 17)
- Kreiran **Data Export** (`/api/account/export`) — download svih ličnih podataka kao JSON (GDPR Article 20)
- Dodata **Account Settings** stranica sa Download Data, Delete Account i Privacy linkovima
- Dodat **Settings link u sidebar** za sve korisnike
- Stara privacy policy imala faktičke greške ("ne koristimo SSL", "ne tražimo lične podatke") — sve ispravljeno

**Email infrastruktura + AI upgrade + Codebase audit (07-08.02.2026)**
- Zamenjeno Web3Forms → **Nodemailer + Google Workspace SMTP** za direktan slanje emailova
- Kreiran `src/lib/mailer.ts` sa `sendEmail()` utility funkcijom
- Zamenjeno OpenAI → **Gemini 2.0 Flash** za verifikaciju dokumenata (10x jeftinije, brže)
- Kreiran `src/lib/gemini.ts` sa svim AI funkcijama (passport, diploma, foto, text)
- Dodat **AI auto-reply na kontakt formu** — Gemini čita poruku i automatski šalje profesionalan odgovor
- Dodat **cron za podsetnik profila** (`/api/cron/profile-reminders`) — daily 9am UTC, max 1 nedeljno po korisniku
- Popravljen **kritični bug u Stripe webhook** — `userId` → `user_id` metadata key mismatch
- Stripe webhook sada obrađuje i entry_fee ($9) i confirmation_fee ($190) sa post-payment akcijama
- `notifications.ts` popravljen — slao samo console.log, sada šalje prave emailove
- `metadataBase` dodat u `layout.tsx` za SEO
- Migriran `middleware.ts` → `proxy.ts` (Next.js 16 deprecation)
- Uklonjen `eslint` iz `next.config.ts` (deprecated)
- Uklonjen ghost cron `/api/cron-email` (ruta nije postojala → 404 svakih 5 min)
- Uklonjen invalid `config` export iz Stripe webhook (Pages Router leftover)
- Očišćeni Vercel env vars: uklonjeni `OPENAI_API_KEY`, `BREVO_API_KEY`; dodati `SMTP_USER`, `SMTP_PASS`, `GEMINI_API_KEY`

**Education polje uklonjeno + Dropdown sync + Employer Country (07.02.2026)**
- Uklonjeno `education_level` polje sa worker profila i edit forme — kandidati već šalju diplomu, polje je bilo redundantno
- Worker preferred_job promenjen iz TEXT INPUT → DROPDOWN sa istim opcijama kao employer industry (13 industrija)
- Onboarding dropdown bio lowercase (`construction`) dok je employer koristio uppercase (`Construction`) — usklađeno na uppercase svuda
- Dodat **Country dropdown** na employer profil — 46 evropskih država (samo Evropa)
- Work Location preimenovan u "City / Region" pored country dropdown-a
- ⚠️ NAPOMENA: Potrebno dodati `country` kolonu u `employers` tabelu u Supabase!

**Kritični bug fix + Forgot Password + Coming Soon (07.02.2026)**
- Popravljen KRITIČNI bug: save na worker edit stranici nije radio jer je kod slao `years_experience` umesto `experience_years` (ime kolone u bazi). Takođe slao `address` i `education_level` koje NE POSTOJE u candidates tabeli — Supabase tiho odbijao ceo update
- Dodat error handling za profile update (pre se greške gutale)
- Implementiran **Forgot Password** flow na login stranici (Supabase `resetPasswordForEmail`)
- Dodat **Coming Soon** placeholder na worker dashboard (plavi gradient banner) — kad plaćanje bude spremno, samo se promeni u Stripe checkout

**UI Čišćenje (07.02.2026)**
- Uklonjen redundantni "Overview" dugme sa employer profila (linkao na istu stranicu)
- Cancel dugme na employer edit sad vodi na home stranicu umesto iste stranice
- Uklonjen nefunkcionalni search input i filter dugme sa admin candidates stranice
- Uklonjen beskorisni three-dots (MoreHorizontal) meni sa candidate kartica
- Date picker na worker edit zamenjen sa 3 dropdown-a (Dan/Mesec/Godina)
- Years of experience promenjen iz number input u dropdown select
- Dodati filter tabovi na admin candidates (All / Pending / Verified)

**Čišćenje lažnih elemenata (07.02.2026)**
- Uklonjeni "Sponsored", "Ad", "Contacts" iz AppShell desnog sidebara — ništa lažno

**Admin Panel Upgrade (07.02.2026)**
- Sve admin stranice upakovane u AppShell (konzistentan stil)
- Dodat Queue i Refunds u sidebar
- Kreirana nova Settings stranica (platforma info, integracije, cene)
- Svi admin linkovi verifikovani — 0 mrtvih linkova

**Uklanjanje svih "Dashboard" tekstova (07.02.2026)**
- Svi vidljivi "Dashboard" nazivi zamenjeni sa "Profile"/"Admin"/"Overview"
- Popravljen dupli header na admin stranici

**URL Restrukturisanje (07.02.2026)**
- `/dashboard` → `/profile/worker`, `/employer` → `/profile/employer`, 39 fajlova, 50+ referenci

**Fix Profile Completion i Single-Page Edit (07.02.2026)**
- Popravljen bug gde se signature_url brisao pri otvaranju edit forme
- Onboarding konvertovan iz multi-step wizard u single-page formu

**Dashboard Redesign (07.02.2026)**
- Uklonjen kompletan socijalni sistem, kreiran čist 3-tab profil tracker

**Facebook-Style Layout (Feb 2026)**
- AppShell, UnifiedNavbar, kartice, tabovi — ceo sajt u FB stilu

### 🔲 TODO
- [x] ~~**GDPR Usklađenost** — consent pri registraciji, pravo na brisanje, privacy policy sadržaj~~
- [x] ~~Admin unapređenje — kompletna funkcionalnost (sve da može da radi)~~
- [x] ~~Forgot Password flow~~
- [x] ~~Coming Soon placeholder za plaćanje~~
- [x] ~~Mobilna responsivnost (mobile-first)~~
- [ ] Multi-country pricing za placement fee
- [x] ~~Employer profil verifikacija (100% pravilo — UI Completion Tracker & Pending Approval)~~
- [x] ~~Automatsko matchovanje radnika sa poslodavcima~~
- [x] ~~Email notifikacije za sve korake procesa~~
- [ ] Prebaciti Coming Soon → Stripe checkout ($9 entry fee) kad bude spremno
- [x] ~~**Automatsko generisanje dokumenata za vize** — UGOVOR, IZJAVA, OVLAŠĆENJE, POZIVNO PISMO (Sekcija 8)~~
- [x] ~~Worker preferred_job: text → dropdown (sync sa employer)~~
- [x] ~~Onboarding dropdown sync (lowercase → uppercase vrednosti)~~
- [x] ~~Employer country dropdown (46 evropskih država)~~
- [x] ~~**Admin Test Profiles** — admin može da pristupi worker i employer profilima za testiranje~~
- [x] ~~**Manual Match** — admin može ručno da poveže radnika sa Job Request-om~~
- [x] ~~**Edit Data API** — admin inline editovanje worker/employer/contract_data polja~~
- [x] ~~**Re-Verification** — admin može ponovo da trigeruje AI verifikaciju dokumenata~~
- [x] ~~**Bulk Generation** — generiše 4 DOCX dokumenta za SVE matchovane radnike~~
- [x] ~~**Bulk ZIP Download** — download svih dokumenata u strukturiranom ZIP-u (IME PREZIME/ folderi)~~

### ⏸️ ČEKA SE (blokirano)
- [ ] **WhatsApp integracija** — čeka se tax ID → bankovni račun → broj telefona na firmu
- [ ] **Stripe plaćanja** — čeka se tax ID → bankovni račun → povezivanje sa sajtom

---

## 6. 🏛️ ARHITEKTURA

> Za detaljnu tehničku arhitekturu (folder structure, data flow, key files, gotchas) pogledaj `.agent/workflows/project-architecture.md`

| Komponenta | Putanja | Opis |
|---|---|---|
| AppShell | `src/components/AppShell.tsx` | Layout wrapper (Sidebar + Navbar + Content) |
| UnifiedNavbar | `src/components/UnifiedNavbar.tsx` | Top navigacija |
| Profile Redirector | `src/app/profile/page.tsx` | Auto-redirect worker/employer |
| Worker Profile | `src/app/profile/worker/page.tsx` | Profil radnika (3 taba) |
| Worker DashboardClient | `src/app/profile/worker/DashboardClient.tsx` | Klijentska komponenta profila |
| Worker Edit | `src/app/profile/worker/edit/` | Editovanje profila |
| Worker Queue | `src/app/profile/worker/queue/` | Red čekanja |
| Worker Offers | `src/app/profile/worker/offers/[id]/` | Ponude |
| Worker Documents | `src/app/profile/worker/documents/` | Upload dokumenata |
| Employer Profile | `src/app/profile/employer/page.tsx` | EmployerProfileClient |
| Employer Jobs | `src/app/profile/employer/jobs/` | Job request-ovi |
| Account Settings | `src/app/profile/settings/page.tsx` | GDPR: delete account, export data |
| Admin | `src/app/admin/` | Admin panel |
| Admin Announcements | `src/app/admin/announcements/` | Bulk email sender |
| Admin Email Preview | `src/app/admin/email-preview/` | Preview svih email template-ova |
| Admin Analytics | `src/app/admin/analytics/` | Conversion funnel dashboard |
| Admin Workers | `src/app/admin/workers/` | Lista radnika |
| Admin Worker Detail | `src/app/admin/workers/[id]/` | Detalji radnika |
| GodModePanel | `src/components/GodModePanel.tsx` | Dev testiranje |
| DocumentGenerator | `src/components/DocumentGenerator.tsx` | Admin: generiše 4 DOCX za radne vize |
| ManualMatchButton | `src/components/admin/ManualMatchButton.tsx` | Admin: ručno matchovanje radnika → job |
| ReVerifyButton | `src/components/admin/ReVerifyButton.tsx` | Admin: re-trigger AI verifikacije |
| BulkDocumentActions | `src/components/admin/BulkDocumentActions.tsx` | Admin: bulk generisanje + ZIP download |
| DocumentPreview | `src/components/admin/DocumentPreview.tsx` | Admin: preview placeholder podataka za DOCX dokumente |

### Admin API Routes:
| Putanja | Metoda | Namena |
|---|---|---|
| `/api/admin/manual-match` | POST/GET | Ručno matchovanje kandidata → posao |
| `/api/admin/edit-data` | POST | Inline editovanje user/employer/contract polja |
| `/api/admin/re-verify` | POST | Re-trigger AI verifikacije dokumenta |
| `/api/contracts/generate-all` | POST | Bulk generisanje DOCX za sve matchovane |
| `/api/contracts/download-all` | POST | ZIP download svih dokumenata |
| `/api/contracts/preview` | GET | Preview placeholder podataka za DOCX dokumente |

### Key Libraries:
| Fajl | Namena |
|---|---|
| `src/lib/profile-completion.ts` | Shared profile completion — **single source of truth** za worker i employer |
| `src/lib/email-templates.ts` | Svi email templateovi + strict `TemplateData` (bez `[key: string]: any`) |
| `src/lib/docx-generator.ts` | DOCX generisanje iz šablona (docxtemplater + nationality mapping) |

### Cron Jobs (vercel.json):
| Putanja | Raspored | Namena |
|---|---|---|
| `/api/cron/check-expiry` | Svaki sat | Provera isteklih sesija |
| `/api/cron/profile-reminders` | Daily 9 AM UTC | Podsetnik za nepotpune profile (reminder + warning + deletion) |
| `/api/cron/check-expiring-docs` | Daily 8 AM UTC | Alert za pasoš koji ističe za <6 meseci (max 1 email/30 dana) |
| `/api/cron/match-jobs` | Svaki sat | Auto-matching radnika i poslova |

### ⚠️ Email Common Gotchas:
- **DVA email sistema** — `email-templates.ts` (wrapModernTemplate) i `profile-reminders/route.ts` (sopstveni builderi). Kad menjaš dizajn/footer/logo — moraš menjati OBA.
- **Gmail ne podržava:** `display: flex`, CSS `filter`, `backdrop-filter`, `box-shadow`, SVG u `<img>`. Koristiti `<table>` layout i PNG slike.
- **Logo:** uvek `https://workersunited.eu/logo-white.png` (ne CSS filter na `logo.png`)
- **Social ikonice:** koristiti icons8 PNG slike, ne text karaktere (f, 📷, ♪)
- **Linkovi u mejlovima:** `/profile` ne postoji kao destinacija — uvek koristiti `/profile/worker`, `/profile/worker/edit`, ili `/profile/employer`
- **TemplateData:** Striktni tipovi — dodaj novo polje eksplicitno u `TemplateData` interface, nema više `[key: string]: any`
- **Profile completion:** UVEK koristi `getWorkerCompletion()` / `getEmployerCompletion()` iz `src/lib/profile-completion.ts`. NIKAD ne dodavaj novu inline kalkulaciju.
- **check-expiring-docs:** Ima 30-dnevnu zaštitu od spam-a — ne šalje dupli email istom korisniku unutar 30 dana

---

## 7. 💡 PREDLOZI ZA UNAPREĐENJE
> AI treba da dopunjuje ovu listu kad vidi priliku. Korisnik odlučuje šta se implementira.

### Prioritet: Visok
- [x] ~~**Istekli dokumenti** — dodati `expires_at` polje za pasoš, automatski alert kad ističe za <6 meseci~~
- [x] ~~**Admin Conversion Funnel** — vizuelni prikaz: signup → profil 100% → verified → platio → match → viza~~

### Prioritet: Srednji
- [ ] **Per-Country Landing Pages ZA POSLODAVCE** — `/hire-workers-serbia`, `/hire-workers-germany` sa info za poslodavce kako da nađu radnike preko nas (SEO). Radnici traže posao, ne landing page.
- [x] ~~**Email sekvence** — welcome email, podsetnik za nepotpun profil, status update iz queue-a~~
- [x] ~~**Konsolidacija email sistema** — spojen `check-incomplete-profiles` u `profile-reminders`, shared `profile-completion.ts` lib, strict TemplateData, admin email preview~~
- [ ] **n8n email auto-responder** — AI obrađuje email thread-ove (ne samo kontakt formu)
- [ ] **n8n WhatsApp bot** — automatski status update-ovi, FAQ odgovori
- [ ] **Live Visa Process Tracker** — "Currently processing: X applications", "Documents verified today: Y". ⏳ **USLOV: 100+ korisnika u sistemu**
- [ ] **"Work in [Country]" Pages** — SEO stranice (npr. /work-in-germany) sa pravnim koracima, platama, troškovima. ⏳ **USLOV: bar 2 aktivne zemlje**

### Prioritet: Nizak (kad bude živih korisnika)
- [ ] **Success Stories** — pravi case studies sa video snimcima (oprema nabavljena: iPhone 17 Pro)
- [ ] **Referral sistem** — radnik koji je uspešno plasiran preporučuje druge
- [ ] **Multi-language support** — ključne instrukcije na jezicima radnika

---

## 8. 📄 GENERISANJE DOKUMENATA ZA RADNE VIZE

> **Status:** ✅ IMPLEMENTIRANO — 14.02.2026
>
> Referentni fajlovi (lokalni offline pipeline sa svim popravkama): `C:\VIZE\NEPALCI\13.2.2026\`
> Workflow sa detaljnim koracima: `C:\VIZE\NEPALCI\13.2.2026\.agent\workflows\generate-documents.md`

### Šta treba da se generiše
Za svakog matchovanog radnika se generišu **4 dokumenta**:

| Dokument | Opis | Format |
|---|---|---|
| UGOVOR O RADU | Ugovor o radu — srpski levo, engleski desno (2 kolone) | DOCX → PDF |
| IZJAVA O SAGLASNOSTI | Izjava o saglasnosti radnika | DOCX → PDF |
| OVLAŠĆENJE | Ovlašćenje za zastupanje | DOCX → PDF |
| POZIVNO PISMO | Pozivno pismo za vizu | DOCX → PDF |

### Šta već postoji ✅
- `api/contracts/prepare/route.ts` — sklapa `contract_data` iz match (radnik + poslodavac + job)
- `contract_data` Supabase tabela — čuva sve podatke za ugovor
- `gemini.ts → extractPassportData()` — AI čita pasoše (full_name, passport_number, nationality, DOB, expiry, gender, POB)
- `documents` tabela sa `ai_extracted_data` JSON poljem

### Šta fali ❌

#### 1. Čisti DOCX šabloni sa placeholder-ima
Šabloni treba da imaju generičke placeholder-e umesto konkretnih podataka:
```
{{WORKER_FULL_NAME}}       — ime i prezime radnika
{{WORKER_FIRST_NAME}}      — samo ime
{{WORKER_LAST_NAME}}       — samo prezime
{{PASSPORT_NUMBER}}        — broj pasoša
{{NATIONALITY_SR}}         — "državljanin Nepala" (srpski, padež)
{{NATIONALITY_EN}}         — "Nepalese" (engleski)
{{DATE_OF_BIRTH}}          — datum rođenja
{{PLACE_OF_BIRTH}}         — mesto rođenja
{{PASSPORT_ISSUE_DATE}}    — datum izdavanja pasoša
{{PASSPORT_EXPIRY_DATE}}   — datum isteka pasoša
{{PASSPORT_ISSUER}}        — izdavač pasoša
{{EMPLOYER_NAME}}          — ime firme
{{EMPLOYER_ADDRESS}}       — adresa firme
{{EMPLOYER_PIB}}           — PIB firme
{{EMPLOYER_MB}}            — matični broj firme
{{EMPLOYER_DIRECTOR}}      — ime direktora
{{JOB_TITLE_SR}}           — naziv posla (srpski)
{{JOB_TITLE_EN}}           — naziv posla (engleski)
{{JOB_DESC_SR_1}}          — opis posla bullet 1 (srpski)
{{JOB_DESC_SR_2}}          — opis posla bullet 2 (srpski)
{{JOB_DESC_SR_3}}          — opis posla bullet 3 (srpski)
{{JOB_DESC_EN_1}}          — opis posla bullet 1 (engleski)
{{JOB_DESC_EN_2}}          — opis posla bullet 2 (engleski)
{{JOB_DESC_EN_3}}          — opis posla bullet 3 (engleski)
{{SALARY_RSD}}             — plata u RSD
{{CONTRACT_START_DATE}}    — datum početka
{{CONTRACT_END_DATE}}      — datum kraja
{{SIGNING_DATE_SR}}        — datum potpisivanja (srpski format)
{{SIGNING_DATE_EN}}        — datum potpisivanja (engleski format)
{{CONTACT_EMAIL}}          — mejl
{{CONTACT_PHONE}}          — telefon
{{WORKER_ADDRESS}}         — adresa radnika u matičnoj zemlji
```

> [!CAUTION]
> **UGOVOR O RADU** ima **2-kolonski layout** (newspaper-style columns u DOCX). Srpski tekst ide u levu kolonu, engleski u desnu. NE koristiti tabele — koristiti DOCX section columns.

> [!CAUTION]
> **Opis posla ima 3 bullet-a po jeziku** — svaki bullet je zaseban paragraf u šablonu. NIKAD ne mapirati sve bullet-e na isti tekst jer to pravi 3x duplikaciju! Uvek `{{JOB_DESC_SR_1}}`, `{{JOB_DESC_SR_2}}`, `{{JOB_DESC_SR_3}}` zasebno.

#### 2. Proširiti Gemini passport ekstrakciju
Trenutno `extractPassportData()` ne izvlači:
- `date_of_issue` — datum izdavanja pasoša (POTREBNO za UGOVOR i POZIVNO PISMO)
- `issuing_authority` — izdavač pasoša (POTREBNO za POZIVNO PISMO)

Dodati u:
- `gemini.ts` → prompt i `PassportData` interface
- `ai_extracted_data` JSON se automatski ažurira (nema schema promene u Supabase za ovo)

#### 3. Proširiti `contract_data` tabelu
Dodati kolone u Supabase:
```sql
ALTER TABLE contract_data 
  ADD COLUMN candidate_passport_issue_date DATE,
  ADD COLUMN candidate_passport_issuer TEXT;
```

#### 4. Server-side DOCX generisanje
Implementirati API rutu (npr. `api/contracts/generate/route.ts`) koja:
1. Čita `contract_data` za dati match
2. Učitava DOCX šablon iz `public/templates/` ili Supabase Storage
3. Zameni sve `{{PLACEHOLDER}}` sa pravim podacima
4. Konvertuje DOCX → PDF (koristiti `docx-templates` ili `pizzip + docxtemplater` npm pakete)
5. Upload PDF u Supabase Storage
6. Vrati URL za download

#### 5. Admin UI za generisanje
Dugme "Generate Contracts" na admin match detail stranici:
- Generiše sva 4 dokumenta
- Prikazuje status (generating / done / error)
- Link za download ZIP-a sa svim dokumentima

### Dupla verifikacija (online + offline)

```
Upload pasoša → Gemini čita (online, primarni) → čuva u ai_extracted_data
                                                      ↓
Admin: "Generate Contracts" → sajt generiše DOCX/PDF iz šablona
                                                      ↓
Offline verifikacija: admin preuzme PDF-ove lokalno
→ pokrene verify_all.py (provera legacy teksta i missing data)
→ vizuelna provera (layout, podaci, duplikacije)
→ gotovo
```

> [!IMPORTANT]
> **Gemini je primarni izvor podataka** — Tesseract (lokalni OCR) se NE koristi kao dupli OCR jer je manje pouzdan.
> Lokalna verifikacija je **rule-based** (provera formata, logičnosti) + **vizuelna** (PDF pregled).

### ⚠️ Gotchas za dokument generisanje
1. **Job description 3x duplikacija** — NIKAD ne mapirati sve 3 bullet linije opisa posla na isti ceo tekst. Svaka linija mora imati svoj zaseban placeholder.
2. **Issuer** — za nepalske pasoše uvek `MOFA, DEPARTMENT OF PASSPORTS`. OCR/AI može da vrati garbage. Najbolje hardcoded po zemlji.
3. **Encoding** — DOCX generisanje mora podržati UTF-8 (srpski znakovi: Č, Ć, Š, Ž, Đ).
4. **Replacement sorting** — ako se radi string replacement (ne placeholder), sortirati parove LONGEST-FIRST.
5. **DOCX run splitting** — Word deli tekst u run-ove nepredvidivo. Placeholder `{{NAME}}` može biti u 2-3 run-a. Koristiti biblioteku koja to handluje (docxtemplater).
6. **Admin user counting** — kad se broje workeri iz auth usera, UVEK isključiti i `employer` I `admin` (`user_type !== 'employer' && user_type !== 'admin'`). Inače admin nalog ulazi u worker statistike.
7. **Admin profile access** — admin mora proći `user_type` check na 3 mesta: server-side `page.tsx`, klijentski `EmployerProfileClient.tsx fetchData()`, i layout guard. Ako dodaš novu zaštitu, proveri SVA 3.
8. **Storage bucket je `candidate-docs`** — NIKAD ne koristiti `from("documents")` za storage. Bucket `documents` NE POSTOJI. Jedini bucket je `candidate-docs`. Generisani DOCX ugovori idu u `candidate-docs/contracts/{matchId}/`.
9. **Whitelist za edit-data mora da odgovara stvarnoj DB šemi** — pre dodavanja kolone u whitelist, PROVERI da kolona zaista postoji u tabeli (FULL_SETUP.sql + migracije). Phantom kolone u whitelistu = tihi fail.
10. **CHECK constraint na candidates.status** — dozvoljene vrednosti: `NEW, DOCS_REQUESTED, DOCS_RECEIVED, UNDER_REVIEW, APPROVED, REJECTED, IN_QUEUE, OFFER_PENDING, VISA_PROCESS_STARTED, REFUND_FLAGGED`. Svaka druga vrednost → DB error.
11. **JS operator precedence u ternary** — `A || B ? C : D` se evaluira kao `(A||B) ? C : D`, NE kao `A || (B ? C : D)`. Uvijek stavljaj zagrade.
12. **Unicode u regex** — za srpska imena (Č, Ć, Š, Ž, Đ) koristiti `\p{L}` sa `u` flagom, NIKAD `[A-Z]`.
13. **`profiles` tabela NEMA `role` kolonu** — kolona se zove `user_type`. NIKAD ne koristiti `profile?.role`. Svuda koristiti `profile?.user_type !== 'admin'`. Ovo je bila sistemska greška u 14 fajlova.
14. **Employer status vrednosti su UPPERCASE** — DB CHECK dozvoljava samo `PENDING`, `VERIFIED`, `REJECTED`. NIKAD lowercase `active/pending/rejected`.
15. **Admin auth check pattern** — za API rute: `select("user_type")` + `profile?.user_type !== "admin"`. Za stranice: isti pattern + `isGodModeUser()` fallback. Za server actions: samo `user_type`, bez godmode.
16. **Webhook/Cron rute MORAJU koristiti `createAdminClient()`** — `createClient()` zahteva auth cookies. Stripe webhooks, WhatsApp webhooks, i Vercel cron jobs NEMAJU cookies. Sve DB operacije će tiho da failuju. Uvek koristiti `createAdminClient()` za ove rute.
17. **`OFFER_ACCEPTED` status** — ~~NE POSTOJI u CHECK constraint~~ FIXED u migraciji `004_bugfix_schema_sync.sql`. CHECK sad uključuje: `NEW, DOCS_REQUESTED, DOCS_RECEIVED, DOCS_PENDING, DOCS_VERIFYING, UNDER_REVIEW, APPROVED, VERIFIED, REJECTED, REJECTED_TWICE, IN_QUEUE, OFFER_PENDING, OFFER_ACCEPTED, VISA_PROCESS_STARTED, REFUND_FLAGGED`.
18. **`payments` tabela schema** — ~~drift~~ FIXED. `COMPLETE_RESET.sql` sada koristi `user_id` i `amount` (ne `profile_id`/`amount_cents`). Dodate kolone: `stripe_checkout_session_id`, `paid_at`, `deadline_at`, `metadata`, `refund_status`, `refund_notes`.
19. **Next.js `redirect()` u try/catch** — `redirect()` radi tako što THROWUJE specijalan error sa `digest: "NEXT_REDIRECT"`. Ako imaš try/catch, MORAŠ re-throwovati: `if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;`. Inače redirect nikad neće raditi.
20. **Admin stranice zahtevaju EKSPLICITAN auth check** — `AppShell variant="admin"` NE štiti stranicu. Svaka admin `page.tsx` MORA imati `profiles.user_type === 'admin'` check. Bez toga, SVAKI ulogovani korisnik može da vidi admin dashboard, queue, jobs.
21. **`email_queue.read_at` kolona** — notifications API čita/piše `read_at`, ali je kreirana tek u migraciji `007_round10_fixes.sql`. Ako migracija nije pokrenuta, notifications endpoint crashuje.
22. **Supabase `.in()` sa praznim nizom crashuje** — `.in("id", [])` baca error. UVEK koristi guard: `.in("id", ids.length > 0 ? ids : ["__none__"])`. Videti `document-status/route.ts` za ispravan pattern.
23. **`verify-document` storage/DB ops moraju koristiti admin klijent za admin pozive** — kada admin triggeruje re-verify (preko `/api/admin/re-verify`), `verify-document` prima admin-ove cookies. Ali storage operacije (upload/remove/update) koriste RLS. Admin ne može menjati tuđe fajlove preko RLS-bound klijenta. Koristiti `storageClient = isAdmin ? createAdminClient() : supabase` pattern.
24. **TypeScript interface ≠ DB kolona** — kad dodaješ novo polje u `ContractDataForDocs` interface ili bilo koji drugi tip koji mapira na DB tabelu, MORAŠ napraviti SQL migraciju (`ALTER TABLE ... ADD COLUMN`). TypeScript se kompajlira bez greške ali INSERT puca u runtime-u. Uvek ažuriraj i `COMPLETE_RESET.sql`.
25. **User/Admin delete MORA da obriše SVE povezane tabele** — `delete-user` i `account/delete` moraju brisati: `candidate_documents`, `signatures`, `contract_data` (kroz matches), `offers`, `matches`, `payments`, `email_queue`, `whatsapp_messages`, pa tek onda `candidates`, `employers`, `profiles`, auth. Bez toga ostaju siročići u bazi.
26. **`queue/auto-match` koristi `createClient()` umesto `createAdminClient()`** — admin-only ruta piše u `offers`, `candidates`, `job_requests`. Pošto admin ima RLS pristup, ovo radi ali je krhak pattern. Ako se RLS politike promene, ruta će tiho failovati. Preporučeno: koristiti `createAdminClient()` za sve admin-only mutation rute.
