# 🏗️ Workers United — AGENTS.md

> **Poslednje ažuriranje:** 28.02.2026 (AGENTS.md restrukturisan, WhatsApp AI chatbot live, Stripe live, cron re-enabled)

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
11. **⚠️ PROVERI NOTIFIKACIJE PRI SVAKOJ PROMENI** — kad menjaš bilo šta na platformi (URL-ove, cene, naziv polja, flow korisnika, novu stranicu), OBAVEZNO proveri da li to utiče na:
    - **Email šablone** (`src/lib/email-templates.ts`) — linkovi, tekstovi, nazivi
    - **WhatsApp šablone** (`src/lib/whatsapp.ts`) — body tekst, URL-ovi dugmadi, nazivi template-a
    - **WhatsApp šablone u Meta Business Manager-u** — ako menjaš URL ili tekst, moraš submitovati NOVI šablon jer se odobreni šabloni NE MOGU menjati
    - **Notifikacije** (`src/lib/notifications.ts`) — ponude, statusi, linkovi
    - **Cron jobove** (`src/app/api/cron/`) — koji šalju automatske mejlove i WhatsApp poruke
    
    **Pravilo:** Svaka promena koja menja ono što korisnik vidi na sajtu MORA da se reflektuje i u svim kanalima komunikacije (email + WhatsApp). Ako zaboraviš — korisnik dobija poruku sa pogrešnim linkom ili zastarelim informacijama.

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
- **⚠️ NIKAD NE REĆI DA JE SRBIJA JEDINA ZEMLJA** — na sajtu, u kodu, u komentarima, u komunikaciji sa korisnicima — NIKAD ne otkriti da trenutno operišemo samo u Srbiji. Platforma se prezentuje kao multi-country. Kad se proširimo na druge zemlje, dodaćemo multi-country pricing. Do tada — nikakva naznaka da je Srbija jedina destinacija.
- **Potpuna usluga** — mi nismo job board. Mi radimo SVE od A do Ž.
- **Poslodavci ne plaćaju ništa** — usluga je besplatna za poslodavce, zauvek.
- **NIŠTA LAŽNO** — nikad ne pravimo placeholder sadržaj, lažne reklame, lažne kontakte ili bilo šta što izgleda kao da postoji a ne postoji. Svaki element na sajtu mora biti funkcionalan i realan.
- **POTPUNA AI AUTOMATIZACIJA** — one-man operacija, sve se radi automatski. n8n + GPT-4o-mini obrađuje WhatsApp komunikaciju, Gemini obrađuje email i verifikaciju dokumenata. Nema ručnog odgovaranja na poruke. Kontakt forma automatski odgovara uz AI. WhatsApp bot se dopisuje sa korisnicima — prepoznaje ih po broju telefona, zna njihov status, i daje personalizovane odgovore.

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

### Logo & Navbar dizajn:
- **Pristup logotipu se prmenio** — više ne koristimo jedan spojen fajl. Sada koristimo dvokomponentni logo.
- **Ikona (ruke):** `public/logo-icon.png` — tamno plave ruke bez pozadine i bez teksta. Veličina u navbar-u: fiksna `h-16 w-16`.
- **Tekst (wordmark):** `public/logo-wordmark.png` — tekst "WORKERS UNITED" bez pozadine, horizontalno trimovan. Veličina u navbar-u: fiksna `w-[140px]`.
- **Navbar dizajn:** Navigacija (`UnifiedNavbar.tsx`) je tanka (`h-[64px]`), sa trajnim glassmorphism efektom (`bg-white/90 backdrop-blur-md`). Dinamički scroll (bubrenje/skupljanje) je **ukinut** po zahtevu vlasnika u korist čistije linije. 
- **`logo-full.jpg`** — full logo sa plavom pozadinom, koristi se za OG/meta slike, NE za navbar.
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
- **AI:** Gemini 2.0 Flash (verifikacija dokumenata, auto-reply na kontakt formu) + GPT-4o-mini via n8n (WhatsApp chatbot)
- **Email:** Nodemailer + Google Workspace SMTP (contact@workersunited.eu)
- **Hosting:** Vercel Pro (sa cron jobovima)
- **Automation:** n8n Cloud (WhatsApp AI chatbot workflow)
- **Icons:** Lucide React

### Planovi i pretplate:
| Servis | Plan | Cena | Napomena |
|---|---|---|---|
| Supabase | **Pro** | $25/mesec | Leaked Password Protection, Custom SMTP, daily backup, veći limiti |
| Vercel | **Pro** | $20/mesec | Preview deploys, analytics, veći bandwidth |

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

# WhatsApp Business API (Meta Cloud API)
WHATSAPP_TOKEN=your-permanent-system-user-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token

# n8n AI Chatbot
N8N_WHATSAPP_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook/whatsapp-webhook

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

> Za kompletnu istoriju promena pogledaj `CHANGELOG.md`

### 🔲 TODO
- [ ] **n8n email automation** — retry failed emails, auto-responder za inbox
- [ ] Multi-country pricing za placement fee — **odloženo** dok se ne proširimo na druge zemlje
- [ ] **Final smoke test** — end-to-end test celokupnog flow-a
- [ ] **Desktop signup page review** — user reported it needs styling update

### ✅ Završeno (poslednje)
- [x] WhatsApp AI chatbot (n8n + GPT-4o-mini) — 28.02.2026
- [x] Stripe $9 Entry Fee live — 28.02.2026
- [x] Cron jobovi re-enabled — 28.02.2026
- [x] Analytics dashboard (Recharts) — 28.02.2026
- [x] WhatsApp Business API — 26.02.2026
- [x] Google OAuth — 25.02.2026
- [x] GDPR, email sistem, mobilna responsivnost — Feb 2026

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
| `src/lib/whatsapp.ts` | WhatsApp Cloud API — template sending, text sending, logging, 10 convenience wrappers |
| `src/lib/docx-generator.ts` | DOCX generisanje iz šablona (docxtemplater + nationality mapping) |

### Cron Jobs (vercel.json):
| Putanja | Raspored | Namena |
|---|---|---|
| `/api/cron/check-expiry` | Svaki sat | Provera isteklih sesija |
| `/api/cron/profile-reminders` | Daily 9 AM UTC | Podsetnik za nepotpune profile (reminder + warning + deletion) |
| `/api/cron/check-expiring-docs` | Daily 8 AM UTC | Alert za pasoš koji ističe za <6 meseci (max 1 email/30 dana) |
| `/api/cron/match-jobs` | Svaki sat | Auto-matching radnika i poslova |

### ⚠️ Email & WhatsApp Common Gotchas:
- **Email + WhatsApp dual-send** — `queueEmail()` prima opcionalni `recipientPhone` parametar. Kad ga prosledite, automatski šalje i WhatsApp template. WhatsApp failure NIKAD ne blokira email.
- **WhatsApp šabloni se NE MOGU menjati posle odobrenja** — ako menjaš tekst ili URL, moraš kreirati NOV šablon u Meta Business Manager-u i ažurirati ime u `whatsapp.ts`.
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
- [ ] **Per-Country Landing Pages ZA POSLODAVCE** — `/hire-workers-serbia`, `/hire-workers-germany` sa info za poslodavce kako da nađu radnike preko nas (SEO)
- [x] ~~**Email sekvence** — welcome email, podsetnik za nepotpun profil, status update iz queue-a~~
- [x] ~~**Konsolidacija email sistema** — spojen `check-incomplete-profiles` u `profile-reminders`, shared `profile-completion.ts` lib, strict TemplateData, admin email preview~~
- [ ] **n8n email auto-responder** — AI obrađuje email thread-ove (ne samo kontakt formu)
- [x] ~~**WhatsApp AI Chatbot (n8n + GPT-4o-mini)** — konverzacijski bot koji se dopisuje sa korisnicima. Prepoznaje ih po broju telefona, čita profil/status iz baze, daje personalizovane odgovore. Flow: korisnik piše → Meta webhook → Vercel → n8n AI → Vercel → WhatsApp reply~~ ✅ 28.02.2026
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
10. **CHECK constraint na candidates.status** — dozvoljene vrednosti: `NEW, PROFILE_COMPLETE, PENDING_APPROVAL, VERIFIED, APPROVED, IN_QUEUE, OFFER_PENDING, OFFER_ACCEPTED, VISA_PROCESS_STARTED, VISA_APPROVED, PLACED, REJECTED, REFUND_FLAGGED`. Svaka druga vrednost → DB error. Migracija: `007_admin_approval.sql`. **Kad dodaješ novi status, ažuriraj I migraciju I ovaj spisak.**
11. **JS operator precedence u ternary** — `A || B ? C : D` se evaluira kao `(A||B) ? C : D`, NE kao `A || (B ? C : D)`. Uvijek stavljaj zagrade.
12. **Unicode u regex** — za srpska imena (Č, Ć, Š, Ž, Đ) koristiti `\p{L}` sa `u` flagom, NIKAD `[A-Z]`.
13. **`profiles` tabela NEMA `role` kolonu** — kolona se zove `user_type`. NIKAD ne koristiti `profile?.role`. Svuda koristiti `profile?.user_type !== 'admin'`. Ovo je bila sistemska greška u 14 fajlova.
14. **Employer status vrednosti su UPPERCASE** — DB CHECK dozvoljava samo `PENDING`, `VERIFIED`, `REJECTED`. NIKAD lowercase `active/pending/rejected`.
15. **Admin auth check pattern** — za API rute: `select("user_type")` + `profile?.user_type !== "admin"`. Za stranice: isti pattern + `isGodModeUser()` fallback. Za server actions: samo `user_type`, bez godmode.
16. **Webhook/Cron rute MORAJU koristiti `createAdminClient()`** — `createClient()` zahteva auth cookies. Stripe webhooks, WhatsApp webhooks, i Vercel cron jobs NEMAJU cookies. Sve DB operacije će tiho da failuju. Uvek koristiti `createAdminClient()` za ove rute.
17. **`OFFER_ACCEPTED` status** — ~~NE POSTOJI u CHECK constraint~~ FIXED u migraciji `007_admin_approval.sql`. Videti Gotcha #10 za potpunu listu dozvoljenih statusa.
18. **`payments` tabela schema** — ~~drift~~ FIXED. `COMPLETE_RESET.sql` sada koristi `user_id` i `amount` (ne `profile_id`/`amount_cents`). Dodate kolone: `stripe_checkout_session_id`, `paid_at`, `deadline_at`, `metadata`, `refund_status`, `refund_notes`.
19. **Next.js `redirect()` u try/catch** — `redirect()` radi tako što THROWUJE specijalan error sa `digest: "NEXT_REDIRECT"`. Ako imaš try/catch, MORAŠ re-throwovati: `if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;`. Inače redirect nikad neće raditi.
20. **Admin stranice zahtevaju EKSPLICITAN auth check** — `AppShell variant="admin"` NE štiti stranicu. Svaka admin `page.tsx` MORA imati `profiles.user_type === 'admin'` check. Bez toga, SVAKI ulogovani korisnik može da vidi admin dashboard, queue, jobs.
21. **`email_queue.read_at` kolona** — notifications API čita/piše `read_at`, ali je kreirana tek u migraciji `007_round10_fixes.sql`. Ako migracija nije pokrenuta, notifications endpoint crashuje.
22. **Supabase `.in()` sa praznim nizom crashuje** — `.in("id", [])` baca error. UVEK koristi guard: `.in("id", ids.length > 0 ? ids : ["__none__"])`. Videti `document-status/route.ts` za ispravan pattern.
23. **`verify-document` storage/DB ops moraju koristiti admin klijent za admin pozive** — kada admin triggeruje re-verify (preko `/api/admin/re-verify`), `verify-document` prima admin-ove cookies. Ali storage operacije (upload/remove/update) koriste RLS. Admin ne može menjati tuđe fajlove preko RLS-bound klijenta. Koristiti `storageClient = isAdmin ? createAdminClient() : supabase` pattern.
24. **TypeScript interface ≠ DB kolona** — kad dodaješ novo polje u `ContractDataForDocs` interface ili bilo koji drugi tip koji mapira na DB tabelu, MORAŠ napraviti SQL migraciju (`ALTER TABLE ... ADD COLUMN`). TypeScript se kompajlira bez greške ali INSERT puca u runtime-u. Uvek ažuriraj i `COMPLETE_RESET.sql`.
25. **User/Admin delete MORA da obriše SVE povezane tabele** — `delete-user` i `account/delete` moraju brisati: `candidate_documents`, `signatures`, `contract_data` (kroz matches), `offers`, `matches`, `payments`, `email_queue`, `whatsapp_messages`, pa tek onda `candidates`, `employers`, `profiles`, auth. Bez toga ostaju siročići u bazi.
26. **`queue/auto-match` koristi `createClient()` umesto `createAdminClient()`** — ~~krhak pattern~~ FIXED. Admin-only ruta sada koristi `createAdminClient()` za sve DB operacije (`offers`, `candidates`, `job_requests`). `createClient()` ostaje samo za auth check.
27. **Profile completion drift — koristi `getWorkerCompletion()` kao single source of truth** — `workers/page.tsx` je imao inline 16-field proveru koja nije koristila deljenu `getWorkerCompletion()` funkciju. Svaki put kad se menja logika kompletnosti profila, morala bi se menjati na 3 mesta. UVEK koristiti `getWorkerCompletion()` iz `profile-completion.ts`.
28. **ContactForm → `/api/send-email` ruta je MORALA da postoji** — ContactForm je pozivao `/api/send-email` koji NIJE postojao. Svaki submit je davao 404. Ruta je kreirana sa email validacijom i slanjem na admin email preko `sendEmail()` iz `mailer.ts`.
29. **⚠️ SVI CRON JOBOVI SU UGAŠENI — sistem je u fazi pripreme** — `vercel.json` crons array je prazan. Četiri cron joba su bila aktivna i slala emailove korisnicima: `match-jobs` (svaki sat — matchovao workere sa jobovima), `check-expiry` (svaki sat — procesovao expired offers), `profile-reminders` (svaki dan — slao remindere i **BRISAO KORISNIKE posle 30 dana**), `check-expiring-docs` (svaki dan). Rute i dalje postoje u `/api/cron/` i mogu se ručno pozvati. Kad sistem bude spreman za produkciju, dodaj schedule-ove nazad u `vercel.json`.
30. **🚫 AUTOMATSKI CRON MEJLOVI SU UGAŠENI — welcome/signup emailovi RADE normalno** — Cron jobovi su ugašeni jer su slali lažne notifikacije (npr. "pronađen vam je posao") kad nema odobrenih profila u sistemu. Welcome email, signup potvrda, admin announcements, kontakt forma — SVE TO RADI. Samo `match-jobs`, `profile-reminders`, `check-expiring-docs`, `check-expiry` su isključeni u `vercel.json`. NE uključivati ih dok tim ne kaže.
31. **🛡️ MANUELNA ADMIN VERIFIKACIJA JE OBAVEZNA** — Radnici NE mogu da plate $9 entry fee dok admin ne odobri profil. Flow: radnik popuni profil 100% → admin pregleda u `/admin/workers/[id]` → klikne "Approve for Payment" → tek tada radnik vidi Pay dugme na queue stranici. Server-side zaštita: Stripe `create-checkout` odbija neodobrene radnike sa 403. DB kolone: `admin_approved`, `admin_approved_at`, `admin_approved_by` na `candidates` i `employers` tabelama. Migracija: `007_admin_approval.sql`.
32. **🚀 LAUNCH DATUM: 01.03.2026** — sve mora biti gotovo do tada. Videti Sekciju 9.
33. **Stripe webhook MORA da postavi `queue_joined_at`** — kad se kandidat prebaci u `IN_QUEUE` posle plaćanja entry fee, MORA se postaviti i `queue_joined_at: new Date().toISOString()`. Bez toga, 90-dnevni countdown na admin dashboardu ne radi jer je `queue_joined_at` null.
34. **`notifications.ts` koristi `NEXT_PUBLIC_BASE_URL`** — env var za base URL je `NEXT_PUBLIC_BASE_URL`, NE `NEXT_PUBLIC_SITE_URL`. Offer link je `/profile/worker/offers/{id}`, NE `/profile/offers/{id}`. Format datuma je `en-GB`, NE `en-US`.
35. **`match-jobs` cron MORA filtrirati `IN_QUEUE` + `entry_fee_paid`** — bez ovih filtera, cron matchuje SVE kandidate sa verifikovanim pasošem, uključujući one koji nisu platili entry fee ni ušli u queue.
36. **Auto-deletion u `profile-reminders` MORA da obriše SVE tabele** — samo brisanje auth usera (`deleteUser`) ostavlja siročiće u `candidates`, `profiles`, `candidate_documents`, `payments`, `email_queue`, `employers`. UVEK brisati SVE povezane tabele + storage pre brisanja auth usera. Isti pattern kao `account/delete` i `admin/delete-user`.
37. **Google OAuth korisnici NEMAJU `user_type` pri prvom login-u** — ako korisnik klikne "Sign in with Google" na login stranici (ne signup), biće preusmeren na `/auth/select-role`. Auth callback proverava `user_metadata.user_type` i ako ga nema, šalje tamo. Signup stranica automatski šalje `user_type` kroz URL param.
38. **Google OAuth — Supabase Provider MORA biti konfigurisan** — potreban Google Cloud OAuth Client ID + Secret u Supabase Dashboard → Authentication → Providers → Google. Redirect URL iz Supabase mora biti dodat kao Authorized Redirect URI u Google Cloud Console.
39. **WhatsApp šabloni MORAJU biti odobreni u Meta Business Manager-u pre korišćenja** — `sendWhatsAppTemplate()` će vratiti error ako template nije approved. Imena šablona su lowercase sa underscores (npr. `document_reminder`). Maximum 550 karaktera za body. Utility šabloni ne smeju imati promotivni sadržaj — Meta ih automatski re-kategoriše u Marketing.
40. **WhatsApp webhook MORA koristiti `createAdminClient()`** — Meta šalje webhook bez auth cookies. Sve DB operacije moraju koristiti service role client. Webhook ruta ima i GET (verifikacija) i POST (poruke + status update-ovi).
41. **`queueEmail()` podržava opcionalni `recipientPhone` parametar** — kad se prosledi, automatski šalje i WhatsApp template uz email. WhatsApp failure NIKAD ne blokira email slanje. Dodati phone kao poslednji argument: `queueEmail(supabase, userId, type, email, name, data, scheduledFor, phone)`.
42. **RLS policy MORA koristiti `(select auth.uid())` a NE `auth.uid()` direktno** — `auth.uid()` se re-evaluira za SVAKI red u tabeli, što drastično usporava query-je. Zamotan u subquery `(select auth.uid())` se poziva samo jednom. Ovo važi za sve `auth.<function>()` pozive u RLS policy-ima (uid, jwt, role). Supabase Advisor detektuje ovo kao performance warning.
43. **Telefon se čuva u `candidates.phone`, NE u Supabase Auth** — Auth `phone` polje je za SMS login. Naš phone se čuva u candidates tabeli. `ProfileClient.tsx` sinhronizuje phone u `auth.user_metadata` na save da bude vidljiv u Auth dashboardu. WhatsApp webhook traži korisnika po `candidates.phone`.


---

## 9. 🚀 LAUNCH STATUS — 01.03.2026

> **Cilj:** 1. marta sajt počinje da zarađuje.

### ⚠️ Preduslovi za launch
1. ✅ Sajt radi (Vercel deploy)
2. ✅ Auth (signup/login/logout + Google OAuth)
3. ✅ Worker profil + dokumenta + AI verifikacija
4. ✅ Admin panel + manual approval
5. ✅ Email sistem (welcome, reminders, admin updates)
6. ✅ Supabase Pro + password strength
7. ✅ Stripe plaćanja ($9 entry fee) — LIVE 28.02.2026
8. ✅ Cron jobovi aktivni — 28.02.2026
9. ✅ WhatsApp AI chatbot (n8n + GPT-4) — 28.02.2026
10. ⬜ Final smoke test
11. ⬜ n8n email automation (retry failed emails)

---

## 📛 Common Gotchas

1. **NEVER delete or rewrite lawyer-written documents without reading them first.** DOCX templates in `public/templates/` contain legal text written by a lawyer. When migrating formats (e.g., DOCX → PDF), always extract and use the exact original text. Use PowerShell to extract XML from DOCX files: they are ZIP archives with `word/document.xml` inside.

2. **POZIVNO PISMO uses Cyrillic script** — not Serbian Latin like the other 3 documents. The Noto Sans font supports both scripts.

3. **Font files must be committed** — `public/fonts/NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` are required for PDF generation. If missing, `@react-pdf/renderer` will silently fall back to a font that doesn't support Serbian characters.

4. **PDF generation uses `@react-pdf/renderer`** — templates are React components in `src/lib/pdf-templates/`. The entry point is `src/lib/pdf-generator.ts` which has the same public API as the old `docx-generator.ts`.

5. **@react-pdf `render` prop does NOT work server-side** — the `render` callback (used for dynamic page numbers) returns nothing when using `renderToBuffer()`. Workaround: use `pdf-lib` for post-processing. The `stampPageNumbers()` function in `pdf-generator.ts` adds page numbers using Helvetica after the PDF is generated. Do NOT attempt to use the `render` prop again for dynamic content.

6. **Profile completion gate blocks contract preparation** — `contracts/prepare/route.ts` checks `getWorkerCompletion()` and returns 400 if profile is not 100% complete. This prevents generating documents with missing data.

7. **International Employer Simplification** — Non-Serbian employers only need Company Name, Phone, and Country to register (for interest tracking). Serbian employers need verified Tax ID, Reg No, etc. for contracts. `calculateCompletion` and `getEmployerCompletion` handle this bifurcation conditionally based on `country`. Both UI and backend logic MUST be aligned on which fields are required.

8. **`tax_id` is the canonical column, NOT `pib`** — The legacy `pib` column exists in `FULL_SETUP.sql` for backwards compatibility, but `tax_id` is the universal name (works for all countries, not just Serbia). Backend code must read `tax_id` (with `pib` fallback for old data). The UI `saveCompany` writes only to `tax_id`. Never reference `pib` in new code.

9. **Completion % must be synced** — `calculateCompletion()` in `EmployerProfileClient.tsx` and `getEmployerCompletion()` in `profile-completion.ts` must have exactly the same required fields. If you change one, change both. The server function is the source of truth (used as contract readiness gate).

10. **Body background is DARK NAVY (#0F172A)** — The `body` background in `globals.css` is set to dark navy to match all page footers. Each page component sets its own light background on its outer `min-h-screen` div (e.g., `bg-[#F8FAFC]`). Do NOT change the body background back to a light color — it will cause visible white/gray space below all page footers.

11. **All admin API routes MUST include `isGodModeUser()` check** — The owner account's `profile.user_type` is "worker", not "admin". Any admin API route checking `profile?.user_type !== "admin"` must also check `!isGodModeUser(user.email)`. Pattern: `if (profile?.user_type !== "admin" && !isGodModeUser(user.email))`. Import from `@/lib/godmode`.

12. **WhatsApp webhook requires WABA `subscribed_apps` API call** — After setting up the webhook in Meta Developer Portal, you MUST also call `POST /{WABA-ID}/subscribed_apps` via Graph API Explorer. Without this, Meta's "Test" button works but REAL incoming messages do NOT trigger the webhook. This is the #1 cause of "webhook configured but no events delivered" issues.

13. **WhatsApp AI Chatbot architecture** — The flow is: `User → WhatsApp → Meta → Vercel webhook (route.ts) → n8n AI → Vercel → WhatsApp reply`. Vercel handles sending the reply using its own `WHATSAPP_TOKEN`, NOT n8n. n8n only does AI processing and returns the text via "Respond to Webhook" node. Key env vars: `N8N_WHATSAPP_WEBHOOK_URL`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`/`CRON_SECRET` (for webhook verification).

---

## 💡 Suggestions

1. Consider adding article/section numbers back to UGOVOR O RADU — the original DOCX didn't have numbered articles (just section headers), but adding them could improve readability.
2. The POZIVNO PISMO has a hardcoded "1 ЈЕДНА (ONE)" for number of visits — this could be made configurable.
3. Consider adding a PDF preview feature in the admin panel before generating final documents.
4. **Payment/Stripe integration** — kad se bude pravio payment flow, profil gate je već na mestu na API nivou (`contracts/prepare/route.ts`). Samo treba dodati frontend poruku na worker dashboard-u tipa "Complete your profile to proceed to payment" i disable-ovati payment dugme dok `profileCompletion < 100`.

