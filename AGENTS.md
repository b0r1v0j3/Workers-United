# 🏗️ Workers United — AGENTS.md

> **Poslednje ažuriranje:** 09.03.2026 (Worker `candidate -> worker` cutover je završen end-to-end: live public schema više ne izlaže `candidates` / `candidate_documents`, `contract_data` koristi samo `worker_*` override kolone, jedini preostali storage bucket je `worker-docs`, auth signup trigger sada upisuje direktno u kanonski `workers`, worker workspace shell je vizuelno poravnat, worker overview kartice sada prate isti blaži radius ritam kao sidebar, sidebar logout je zakucan za dno bez mrtvog prostora, logout confirm se renderuje kroz pravi portal na sredini ekrana umesto unutar sidebara, agency sidebar više ne duplira isti `/profile/agency` ulaz kroz `Overview + Agency Workers`, agency worker tabela više ne beži na poseban `Open` ekran nego koristi isti modal/form za `Add + Edit worker`, mobile workspace shell je dodatno zategnut sa užim rail-om, manjim left offset-om, nižim agency hero-jem i manjim ujednačenim shell/card radiusom, a desktop shell sada ima levi gutter umesto lepljenja za ivicu ekrana i uži collapsed rail da više liči na mobilni; agency lista sada ima redni broj, trajni `Added` datum preko novog immutable `workers.created_at` signala, single-worker `$9` checkout CTA, row/bulk delete za draft i claimed worker naloge, bulk payment ostaje zaključan dok Stripe/webhook ne podrže siguran multi-worker total, agency sada može direktno da plati entry fee i za draft worker-e bez `claim link / claim first` koraka, a otvoreni ali neplaćeni Stripe checkout više se ne izlaže agency-u kao posebna završna faza: worker ostaje `Not paid yet / Pay $9`, dok isto dugme po potrebi tiho nastavlja postojeći checkout session; `Status` kolona više ne duplira `Completion` nego prikazuje stvarnu operativnu fazu (`Not paid yet`, `Paid`, `Waiting X days`, `Job offered`, `Offer accepted`, `Visa`, `Refund`, `Placed`) na osnovu payment/refund/queue signala; agency worker board je vraćen na klasičnu tabelu sa jačim horizontalnim i vertikalnim separatorima po kolonama, a `Completion` polje sada ima pravi progress meter/skalu umesto golog procenta; Brain/ops monitoring takođe ispravno parsira dnevni report, šalje exception mail, razlikuje platform-side WhatsApp template kvar od nedostavljivog broja/zemlje i `system-smoke` više ne proglašava opcioni degradirani servis potpuno zdravim.)

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
12. **🔑 Shortcut keyword `REVIZIJA`** — ako korisnik u novom chatu napiše samo `REVIZIJA`, tretiraj to kao zahtev za puni dnevni ops sweep bez dodatnog objašnjavanja: `git pull`, pregled današnjeg `brain_reports`, ručni `system-smoke`, provera recent `email_queue` failova, provera recent `whatsapp_messages` failova, vizuelni/runtime sweep najkritičnijih flow-ova i odmah zatim fix najvažnijeg otkrivenog problema ako je bezbedan za isti pass.

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
- **POTPUNA AI AUTOMATIZACIJA** — one-man operacija, sve se radi automatski. OpenAI GPT-4o-mini obrađuje verifikaciju dokumenata, dok Gemini ostaje fallback za document AI ako OpenAI vision trenutno nije dostupan. WhatsApp bot sada koristi GPT-5 mini intent router + response sloj, prepoznaje korisnika po broju telefona, zna njegov status i odgovara personalizovano bez ručnog operatera. Kontakt forma automatski odgovara uz AI.

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

### Radnik (Worker):
```
1. Registracija (signup)
2. Popuni profil (lični podaci, radne preferencije, potpis)
3. Upload dokumenata (pasoš, biometrijska foto, diploma)
4. AI automatski verifikuje dokumenta
5. Profil mora biti 100% popunjen da bi bio verifikovan
6. Kad je verifikovan → može da plati $9 za traženje posla
7. Posle uspešne `$9` uplate otključava mu se in-platform support inbox (`/profile/worker/inbox`)
8. Ulazi u QUEUE (red čekanja) — čeka da se nađe match
9. Ako se nađe posao → doplatiti placement fee (npr. $190 za Srbiju)
10. Mi pokrećemo proces apliciranja za radnu vizu
11. Kad viza bude odobrena → sprovodimo radnika do poslodavca
```

### Poslodavac (Employer):
```
1. Registracija (signup)
2. Popuni profil kompanije (naziv, PIB, adresa, delatnost, itd.)
3. Profil mora biti 100% popunjen da bi bio verifikovan
4. U profilu ima odeljak za traženje radnika:
   - Broj radnika, plata, lokacija rada, opis posla
5. Mi tražimo match iz naše baze verifikovanih radnika
6. Kad nađemo match → realizujemo vizu i sprovedemo radnika
```

### Admin:
```
- Pregled svih radnika i poslodavaca
- Ručna verifikacija dokumenata (backup za AI)
- Upravljanje queue-om i ponudama
- In-platform support inbox za odgovaranje worker-ima bez izlaska na WhatsApp/email
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
- **Pristup logotipu je kontekstualan** — za auth/hero može full transparentni logo (`public/logo-complete-transparent.png`), dok navbar koristi split layout radi čitljivosti.
- **Ikona (ruke):** `public/logo-icon.png` — koristi se za kvadratne kontekste i leva je komponenta split navbar logotipa.
- **Wordmark-only varijanta:** `public/logo-wordmark.png` — desna komponenta split navbar logotipa i fallback za horizontalne layout-e.
- **Navbar dizajn:** `UnifiedNavbar.tsx` koristi čist public header (`h-[52px] md:h-[56px]`) sa blagim glass efektom pri skrolu (top: `bg-white/40` + vrlo blag blur, scroll: `bg-white/70` + `backdrop-blur-sm`), bez srednjih public linkova (`How it works / For Workers / For Employers`) i bez mobile hamburger menija. U public varijanti je `Workers United` levo, dok su ruke (logo-ikona) centrirane i na desktopu i na mobilnom prikazu; desne akcije su skroz desno. Public variant nema border/shadow liniju i ostaje sticky pri skrolu. Dinamički scroll resize (bubrenje/skupljanje) je **ukinut**. 
- **`logo-full.jpg`** — full logo sa plavom pozadinom, koristi se za OG/meta slike, NE za navbar.
- `/profile` — auto-redirect na worker ili employer
- `/profile/worker` — profil radnika (3 taba: Profile Info, Documents, Status)
- `/profile/worker/edit` — editovanje profila (single-page form, ne wizard)
- `/profile/worker/inbox` — worker support inbox (otključava se posle `$9 Job Finder` uplate)
- `/profile/worker/queue` — status u redu čekanja
- `/profile/worker/offers/[id]` — detalji ponude
- `/profile/employer` — profil poslodavca
- `/profile/employer/jobs` — legacy ruta koja redirectuje na `/profile/employer?tab=jobs`
- `/profile/employer/jobs/new` — legacy ruta koja redirectuje na `/profile/employer?tab=post-job`
- `/admin` — admin panel
- `/admin/workers` — lista radnika (ranije /admin/candidates)
- `/admin/workers/[id]` — detalji radnika
- `/admin/employers` — lista poslodavaca
- `/admin/agencies` — lista agencija + read-only `Open Workspace` inspect ulaz
- `/admin/queue` — queue management
- `/admin/inbox` — admin support inbox
- `/admin/settings` — admin podešavanja

### Tehnički stack:
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4, Montserrat font
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **Plaćanja:** Stripe (Checkout Sessions + Webhooks)
- **AI:** OpenAI GPT-4o-mini (primarni vision sloj za verifikaciju dokumenata), GPT-5 mini (`WHATSAPP_ROUTER_MODEL` + `WHATSAPP_RESPONSE_MODEL`) za WhatsApp intent router/response sloj, Gemini fallback chain za document verification (`gemini-3.0-flash → gemini-2.5-pro → gemini-2.5-flash`), i GPT-5 mini (`BRAIN_DAILY_MODEL`) za daily Brain snapshots / exception reports
- **Email:** Nodemailer + Google Workspace SMTP (contact@workersunited.eu)
- **Hosting:** Vercel Pro (sa cron jobovima)
- **Automation:** n8n Cloud (email/ops automations i budući tool workflows)
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
npm run typecheck  # Obavezan TypeScript gate (tsc --noEmit)
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

# OpenAI
OPENAI_API_KEY=your-openai-key
WHATSAPP_ROUTER_MODEL=gpt-5-mini
WHATSAPP_RESPONSE_MODEL=gpt-5-mini
BRAIN_DAILY_MODEL=gpt-5-mini

# Google Gemini AI (document verification fallback)
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
#### Sada
- [ ] **Admin/Ops rewrite v2** — jedan stvarno funkcionalan admin za pregled worker/employer/agency naloga, bez role drift-a, sa jasnim ulazom u queue/offers/payments/docs i bez konfuznih preview slepih ulica
- [ ] **Profile workspace unification pass 2** — worker, employer i agency moraju vizuelno i funkcionalno da deluju kao isti proizvod: isti shell, jasne sekcije, bez neobjašnjenih ikonica i bez različitih UX pravila po ulozi
- [ ] **Messaging phase 2** — worker/employer match thread unlock (`accepted offer + placement fee paid`), anti-contact leakage filter, employer inbox, admin oversight
- [ ] **Final smoke test** — puni end-to-end test glavnih flow-ova na produkciji (worker, employer, agency, support, payment, admin)

#### Sledeće
- [ ] **Payment recovery automation v2** — source attribution + admin funnel signal za `opened checkout but not paid` sada kada je osnovni abandoned checkout follow-up (`1h / 24h / 72h`) live
- [ ] **Agency operations v2** — filteri, search, `needs action`, `missing contact`, `verified but unpaid`, `paid but waiting`, bulk operacije
- [ ] **n8n Email AI Auto-Responder** — novi workflow: AI odgovara na emailove (`contact@workersunited.eu`)
- [ ] **n8n AI Agent sa tools** — bot dobija mogućnost da radi akcije (provera otvorenih pozicija, ažuriranje statusa, slanje emaila)
- [ ] **n8n email automation** — retry failed emails, auto-responder za inbox

#### Kasnije / uslovno
- [ ] **Per-country placement fee engine** — priprema za više zemalja i različite confirmation/placement cene po destinaciji
- [ ] **Multi-country pricing za placement fee** — **odloženo** dok se ne proširimo na druge zemlje
- [ ] **Renewals / compliance layer** — statusi posle match-a, expiries, renewals, case visibility za vizni proces
- [ ] **Multi-language support** — ključne instrukcije na jezicima radnika
- [ ] **Referral / success stories / growth loops** — tek kad bude dovoljno realnih uspešnih case-eva

### ✅ Završeno (poslednje)
- [x] Agency pending-payment simplification: otvoreni ali neplaćeni Stripe session više se ne prikazuje kao poseban `Checkout open` status ni payment badge u `/profile/agency`; agency sada za takvog workera vidi samo `Not paid yet / Pay $9`, a isti CTA po potrebi tiho nastavlja postojeći otvoreni checkout umesto da vraća blokirajući `already pending` error — 09.03.2026
- [x] Agency worker table rollback pass: `/profile/agency` više ne koristi boxed field kartice po redu, već se worker board vratio na klasičnu tabelu sa jačim vertikalnim i horizontalnim separatorima po kolonama; zadržani su completion progress meter, realan payment state (`Pay $9 / Checkout open / Paid`) i operativni worker status bez novog card-in-card layout-a — 09.03.2026
- [x] Agency completion meter pass: `/profile/agency` `Completion` tile sada više ne prikazuje samo goli procenat, nego i vizuelni progress meter sa bojom/fazom (`In progress` / `Ready`) da agency odmah vidi koliko je worker daleko od 100% — 09.03.2026
- [x] Agency worker payment/status clarity pass: `/profile/agency` sada tretira `pending` samo kao stvarno aktivan Stripe checkout (preko `deadline_at` / svežeg `checkout_started_at`) umesto kao bilo koji stari pokušaj, pa worker ne ostaje lažno zaglavljen; `Pending` je preimenovan u jasniji `Checkout open`, `Status` sada razlikuje `Not paid yet / Checkout open / Paid / Waiting X days`, a worker redovi su prebačeni sa sirovih ćelija na boxed field kartice po polju (`Worker / Added / Completion / Documents / Status / Payment / Action`) radi bolje preglednosti — 09.03.2026
- [x] Agency worker phase/status cleanup: `/profile/agency` sada odvaja `Completion` od `Status` tako da completion ostaje samo procenat profila, dok status prikazuje operativnu fazu workera (`Awaiting payment`, `Payment pending`, `Waiting X days`, `Refund requested`, `Job offered`, `Offer accepted`, `Visa in process`, `Visa approved`, `Placed`) na osnovu realnih `payments` (`profile_id` + `metadata.target_worker_id`), `queue_joined_at` i worker lifecycle signala, pa agency vidi gde je worker u procesu umesto da status duplira completion/documents fallback — 09.03.2026
- [x] Agency table grouping/layout pass: `/profile/agency` worker board sada koristi jasniji desktop raspored kolona sa fiksnim širinama i logičnim blokovima (`Worker / Added / Completion / Documents / Status / Payment / Action`), uz suptilne vizuelne separatore između phase/payment i action zone tako da tabela više ne deluje kao jedan zbijeni niz nasumičnih grupa — 09.03.2026
- [x] Agency worker `Added` timestamp pass: live baza sada ima immutable `public.workers.created_at` sa backfill-om za postojeće redove i osveženim `worker_onboarding / candidates` view-evima, pa `/profile/agency` više ne prikazuje varljivi `Saved` (`updated_at`) datum nego stvarni datum dodavanja workera kroz novu `Added` kolonu — 09.03.2026
- [x] Agency payment card polish: `/profile/agency` više ne prikazuje `Not paid` tekst u `Payment` koloni; neplaćen worker sada ima samo aktivno `Pay $9` dugme, `Pending` ostaje kao amber non-clickable state, a `Paid` je zelena zaključana kartica/badge bez klika kako bi odmah bilo jasno šta je već plaćeno — 09.03.2026
- [x] Agency board payment/status split pass: `$9` CTA je premešten iz `Action` u `Payment` kolonu, dok `Status` sada prikazuje funnel/lifecycle fazu workera (`Draft`, `Profile incomplete`, `Ready to pay`, `Payment pending`, `Paid`, `In queue`, `Offer pending`, `Offer accepted`, `Visa in process`, `Visa approved`, `Placed`, `Refund review`, `Needs update`) umesto tehničkog ownership signala ili mešanja payment CTA-a sa akcijama — 09.03.2026
- [x] Agency worker phase labels pass: `Status` kolona u `/profile/agency` više ne prikazuje ownership copy (`Agency managed / Account ready`), nego stvarnu fazu worker toka (`Draft`, `Profile in progress`, `Documents in progress`, `Ready for payment`, `Payment pending`, `In queue`, `Offer pending`, `Offer accepted`, `Visa in process`, `Visa approved`, `Placed`, `Refund review`, `Needs update`) uz kratko objašnjenje ispod badge-a — 09.03.2026
- [x] Agency workspace table cleanup: `Contact` kolona je uklonjena iz `/profile/agency` worker board-a zajedno sa pratećim copy-jem o email/phone poljima, pa agency lista sada ostaje fokusirana na worker, `Saved`, completion, documents, payment, status i akcije bez suvišnog kontaktnog polja — 09.03.2026
- [x] Workspace header branding pass 2: centrirana non-public logo-ikona u `UnifiedNavbar` je dodatno povećana još jednu stepenicu posle prvog balance passa, tako da je branding jasniji i na mobilnom i na desktop workspace header-u bez vraćanja debelog shell-a — 09.03.2026
- [x] Workspace header branding balance pass: posle slimming passa, dashboard/profile `UnifiedNavbar` je dobio veći left wordmark i veću centriranu logo-ikonu za non-public workspace-e, tako da header ostaje tanak ali brend više nije vizuelno presitan — 09.03.2026
- [x] Workspace header slimming pass: dashboard/profile header više ne koristi stari previsoki `68px` shell i preveliku centriranu logo-ikonu; `UnifiedNavbar` je stanjio non-public header, smanjio dashboard wordmark/logo mere, a `AppShell` je poravnao backdrop/sidebar/main top offsete na novu nižu visinu bez preklapanja — 09.03.2026
- [x] Workspace shell cleanup pass 14: mobile sidebar više nema poseban `X` close red koji je gurao sadržaj nadole; hamburger je sada jedini top control u drawer-u, pa su i prve workspace stavke poravnate više ka vrhu bez praznog gapa — 09.03.2026
- [x] Workspace shell cleanup pass 13: shared `AppShell` više ne prikazuje redundantne non-admin sidebar naslove `Menu` i `Worker / Employer / Agency Workspace`, pa worker/employer/agency navigacija ostaje čista bez suvišnih sekcijskih label-a — 09.03.2026
- [x] Agency payment flow cleanup: agency dashboard i agency worker detail više ne prikazuju `claim link / claim first / awaiting claim` copy, agencija sada može direktno da otvori `$9` entry-fee checkout i za draft worker-e bez linked worker naloga, a Stripe `create-checkout + webhook + confirm-session` pamte uplatu po `worker_onboarding.id` (`target_worker_id`) tako da više worker-a pod istom agencijom zadržava tačan payment target bez mešanja — 09.03.2026
- [x] Workspace radius tightening hotfix: App shell sidebar rail i agency workspace surface kartice više ne koriste jače `rounded-2xl` / custom veći radius, već manji ujednačen shell/card radius; mobile content top padding i agency hero/workers sekcije su dodatno sabijeni da workspace deluje kompaktnije i vizuelno bliže sidebar shell-u — 08.03.2026
- [x] Workspace desktop shell spacing hotfix: desktop sidebar više nije zalepljen za levu ivicu viewport-a nego ima blagi levi gutter, a collapsed desktop rail je sužen da bude bliži mobilnom prikazu umesto starog preširokog stanja — 08.03.2026
- [x] Workspace mobile polish hotfix: App shell na telefonu sada koristi uži collapsed rail, manji content offset i isti `rounded-2xl` shell radius, dok `/profile/agency` hero kartica ima kompaktniji mobile padding, blaži radius i horizontalni stats strip umesto previsokog lomljenja u više redova — 08.03.2026
- [x] Agency workspace hotfix: `/profile/agency` više ne pokušava da čita nepostojeći `worker_onboarding.created_at`, pa lista ponovo prikazuje agency workere umesto lažno praznog stanja; datum kolona je poravnata na stvarni live `updated_at` / `Saved` timestamp dok se ne uvede poseban immutable `created_at` sloj — 08.03.2026
- [x] Agency worker operations pass: `/profile/agency` tabela sada prikazuje `#` i `Saved` timestamp po workeru, svaki claimed a neplaćeni worker ima direktan `$9` Job Finder checkout CTA, draft + claimed worker nalozi mogu da se brišu i pojedinačno i kroz multi-select bulk delete, a bulk payment je namerno zaključan jer trenutni Stripe/webhook model bezbedno podržava samo jedan payment target po checkout-u — 08.03.2026
- [x] Agency workspace edit-flow unification: tabela radnika u `/profile/agency` više nema `Open` koji vodi na poseban worker ekran, već `Edit` otvara isti modal/form kao `Add worker`; modal sada u edit režimu povlači worker detalje preko agency API-ja, koristi `PATCH` save i ostaje unutar istog workspace konteksta, a admin `inspect` ostaje read-only i u tom toku — 08.03.2026
- [x] Workspace shell polish pass 12: agency workspace više nema dupli sidebar ulaz za isti `/profile/agency` ekran; kanonski home entry je sada jedini `Agency Workers` povratak ka listi, dok `Worker Editor` ostaje poseban samo kada se stvarno gleda pojedinačni agency worker — 08.03.2026
- [x] Workspace shell polish pass 11: logout confirm više nije renderovan unutar sidebar stabla nego kroz pravi portal u `document.body`, pa se confirm modal sada otvara centrirano preko celog viewport-a i ne ostaje zalepljen za levu kolonu ni kada workspace shell koristi blur/overflow slojeve — 08.03.2026
- [x] Workspace shell polish pass 10: sidebar unutrašnji layout sada koristi punu visinu pa je `Logout` stvarno zalepljen za dno bez praznog repa ispod, a worker overview surface kartice (`hero`, support, info) više ne koriste agresivniji custom radius nego isti blaži `rounded-2xl` ritam kao workspace shell — 08.03.2026
- [x] Ops monitoring precision pass: `api/health` sada proverava Stripe/SMTP/WhatsApp/n8n paralelno, klasifikuje WhatsApp template failove na platform-side (`template/config/provider`) vs recipient-side (`undeliverable` / country restriction), a `system-smoke` više diže lažno `healthy` stanje kada je opcioni servis stvarno `degraded`; dodati su i test guardovi za smoke evaluator i WhatsApp health klasifikaciju — 08.03.2026
- [x] Brain + ops monitoring hardening: `brain-monitor` sada robustno parsira OpenAI Responses JSON, upisuje stvarni `structured_report` objekat umesto raw output niza, pravilno obeležava email delivery rezultat i razume `retry_email` akcije koje vraćaju `email_ids`; `api/health` i `system-smoke` više ne kriju recent WhatsApp template failove, pa je današnji Brain exception run ručno ponovo pokrenut i uspešno poslat mailom — 08.03.2026
- [x] Workspace shell polish pass 9: uklonjen je suvišni `Signed in as` profil blok iz workspace sidebara, pa leva kolona ostaje čista navigacija bez dupliranja identiteta koji već postoji u header-u — 08.03.2026
- [x] Workspace shell polish pass 8: dashboard header više ne koristi stari levo-zakucani full-logo raspored, već prati isti sistem kao public header sa wordmark-om levo i centriranom logo-ikonicom kroz profile/settings/workspace ekrane — 08.03.2026
- [x] Workspace shell polish pass 7: `/profile/settings` sada koristi isti dashboard shell kao ostatak profila, `Account Settings` sidebar entry ima isti active behavior kao ostale stavke, a logout confirm overlay više nije zarobljen u sidebar-u nego se otvara kao pravi centralni modal na produkciji — 08.03.2026
- [x] Worker workspace shell + overview hotfix: `AppShell` više ne duplira `Overview` i worker profil kao dva aktivna entry-ja za isti `/profile/worker`, aktivni sidebar state je vraćen kroz colored icon/rail tonove, mobile sidebar više ne kreće preko dashboard header-a, a `/profile/worker` je ponovo pravi početni ekran sa `Next action`, document readiness signalima, support unlock stanjem i direktnim `$9 Job Finder` CTA-om umesto da payment postoji samo na `Queue` ruti — 08.03.2026
- [x] Auth signup trigger worker-first hotfix: live auth sync više ne pokušava da kreira worker kroz ugašeni `public.candidates` alias, već normalizuje legacy `candidate` metadata na `worker`, upisuje direktno u `profiles + workers`, i dodatno sinhronizuje `profiles.user_type` + kanonske worker/employer redove kada Google OAuth callback naknadno dopiše role metadata; time su popravljeni email signup i Google OAuth signup posle finalnog worker-first cleanup-a, a `/auth/auth-code-error` sada razlikuje stvarni signup server error od istekle confirmation veze — 08.03.2026
- [x] Worker-domain cleanup pass 16: final contract/storage/public-schema cleanup — dodat je `supabase/migrations/20260308234500_finalize_worker_contract_storage_cleanup.sql`, `contract_data` override kolone su poravnate na `worker_*`, produkcija je redeploy-ovana na worker-first runtime, legacy `candidate-docs` i prazni `documents` bucket su ugašeni, a live public schema više ne izlaže `candidates` / `candidate_documents`; završni runtime/docs sweep uklonio je i poslednje aktivne `candidate` tragove van istorijskih migracija/FK imena — 08.03.2026
- [x] Worker-domain cleanup pass 15: završni app-layer alias cleanup posle stage 3 — `profile-completion` testovi i worker completion helper više ne koriste `candidate` wrapper shape, `admin/edit-data` više nema `candidates -> workers` runtime alias, a generisani live tipovi su osveženi posle SQL stage 3 tako da aktivni `src` runtime više nema `candidate_id` niti `candidateId` tragove van compatibility/storage/contract sloja — 08.03.2026
- [x] Worker FK migration stage 3 applied on live Supabase: legacy `candidate_id` kolone obrisane su iz `documents / matches / offers`, stari sync trigger/check/FK/index sloj je uklonjen, RLS policy-ji na `documents / matches / offers / contract_data` su prebačeni na `worker_id`, a `handle_offer_rejection()` sada radi nad `public.workers` / `offers.worker_id`; `src/lib/database.types.ts` je regenerisan sa live stage-3 šemom i `typecheck/lint/test/build` prolaze — 08.03.2026
- [x] Worker FK migration stage 2 applied on live Supabase + runtime cutover: `documents`, `matches` i `offers` sada imaju live `worker_id` kolone sa backfill/sync triggerima/FK-ovima, a app-layer više ne šalje niti čita aktivne `candidateId` / `candidate_id` ključeve u dokument verify/request-review/manual-match/brain act tokovima; dodat je i finalni stage 3 SQL `20260308223000_drop_legacy_candidate_fk_columns.sql` za brisanje legacy `candidate_id` kolona — 08.03.2026
- [x] Worker FK migration stage 2 prepared: dodat je `supabase/migrations/20260308210000_worker_fk_transition.sql` koji uvodi additive `worker_id` kolone za `documents / matches / offers`, radi backfill iz `candidate_id`, dodaje sync trigger/equality check/FK/indekse i sprema poslednji worker-first FK korak bez rušenja legacy `candidate_id` compatibility sloja; migracija je pripremljena, ali još nije puštena na live Supabase — 08.03.2026
- [x] Worker physical-table migration stage 1 applied on live Supabase: `public.candidates` je fizički renamovan u `public.workers`, `public.candidate_documents` u `public.worker_documents`, a stara imena su vraćena kao compatibility view layer (`public.candidates`, `public.candidate_documents`) uz aktivan `worker_onboarding`; `src/lib/database.types.ts` je regenerisan sa live worker-first šemom, pa je fizički DB sloj sada konačno usklađen sa app domenom — 08.03.2026
- [x] Worker physical-table migration stage prepared: dodat je `supabase/migrations/20260308193000_worker_physical_tables.sql` koji radi fizički rename `public.candidates -> public.workers` i rešava stvarni live hybrid documents state tako što prvo uklanja zavisni `worker_documents` compatibility view, zatim renamuje fizički `candidate_documents` u `worker_documents`, pa vraća `candidates` / `candidate_documents` kao compatibility view layer uz obnovu `worker_onboarding` / `worker_readiness`; SQL je pripremljen u repou i sada je uspešno primenjen na live Supabase — 08.03.2026
- [x] Worker-domain cleanup pass 14: `email-health`, agency worker CRUD + agency document upload, checkout recovery, confirmation-fee finalization, `match-jobs`, `funnel-metrics`, worker offer detail i offer-expiry cron više ne koriste direktne `candidates` / `candidate_documents` query-je, već `worker_onboarding` / `worker_documents` alias view layer; posle ovog passa u `src` više nema aktivnih runtime `candidate_documents` query-ja, a preostali `candidate` trag je sveden na fizičku šemu (`candidate_id`, contract `candidate_*` payload, auto-generated types) — 08.03.2026
- [x] Worker-domain cleanup pass 13: dodat je shared `src/lib/worker-documents.ts`, pa `DocumentWizard`, `verify-document`, admin review/detail, contract generate/download, profile-reminders i user deletion više ne hardkodiraju `candidate-docs` u app-layer kodu; legacy bucket ime ostaje samo kao kompatibilni storage detalj ispod worker-first helpera — 08.03.2026
- [x] Worker-domain cleanup pass 12: `JobsMatchClient`, `ManualMatchButton`, `DocumentWizard`, admin `re-verify` i auto-match response više ne šalju/izlažu `candidateId` kao aktivan app-layer ključ; `manual-match`, `verify-document` i `documents/request-review` server rute sada koriste `workerId` kao kanonski input uz interni `legacyCandidateId` fallback, a `payment-eligibility` alias je jasno označen kao privremena kompatibilnost — 08.03.2026
- [x] Worker-domain cleanup pass 11: runtime query layer u `src` sada koristi `worker_onboarding` i `worker_documents` alias view-e umesto direktnih `candidates` / `candidate_documents` query-ja; `brain/collect`, `admin-exceptions` i `contracts/prepare` su poravnati na nullable view tipove, pa `typecheck`, `lint`, `test` i `build` prolaze bez dodatnog Supabase SQL koraka. Fizička kompatibilnost ostaje samo ispod haube (`candidates`, `candidate-docs`, legacy `candidateId`) — 08.03.2026
- [x] Worker-domain cleanup pass 10: `src/lib/contract-data.ts` više nema aktivne `candidate` / `candidateProfile` alias-e u `ContractBuildResult`, dok `src/app/api/brain/act/route.ts` sada prihvata `update_worker_status` kao kanonski naziv uz legacy `update_candidate_status` fallback; time su preostali `candidate` tragovi praktično svedeni na fizičke `candidates` / `candidate-docs` resurse i dva namerna compatibility fallback-a (`account/export`, `profile-completion`) — 08.03.2026
- [x] Worker-domain cleanup pass 9: `auth/callback`, `offers`, `stripe/confirm-session`, `stripe/webhook`, `cron/profile-reminders`, `cron/match-jobs`, `queue/auto-match`, `queue-user-email`, `cron/check-expiring-docs`, worker offer detalj i ceo WhatsApp runtime sada koriste `worker` / `workerRecord` kao kanonski lokalni app-layer naziv umesto `candidate`; preostali `candidate` tragovi svedeni su uglavnom na fizičku `candidates` tabelu, `candidate-docs` bucket i par namernih compatibility aliasa (`account/export`, `profile-completion`, `contract-data`) — 08.03.2026
- [x] Worker-domain cleanup pass 8: `src/app/profile/worker/page.tsx`, `DashboardClient.tsx` i `queue/page.tsx` sada koriste `workerRecord` / `worker` kao kanonski lokalni naziv umesto `candidate`, dok `src/components/DocumentWizard.tsx` i `src/app/profile/agency/workers/[id]/AgencyWorkerClient.tsx` šalju `workerId` kao primarni ključ ka `/api/verify-document` i `/api/documents/request-review` uz legacy `candidateId` fallback — 08.03.2026
- [x] Worker-domain cleanup pass 7: `src/app/api/verify-document`, `src/app/api/documents/request-review` i `src/app/api/admin/manual-match` sada prihvataju `workerId` kao kanonski request ključ uz legacy `candidateId` fallback; `src/app/api/admin/re-verify`, `src/components/admin/ManualMatchButton.tsx` i `src/app/admin/jobs/JobsMatchClient.tsx` šalju oba ključa tokom tranzicije, pa document/manual-match tokovi više ne zavise isključivo od `candidateId` API jezika — 08.03.2026
- [x] Worker-domain cleanup pass 6: `src/app/admin/workers/[id]/page.tsx` više nema privremene `candidateProfile` / `candidateData` alias-e, worker edit (`/profile/worker/edit`) i worker documents upload flow sada koriste `workerRecord` / `workerProfileId` kao kanonske app-layer nazive, a `contracts/prepare|download-all`, `check-expiry`, `manual-match` internali i Stripe checkout auto-create helper više ne koriste `candidate` za lokalni worker domain jezik; preostali `candidate` tragovi ostaju samo kao fizički DB/storage/API compatibility sloj i `contract-data` legacy alias — 08.03.2026
- [x] Worker-domain cleanup pass 5: `src/app/api/brain/improve/route.ts` sada koristi `workerRows` / `workerResult` u sistemskom snapshot-u, `src/app/admin/refunds/page.tsx` refund flow tretira `candidates` kao worker records umesto kao app-layer `candidate` entitete, `src/app/admin/jobs/JobsMatchClient.tsx` Smart Match radi nad `worker` lokalnim zapisima, a `/api/admin/document-status` koristi `workerRecordIds` / `workerRecordMap` kada sklapa admin status pregled dokumenata — 08.03.2026
- [x] Worker-domain cleanup pass 4: `src/app/api/brain/collect/route.ts` sada koristi `workerRows`, `workerRecordProfileIds`, `workerDocs` i `workerPayments` kao kanonske lokalne app-layer nazive umesto `candidates*`; `src/app/api/admin/edit-data/route.ts` contract-derived worker polja sada uređuje preko `contractBuild.worker` / `workerProfile`, a `src/lib/messaging.ts` i `src/lib/user-management.ts` više ne tretiraju kanonski worker zapis kao `candidate` u support gating-u i cascade delete helperu — 08.03.2026
- [x] Worker-domain cleanup pass 3: `/api/admin/search`, `/admin/queue` i `/admin/jobs` sada kanonski deduplikuju legacy `candidates` redove po `profile_id` pre prikaza admin rezultata, queue watch-a i Smart Match worker liste, pa duplikati više ne naduvavaju search/queue/jobs UI; `src/lib/contract-data.ts` je prebačen na `worker` / `workerProfile` build rezultat uz backward-compatible `candidate` alias za postojeće contract rute — 08.03.2026
- [x] Admin exception dashboard: dodat je shared `src/lib/admin-exceptions.ts` snapshot helper i novi `/admin/exceptions` ekran koji u jednom mestu prikazuje invalid/bounced email profile-e, otvorene a neplaćene checkout-e, stale pending payment drift, manual-review dokumente, `verified but unpaid`, `paid but not in queue` i otvorene job request-e bez ponuda; admin sidebar/dashboard sada imaju direktan `Exceptions` ulaz sa live signal count-om — 08.03.2026
- [x] Abandoned checkout recovery automation: dodat je hourly `/api/cron/checkout-recovery` koji prati stvarno otvorene `$9` checkout-e preko `user_activity + payments`, preskače interne/test/typo email profile, šalje `checkout_recovery` follow-up u `1h / 24h / 72h` kroz email + postojeći WhatsApp `status_update` template, i posle trećeg koraka markira stale pending entry-fee redove kao `abandoned`; `create-checkout` sada upisuje `checkout_started_at` + `deadline_at`, pa recovery i Brain/reporting više ne zavise od nagađanja oko starosti pending checkout-a — 08.03.2026
- [x] Worker-domain cleanup pass 2: `src/lib/profile-completion.ts` sada koristi `worker` kao kanonski input uz backward-compatible `candidate` fallback; `account/export` vraća `worker` payload (plus legacy `candidate` alias) preko kanonskog worker lookup-a, a admin workers registry/detail i funnel metrics više ne zavise od raw `.single()`/jednog `candidate` reda po `profile_id`, nego deduplikuju i koriste kanonski worker zapis — 07.03.2026
- [x] Admin Email Health center: dodat je `/admin/email-health` sa pregledom typo domena, poznatih nevalidnih internih adresa i recent undeliverable email send-ova, uz direktan `Open workspace` inspect, `safe to delete` guard preko postojećeg `delete-user` toka i novi sidebar/dashboard signal; `src/lib/reporting.ts` sada centralizuje typo correction suggestion, invalid-only suffix heuristics i undeliverable error detection — 08.03.2026
- [x] Reliability hotfix pass: uveden je kanonski worker lookup sloj u `src/lib/workers.ts` (`pickCanonicalWorkerRecord`, `loadCanonicalWorkerRecord`) pa worker/profile/queue/edit, Stripe payment flow, support gating i WhatsApp webhook više ne pucaju kada jedan `profile_id` ima više redova u `candidates`; `DocumentWizard` i agency document upload sada sanitizuju storage file name pa uploadovi tipa `IMG_...~2.jpg` više ne padaju sa `Invalid key`, `whatsapp.ts` upisuje pravi `error_message` za failed template/text send, a `whatsapp-nudge` deduplikuje workere po profilu/telefonu i broji `nudged` samo kada Meta send stvarno uspe. Na live-u su očišćeni jedini potvrđeni dupli worker cluster i još 3 očigledna typo-domain worker naloga bez uplata/dokumenata — 07.03.2026
- [x] WhatsApp v2 router + Brain report v2: `/api/whatsapp/webhook` sada koristi GPT-5 mini router (`job_intent / price / documents / support / status / off_topic`) i kraći recent-context response sloj umesto starog giant-prompt `gpt-4o-mini` toka; `[LEARN: ...]` upisi su zaključani samo za admin poruke. `/api/cron/brain-monitor` prebačen je na `BRAIN_DAILY_MODEL` (`gpt-5-mini` default), svaki dnevni run se i dalje snima u `brain_reports`, ali email sada ide samo za stvarne exception slučajeve (`critical`, issue, low health, retry-email), dok je `/api/brain/report` default model poravnat na isti daily model — 07.03.2026
- [x] Preview/admin simplification + homepage neutral pass: `AppShell` admin preview više ne prikazuje dodatni `Role Previews` blok unutar role workspace-a, worker preview sada otvara `Documents / Queue / Support / Edit Profile`, a `/profile/agency` generic admin preview više nije localStorage sandbox sa lažnim draftovima nego isti stvarni layout + modal bez persistencije; employer preview prikazuje realne company/job forme umesto pomoćnih preview kartica, a landing page je prebačen sa toplih beige/green/blue površina na neutralni white/gray/black sistem sa suptilnim slojevitim dokument karticama — 07.03.2026
- [x] Invalid-email worker cleanup: obrisan je lažni live worker/auth/profiles zapis `suleka31@yahoo.coms` zajedno sa candidate i `email_queue` istorijom; potvrđeno je da je `email_confirmed_at` bio ručno/legacy postavljen, `profile-reminders` sada preskače i poznate typo domene (`yahoo.coms`, `gmai.com`, `1yahoo.com`, itd.), a legacy ručni notify script više ne sadrži tu adresu — 07.03.2026
- [x] Fake internal worker cleanup: obrisan je lažni live worker/auth/profiles zapis `borivoje@workersunited.org` zajedno sa candidate i `email_queue` istorijom; `profile-reminders` sada preskače interne/test email adrese preko shared filtera, a legacy ručni notify script više ne sadrži tu `.org` adresu — 07.03.2026
- [x] Workspace cleanup pass 5: agency i employer prazna stanja više ne dupliraju glavne akcije u sredini ekrana; `Add worker` ostaje samo u agency header-u, `New Job Request` samo u employer sidebar-u, a empty-state poruke sada jasno upućuju na ta kanonska mesta — 07.03.2026
- [x] Workspace cleanup pass 4: worker overview više ne duplira `Documents / Queue / Support` kartice u sredini ekrana; ti tokovi su sada samo sidebar entry point-i, pa overview ostaje čist i fokusiran na profil podatke — 07.03.2026
- [x] Workspace cleanup pass 3: `AppShell` desktop canvas je stabilizovan pa collapse sidebar-a više ne povlači ceo ekran ulevo; `San Marino` uklonjen je iz globalnih country lista; worker i employer workspace-i su svedeni na jednu glavnu kolonu bez redundantnih levih helper panela, uz neutralniji white/gray/black hero stil i employer edit akciju direktno u `Company Information` kartici — 07.03.2026
- [x] Agency workspace simplification pass 2: `/profile/agency` više nije grid sa promo karticom nego čist `Workers` table view sa header `Add worker` akcijom; modal i dashboard su prebačeni na neutralan white/gray/black stil, overlay je ublažen, a layout proširen da dashboard više ne deluje gurnuto ulevo — 07.03.2026
- [x] Agency add-worker modal + admin sandbox inspect: `/profile/agency` više nema mali intake panel nego jedan `Workers` board sa velikom `Add worker` karticom; popup ostaje iznad dashboard-a, `X` uvek pita `save/discard`, a admin generic preview dobija lokalne sandbox draftove dok `?inspect=<profile_id>` otvara isti agency flow bez role drift-a — 07.03.2026
- [x] Admin revenue + analytics metrics cleanup: `reporting.ts` uvodi filter za Codex/test/internal-orphan payment profile-e, pa `/admin` i `funnel-metrics` više ne sabiraju sintetičke uplate u stvaran prihod — 07.03.2026
- [x] Workspace simplification pass: `AppShell` sada koristi kraće zajedničke role nazive (`Overview`, `Queue`, `Support`, `New Job Request`) i bez duplih shortcut-a; worker landing je poravnat na `Profile / Documents / Queue`, agency dashboard na jasan `Add worker` intake + sažet checklist, employer workspace na `Next action + Hiring status`, a `/admin` preview copy dodatno očišćen — 07.03.2026
- [x] Admin simplification follow-up: `/admin` više ne zavisi od adminovih sopstvenih legacy worker/employer/agency redova za preview kartice; sidebar sada jasno nudi `Dashboard` + direktne `Preview Worker / Employer / Agency` ulaze, pa admin može odmah da vidi kako role izgledaju bez role drift konfuzije — 07.03.2026
- [x] Admin/workspace consistency pass 5: `/admin/workers/[id]` prepakovan u jedinstven admin ops-card sistem (profile snapshot, approval/status, payments, contract payload, signature, documents), a pomoćne admin kartice za doc preview, manual match, download i re-verify vizuelno poravnate sa ostatkom admin shell-a — 07.03.2026
- [x] Admin/workspace consistency pass 4: `/admin/workers/[id]` više ne ulazi direktno u stari long-form case view, već otvara admin hero + inspect prečice za worker/documents/queue; `/admin/queue` i `/admin/jobs` su poravnati na isti admin ops hero/guidance/layout sistem kao ostatak admina — 07.03.2026
- [x] Admin/workspace consistency pass 3: admin sidebar više ne nudi zbunjujuće role preview linkove, uveden je zajednički `AdminSectionHero` za workers/employers/agencies registry stranice, a worker admin tabela sada jasno odvaja `Inspect workspace` od `Open case`; employer i agency admin liste dele isti operativni layout, metrike i inspect jezik — 07.03.2026
- [x] Profile workspace consistency pass 2: worker overview više ne deluje kao poseban proizvod, već koristi isti hero/metrics/left-rail ritam kao employer workspace; dodat je jasniji `Next action` blok, dokument summary, i usklađen `Queue & Status / Support` language. Agency dashboard sada eksplicitnije vodi iz intake forme u puni worker workspace (`Create Draft and Open Worker Workspace`, `Open worker workspace`) i prazno stanje objašnjava šta se dešava posle draft-a — 07.03.2026
- [x] Admin inspect workspace pass: admin više ne mora da se oslanja samo na apstraktni `/profile/*` UI preview. Worker, employer i agency workspace sada podržavaju read-only `?inspect=<profile_id>` otvaranje nad stvarnim account podacima bez mutacije admin naloga; worker inspect pokriva overview + documents + queue, employer inspect otvara kanonski tabbed workspace nad ciljanim employer zapisom, agency inspect pokriva dashboard + worker editor, dodata je i `/admin/agencies` lista, a admin workers/employers/dashboard sada imaju direktne `Open Workspace` ulaze — 07.03.2026
- [x] AGENTS cleanup + roadmap regrouping: aktivni plan rada više nije razbacan kroz `TODO`, `Launch Status` i dva odvojena `Suggestions` bloka; uveden je fazni redosled `admin/ops -> profile consistency -> agency -> messaging -> funnel/payments -> AI`, dok su istorijski launch snapshot i niche predlozi zadržani odvojeno od glavnog plana — 07.03.2026
- [x] Unified profile workspace pass: worker je prebačen na zajednički `AppShell` sa role-specific navigacijom, employer workspace je spojen u jedan kanonski ekran sa tabovima (`company/post-job/jobs`) i legacy `/profile/employer/jobs*` rute sada samo redirectuju na isti ekran; agency dashboard sada eksplicitno pokazuje tok `draft -> full worker profile -> docs/payment`, a admin preview shell više ne prikazuje zbunjujuće nalog-linkove van preview konteksta — 07.03.2026
- [x] Profile workspace alignment + admin preview clarity: employer profil sada koristi isti `AppShell` kao agency/admin pa preview više ima jasan povratak u `/admin`; employer hero/side rail/info kartice su poravnate sa neutralnim workspace stilom, agency preview prikazuje zaključan isti `Add Worker Draft` intake obrazac kao realan agency flow, a worker profil sada jasno označava `Support Inbox` u sidebaru i objašnjava otključavanje support-a posle `$9` uplate — 07.03.2026
- [x] Messaging v1 foundation + support inbox: u repo dodat `20260306234500_messaging_foundation.sql`, live `src/lib/database.types.ts` regenerisan sa `conversations*` tabelama, worker support inbox uveden na `/profile/worker/inbox` i otključava se tek posle uspešne `$9` uplate, dok admin sada ima `/admin/inbox` + dashboard/sidebar entry point za odgovaranje na support thread-ove bez izlaska iz platforme — 06.03.2026
- [x] Admin role repair + safe role previews: admin preview worker/employer/agency više ne menja `profiles.user_type`, accidental admin-owned agency redovi su uklonjeni, owner worker zapis je vraćen iz lažnog `OFFER_PENDING` u `IN_QUEUE`, a admin dashboard dobio je `Admin Role Safety` + `Workspace Previews` blokove za jasan ulaz u read-only role view-e — 06.03.2026
- [x] Agency full worker-profile parity + admin operations cleanup: `/profile/agency/workers/[id]` više nije skraćeni draft editor, već pokriva praktično ceo worker profil shape (`identity/contact/citizenship/preferences/family/passport`), pri čemu su `phone` i draft `email` opciona contact polja za notifikacije; agency completion helper više ne tretira telefon kao obavezan u agency kontekstu. Admin preview navigation je poravnata tako da `Dashboard` i brand/logo povratak iz preview režima uvek vode na `/admin`, a admin landing je zamenjen jednostavnijim operativnim panelom sa jasnim stats/action/pipeline/queue listama — 06.03.2026
- [x] Live agency/worker E2E validation + payment drift hardening: kreirani dedicated test nalozi (`worker/employer/agency/admin` + claimed agency worker), generisana sintetička passport/diploma/biometric dokumenta, potvrđeni production flow-ovi `agency PATCH -> upload -> verify` i `worker -> verify` sa 3/3 verified i auto statusom `VERIFIED`; admin dashboard / worker detail / funnel metrics prebačeni sa nepostojećeg `payments.created_at` na `paid_at`, a `create-checkout` session ID upis sada ide preko admin klijenta da pending payment ne ostane bez `stripe_checkout_session_id` — 06.03.2026
- [x] Document AI switch to GPT-primary: uveden `src/lib/document-ai.ts`, live document verification rute (`/api/verify-document`, `/api/documents/verify`, `/api/documents/verify-passport`) više ne zavise od `gemini.ts`, već koriste OpenAI GPT-4o-mini kao primarni vision provider uz Gemini fallback chain za outage/rate-limit scenarije — 06.03.2026
- [x] WhatsApp first-contact copy simplification: AI prompt i fallback bot više ne otvaraju razgovor sa `$9` uplatom ili listom dokumenata; za generična pitanja sada vode korisnika na `signup -> profile -> Job Finder`, a cenu spominju samo na direktan upit, uz kratak odgovor `Job Finder = $9` + `90-day refund` — 06.03.2026
- [x] Staged typed admin client rollout: `src/lib/supabase/admin.ts` sada pored legacy `createAdminClient()` ima i `createTypedAdminClient()` sa live `Database` generikom; `brain/collect`, `brain/improve`, `cron/system-smoke` i `activityLoggerServer` su prebačeni na typed helper, a nullable telemetry timestamp-i i `user_activity.details` su poravnati tako da schema drift puca ranije bez rušenja ostatka app layer-a — 06.03.2026
- [x] TypeScript gate restoration: uklonjen `next.config.ts` bypass (`ignoreBuildErrors`), dodat `npm run typecheck`, `tsconfig.json` više ne uvlači `scripts/` u app typecheck, a source type mismatch-evi u `brain/collect`, `profile-completion`, `offer-finalization`, agency helperima i signup/employer/admin chart UI-u su poravnati tako da `typecheck`, `lint`, `test` i `build` prolaze bez TS blockera — 06.03.2026
- [x] Agency phase 3 live operations: produkcioni Supabase sada ima `agencies` + worker ownership kolone, deployovan je agency documents/payment tok (`/api/agency/workers/[workerId]/documents`, agency-safe `/api/verify-document`, `/api/documents/request-review`, Stripe target-worker checkout), a `/profile/agency/workers/[id]` sada iz jedne stranice radi upload, re-upload, manual review i `$9` aktivaciju za claimed workere — 06.03.2026
- [x] Agency claim flow + setup guard: agency-submitted draft worker sada može da se claim-uje kroz worker signup/auth callback bez dupliranja profila; dodati su claim helper/API, claim link UX u agency dashboardu, i graceful fallback kada live Supabase još nema `agencies` tabelu/ownership kolone — 06.03.2026
- [x] Agency phase 2 foundation: uvedeni `agency` signup/select-role/auth redirect tokovi, `src/lib/agencies.ts`, dashboard `/profile/agency`, worker detail/editor `/profile/agency/workers/[id]`, i server-side ownership API rute `/api/agency/workers`; agency draft workeri koriste legacy `candidates` tabelu uz nova attribution polja (`agency_id`, `submitted_by_profile_id`, `submitted_full_name`, `submitted_email`) i read-only readiness/payment signale. Potvrđeno lokalno (`lint/test/build` green), ali live Supabase još nema `agencies` + ownership kolone, tako da je SQL migracija OBAVEZNA pre deploy-a agency feature-a — 06.03.2026
- [x] Worker-domain foundation + agency DB scaffold: uvedeni `src/lib/domain.ts` + `src/lib/workers.ts` kao kanonski sloj za `worker` terminologiju nad legacy `candidates` tabelom; auth callback, role select, godmode, admin backfill i offer notification helperi više ne koriste aktivan `candidate` naming, a dodat je i additive scaffold `20260306180000_agency_foundation_scaffold.sql` (`agencies` + `candidates.source_type/agency_id/submitted_by_profile_id/claimed_by_worker_at`) bez live cutover-a — 06.03.2026
- [x] Contract docs schema-drift fix: `/api/contracts/prepare|generate|generate-all|preview` i admin worker PDF panel više ne čitaju nepostojeće `contract_data` core kolone, već sklapaju contract payload iz live `matches/candidates/profiles/employers/job_requests/candidate_documents`; `contract_data` je sveden na postojeće override/meta vrednosti, a `/api/admin/edit-data` mapira contract-derived polja na prave source tabele umesto na mrtve kolone — 06.03.2026
- [x] Live schema/runtime hardening pass: zatvoreni su `/api/admin/trigger-document-fix-emails` i `/api/track`, `/api/offers` + Stripe confirmation tok poravnati su sa realnim `offers` kolonama i statusima (`OFFER_PENDING` pre uplate, `OFFER_ACCEPTED` posle potvrde), Smart Match više ne koristi ambiguous `profiles` embed, a `brain/improve`, `system-smoke` i `whatsapp-nudge` sada loguju u `user_activity`; read-only live Supabase probe + lint/test/build prošli — 06.03.2026
- [x] Brain report data-truth fix: `src/app/api/brain/collect/route.ts` usklađen sa realnom Supabase šemom (`candidates/payments/email_queue/job_requests/matches/offers`), uveden loud-fail za query greške umesto tihog null input-a, a payment telemetry sada kombinuje `payments` + `user_activity`; potvrđeno da je lažni P0 “125 missing worker onboarding records” nestao (`workersWithoutWorkerOnboarding = 0`) — 06.03.2026
- [x] Email header vertical-centering correction: wordmark zona u gornjem delu kartice vraćena na simetričan padding (`20px` gore/dole) da `WORKERS UNITED` ostane vizuelno centriran u header bloku nakon top-offset izmene — 06.03.2026
- [x] Email card top offset fix (Gmail-safe): uklonjen oslonac na `margin-top` wrappera i dodat eksplicitan gornji spacer (`28px`) pre glavne bele kartice u `wrapModernTemplate`, tako da ceo email panel više ne “udara” u vrh sive pozadine u Gmail prikazu — 06.03.2026
- [x] Email header spacing tweak po feedback-u: u `wrapModernTemplate` povećan gornji razmak zaglavlja (`padding-top 24px`, bottom 16px) da wordmark više ne deluje zalepljeno uz gornju ivicu kartice u Gmail prikazu — 06.03.2026
- [x] Email header brand asset alignment: umesto generičkog text rendera, `wrapModernTemplate` sada koristi fabrički wordmark asset (`public/logo-wordmark-email.png`) izvučen iz `public/new logo/text-.png` (trim + resize), pa email header zadržava originalnu tipografiju (`WORKERS` bold / `UNITED` regular) u malom prostoru — 06.03.2026
- [x] Email brand-header typography correction: text-only header zadržan bez slike, ali vraćen na brend stil (`WORKERS` bold + `UNITED` regular) u kompaktnom prostoru, umesto generičkog jednoličnog natpisa — 06.03.2026
- [x] Payment-success email badge centering fix: `$9 Payment Received` segment u Gmail-u prebačen sa `flex` na table-based centering (`align="center"` + inline icon/text ćelije) da vizuelno bude centriran kao u admin preview-u — 06.03.2026
- [x] Email header simplification po feedback-u: uklonjen klikabilni logo image blok iz svih email template-ova (`wrapModernTemplate`), uveden mali text-only brand header `Workers United` sa minimalnim vertikalnim prostorom da Gmail više ne prikazuje image download affordance u zaglavlju — 06.03.2026
- [x] Worker application-status UX fix: “You have an offer” sada se prikazuje SAMO kada stvarno postoji aktivna pending ponuda u `offers`; za plaćene korisnike bez realne ponude uveden jasan `Payment Accepted` state sa 90-day guarantee copy + countdown/progress bar + refund-eligibility datum (DD/MM/YYYY) — 06.03.2026
- [x] Stripe payment recovery + UX sync hardening: dodat `/api/stripe/confirm-session` fallback za success redirect, webhook/schema usklađivanje za `payments` tabelu (bez nepostojećih kolona), anti-duplicate checkout guard, i worker/queue UI sada koristi i `payments` signal da sakrije `Pay $9` čim je uplata potvrđena — 06.03.2026
- [x] Hero desktop card layering tweak: zelena `Employer_Request.doc` kartica spuštena (`top-[120px]`) i podignuta iznad plave (`z-20`) da blago preklopi `Operational handover` i otkrije više teksta na braon kartici — 06.03.2026
- [x] Social preview update: globalni Open Graph/Twitter preview prebačen na standardni logo (`/logo-centered.png`) sa cache-bust query (`?v=20260306`) radi osvežavanja LinkedIn thumbnail-a — 06.03.2026
- [x] Reliability fix pass: `admin/email-preview` prebačen na reactive template loading (nema stale preview state), a `worker/edit ProfileClient` dobio timezone-safe date parsing (`YYYY-MM-DD`) + stabilan `fetchProfile` lifecycle (`useCallback`/`useEffect`) — 06.03.2026
- [x] Cloud connection hardening: `scripts/cloud-doctor.ps1` stabilizovan (Vercel auth false-fail fix), dodate optional n8n + `/api/health` provere i `npm run cloud:doctor` za one-command dijagnostiku — 06.03.2026
- [x] Footer mobile social icon sizing correction: vraćena stara veličina ikonica (`w/h-8`), uz zbijeni razmak (`gap-1.5`) i `flex-nowrap` da sve mreže ostanu u jednom redu na telefonu — 05.03.2026
- [x] Public navbar branding correction: levi `Workers United` vraćen sa plain teksta na originalni wordmark asset (`logo-wordmark.png`) po vizuelnom zahtevu — 05.03.2026
- [x] Footer mobile social layout fix: uklonjen wrap i smanjen mobilni gap/ikonice (`gap-2`, `w/h-6`) da svih 7 mreža stane u jedan red na telefonu — 05.03.2026
- [x] Hero spacing follow-up: uvodni pasus (`Workers United connects workers...`) spušten još malo naniže (`mt-9`, `md:mt-8`) radi jasnijeg razmaka od plave kartice — 05.03.2026
- [x] Public navbar branding alignment fix: vraćena veća veličina ruku (centrirana ikona), a raspored `Workers United` levo + centrirane ruke primenjen i na mobilni prikaz — 05.03.2026
- [x] Hero + public navbar micro-refine: uvodni pasus dodatno spušten (`mt-8`, `md:mt-7`) radi razmaka od plave kartice; public header na desktopu preuređen tako da je `Workers United` skroz levo, a centralno je logo-ikona — 05.03.2026
- [x] Homepage hero cleanup: uklonjen `Document-first workflow` bedž iz vrha hero sekcije (desktop + mobile) radi čistijeg uvoda — 05.03.2026
- [x] Mobile hero cleanup: uklonjeni `Verified process / Fast onboarding / 90-day guarantee` badge-ovi sa telefonskog prikaza po UX feedback-u (ostaju samo na desktopu) — 05.03.2026
- [x] Mobile hero spacing micro-adjustment: uvodni pasus (`Workers United connects workers...`) blago spušten (`mt-6`, desktop ostaje `md:mt-5`) radi boljeg razmaka od plave kartice — 05.03.2026
- [x] Mobile hero overlap micro-fix: plava `Operational handover` kartica spuštena blago niže (`bottom-2` → `-bottom-3`) da ostane vidljiviji tekst na zelenoj kartici — 05.03.2026
- [x] Mobile hero card sizing correction: `Operational handover` kartica vraćena na staru (veću) tipografiju i spacing (`p-5`, `text-xl`, `text-sm`) po vizuelnom feedback-u — 05.03.2026
- [x] Mobile hero reorder per feedback: stack kartice su premeštene odmah ispod H1 (na mesto gde su ranije bili badge-ovi), a mobilni badge-ovi su spušteni ispod CTA dugmadi radi boljeg isticanja kartica — 05.03.2026
- [x] Hero copy-order refinement po feedback-u: jedinstveni badge blok (`Verified process / Fast onboarding / 90-day guarantee`) premešten između glavnog H1 naslova i uvodnog opisa; uklonjeni prethodni duplikati (desktop+mobile) — 05.03.2026
- [x] Mobile hero visual emphasis tweak: kartice su podignute u toku skrolovanja tako što su mobilni hero badge-ovi premešteni ispod stack kartica; desktop badge raspored ostaje nepromenjen — 05.03.2026
- [x] Mobile hero badges layout finalization: na telefonu su badge-ovi složeni jedan ispod drugog redom `Verified process` → `Fast onboarding` → `90-day guarantee` (desktop raspored ostaje horizontalan) — 05.03.2026
- [x] Mobile hero badge ordering fix: u hero “chips” grupi dodat mobilni line-break tako da `90-day guarantee` ide ispod `Fast onboarding` (desktop raspored ostaje netaknut) — 05.03.2026
- [x] Homepage/footer spacing polish: uklonjen višak praznog “plavkastog” prostora ispod `Start your profile in minutes` uklanjanjem `mt-20` margine sa `Footer` komponente — 05.03.2026
- [x] Homepage simplification po feedback-u: kompletna sekcija `What we actually do` uklonjena sa landing stranice radi čistijeg, kraćeg toka sadržaja — 05.03.2026
- [x] Homepage flow-copy tweak: korak #1 u “How the flow works” promenjen u `Create your account and activate Job Finder.` radi jasnijeg funnel CTA jezika — 05.03.2026
- [x] Homepage terminology micro-polish: `Job Finder Access` preimenovan u prirodniji `Job Finder` u pricing sekciji (bez promene flow-a/cena) — 05.03.2026
- [x] Homepage pricing clarity + CTA contrast fix: uklonjen `Placement fee / After match` iz public pricing bloka, uveden `Job Finder Access $9` + jasan `100% refund if no match in 90 days`; završni CTA dugmići worker/employer usklađeni i čitljivi — 05.03.2026
- [x] Cookie icon size tweak po feedback-u: ikonica u `CookieConsent` povećana 2x (`28px` → `56px`) bez promene ostatka banner layout-a — 05.03.2026
- [x] Cookie icon correction po preciznom linku: zamenjena pogrešna ikonica i postavljena tačna Icons8 varijanta sa `https://icons8.com/icon/97693/cookie` (asset `public/cookie-icons8.png`) — 05.03.2026
- [x] Hero CTA kontrast fix + cookie icon update: `Get started` ima hard white label/arrow za čitljivost na tamnom dugmetu; `CookieConsent` koristi Icons8 cookie PNG (`public/cookie-icons8.png`) umesto emoji ikone — 05.03.2026
- [x] Public navbar icon-only scale tweak po feedback-u: uvećana samo ikonica ruku (2x) u levom delu headera; visina headera, centriran wordmark i desni CTA ostali neizmenjeni — 05.03.2026
- [x] Public navbar desktop refine po feedback-u: centriran desktop wordmark, header stanjен na `h-[52px] md:h-[56px]`, i uveden blagi “glass on scroll” efekat (transparentnije na vrhu, zamućenije pri skrolu) — 05.03.2026
- [x] Public navbar final UX polish po vlasničkom feedback-u: logo uvećan (~2x), full-width raspored (logo skroz levo / akcije skroz desno), uklonjena public border/shadow linija, logged-in redosled `ime/prezime -> Profile`, guest akcije vraćene na `Log in + Sign up` — 05.03.2026
- [x] Public header simplification + logo visibility fix: `UnifiedNavbar` koristi `logo-icon` + `logo-wordmark`, povećana visina na `h-[68px]`, uklonjeni `How it works / For Workers / For Employers` linkovi i mobile hamburger meni radi čistijeg landing iskustva — 05.03.2026
- [x] Navbar logo clipping fix: u `UnifiedNavbar` vraćen split prikaz (ikonica levo + wordmark desno) umesto full kvadratnog logotipa, da logo stane pravilno u visinu header-a bez sečenja — 05.03.2026
- [x] Homepage redizajn po novom smeru: uveden Notion-style “document stack” UX sa multi-color akcentima (bez plave dominacije), nove sekcije i copy struktura (`hero stack`, `what we do`, `how it works` checklist, worker/employer docs, pricing note, final CTA) — 05.03.2026
- [x] Global logo consistency cleanup: uklonjene preostale stare logo reference iz UI (`UnifiedNavbar`, `auth-code-error`, `auth/select-role`, `profile/settings`, `profile/worker/offers/[id]`, `profile/employer/jobs/new`) i prebačeno na `logo-complete-transparent.png` bez “balon” prikaza; usklađeni i email header + offline/PWA logo asseti (`manifest.json`, `offline.html`, `sw.js`) — 05.03.2026
- [x] Login/signup vizuelno usklađeni: `/login` prebačen na isti one-panel auth card sistem kao `/signup` (isti logo/header, neutral input/button stil, Google + email divider, reset-password state i loading skeleton) — 05.03.2026
- [x] Signup layout simplification po vlasničkom zahtevu: uklonjen levi explainer panel na `/signup`, ostavljen samo centriran form card sa `Sign in` linkom, i loading skeleton prebačen na isti one-panel raspored — 05.03.2026
- [x] Signup final visual polish po feedback-u: uvećan logo na desnom panelu, levo/desno koristi transparentni full logo (`logo-complete-transparent.png`), uklonjeni preostali plavi tonovi (neutral Notion paleta) i usklađen `loading` skeleton — 05.03.2026
- [x] Signup logo placement finalization po feedback-u: u gornjim brand blokovima koristi se ceo transparentni full logo (`logo-complete-transparent.png`) umesto razdvojenog icon+wordmark prikaza — 05.03.2026
- [x] Signup visual cleanup po feedback-u: uklonjen “balon” oko brand header-a na `/signup` (form header + email-success state), ostavljen čist prikaz celog logotipa (icon + wordmark) — 05.03.2026
- [x] Global logo migration na sajtu — uklonjene sve `logo.png` reference iz `src/` + PWA/offline asseta (`public/manifest.json`, `public/offline.html`, `public/sw.js`) i prebačeno na novi `logo-icon.png` + `logo-wordmark.png` — 05.03.2026
- [x] Desktop+mobile signup redesign (`/signup`) u Apple/Notion stilu + Gmail-safe skeleton + dodatni funnel telemetry eventi (`signup_submit_attempt`, `signup_success`, `signup_validation_failed`, Google signup eventi) — 05.03.2026
- [x] Supabase non-breaking terminology bridge: dodata migracija `20260305143000_worker_alias_views.sql` (`worker_onboarding`, `worker_documents`, `worker_readiness` view aliasi) bez rename postojećih tabela — 05.03.2026
- [x] Terminology alignment: user-facing `candidate` → `worker` (checkout/queue/admin/employer copy + API poruke + Brain prompt/input normalization) — 05.03.2026
- [x] Onboarding resilience + telemetry alignment — checkout auto-heal za missing `profiles/candidates`, brain collect mapiranje po `user_id` (docs/payments), brain report save schema fix (`brain_reports.report`) + anonymous tracking fix — 05.03.2026
- [x] Brain report email Gmail-safe rendering fix (table-based layout, removed flex/grid, escaped dynamic AI text) — 05.03.2026
- [x] Core lint debt pass 2 — stricter API typing + cleanup (`AppShell`, `UnifiedNavbar`, `WorkerSidebar`, `ReviewClient`, Stripe/Health/GodMode routes); warnings 223 → 193, lint/test/build green — 05.03.2026
- [x] Lint stabilization + React hook purity fixes + date locale cleanup (`en-US` → `en-GB`) — 05.03.2026
- [x] Brain memory dedup + WhatsApp webhook hardening + system-smoke alert cooldown (6h anti-spam) — 05.03.2026
- [x] Reliability autopilot v1 — `/api/cron/system-smoke` + expanded `/api/health` (Supabase/Stripe/SMTP/WhatsApp/n8n checks + alerting) — 05.03.2026
- [x] Hotfix: entry payment unlocked for all worker profiles (uklonjen admin approval gate na checkout + queue UI) — 04.03.2026
- [x] Payment/queue hardening + real offer links + admin status alignment + notification sync — 04.03.2026
- [x] Next.js 16 proxy migration (`src/middleware.ts` → `src/proxy.ts`) — 04.03.2026
- [x] Platform Config — centralized business facts DB, admin UI editor, WhatsApp + Brain + n8n integration — 02.03.2026
- [x] Brain Monitor dedup fix — checks open + closed issues, feeds resolved titles to AI — 02.03.2026
- [x] WhatsApp refund policy fix — 30 days → 90 days in fallback bot — 02.03.2026
- [x] AI Brain autonomous — platform monitoring, GitHub Issues, Supabase action logging — 02.03.2026
- [x] Gemini 3.0-flash + model fallback chain (3 modela) + AI error reclassification — 02.03.2026
- [x] WhatsApp n8n retry (2 pokušaja), smart fallback sa tačnim cenama — 02.03.2026
- [x] Email ID tracking za brain retry (`recentFailedEmails[]`) — 02.03.2026
- [x] WhatsApp chatbot upgrade: GPT-4o + 100-message memorija + enriched data — 28.02.2026
- [x] WhatsApp AI chatbot (n8n + GPT-4o) — 28.02.2026
- [x] AGENTS.md restrukturisan + CHANGELOG.md izveden — 28.02.2026
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
| AppShell | `src/components/AppShell.tsx` | Zajednički layout wrapper (Sidebar + Navbar + Content) za admin, worker, employer i agency workspace; sidebar renderuje role-specific navigaciju, čuva admin `?inspect=` kontekst kroz preview linkove i jasnije prikazuje worker `Queue & Status` umesto stare search/loupe semantike |
| UnifiedNavbar | `src/components/UnifiedNavbar.tsx` | Top navigacija |
| Proxy Guard | `src/proxy.ts` | CSRF + auth guard za `/profile`, `/admin`, `/api/*` |
| Profile Redirector | `src/app/profile/page.tsx` | Auto-redirect worker/employer |
| Worker Profile | `src/app/profile/worker/page.tsx` | Profil radnika; admin read-only inspect podržan preko `?inspect=<profile_id>` |
| Worker DashboardClient | `src/app/profile/worker/DashboardClient.tsx` | Klijentska komponenta profila + payment CTA + support unlock objašnjenje/inbox entry |
| Worker Edit | `src/app/profile/worker/edit/` | Editovanje profila |
| Worker Queue | `src/app/profile/worker/queue/` | Red čekanja; admin inspect podržan preko `?inspect=<profile_id>` |
| Worker Offers | `src/app/profile/worker/offers/[id]/` | Ponude |
| Worker Documents | `src/app/profile/worker/documents/` | Upload dokumenata; admin inspect podržan preko `?inspect=<profile_id>` |
| Employer Profile | `src/app/profile/employer/page.tsx` | Kanonski employer workspace u `AppShell`-u sa tabovima `company / post-job / jobs`; admin read-only inspect podržan preko `?inspect=<profile_id>` |
| Employer Jobs | `src/app/profile/employer/jobs/` | Legacy redirect ka kanonskom employer workspace tabu `jobs` |
| Agency Profile | `src/app/profile/agency/page.tsx` | Agency dashboard; admin read-only inspect podržan preko `?inspect=<profile_id>` |
| Agency Worker Editor | `src/app/profile/agency/workers/[id]/` | Agency-owned worker editor; admin inspect prati agency context kroz `?inspect=<profile_id>` |
| Account Settings | `src/app/profile/settings/page.tsx` | GDPR: delete account, export data |
| Admin | `src/app/admin/` | Admin panel |
| Admin Agencies | `src/app/admin/agencies/page.tsx` | Lista agencija sa worker counts i `Open Workspace` inspect ulazom |
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
| `/api/admin/manual-match` | POST/GET | Ručno matchovanje radnika → posao |
| `/api/admin/edit-data` | POST | Inline editovanje user/employer/contract polja |
| `/api/admin/re-verify` | POST | Re-trigger AI verifikacije dokumenta |
| `/api/contracts/generate-all` | POST | Bulk generisanje DOCX za sve matchovane |
| `/api/contracts/download-all` | POST | ZIP download svih dokumenata |
| `/api/contracts/preview` | GET | Preview placeholder podataka za DOCX dokumente |

### Stripe API Routes:
| Putanja | Metoda | Namena |
|---|---|---|
| `/api/stripe/create-checkout` | POST | Kreira Stripe Checkout session za `entry_fee` ili `confirmation_fee` |
| `/api/stripe/webhook` | POST | Stripe webhook finalizacija (`checkout.session.completed`) + post-payment status/email akcije |
| `/api/stripe/confirm-session` | POST | Fallback potvrda plaćanja sa success redirect-a (`session_id`) kad webhook kasni/padne |

### Key Libraries:
| Fajl | Namena |
|---|---|
| `src/lib/profile-completion.ts` | Shared profile completion — **single source of truth** za worker i employer |
| `src/lib/smoke-evaluator.ts` | Shared evaluator za system smoke (healthy/degraded/critical) |
| `src/lib/brain-memory.ts` | Shared deduplikacija + normalizacija za `brain_memory` upise (WhatsApp + Brain improve) |
| `src/lib/email-templates.ts` | Svi email templateovi + strict `TemplateData` (bez `[key: string]: any`) |
| `src/lib/whatsapp.ts` | WhatsApp Cloud API — template sending, text sending, logging, 10 convenience wrappers |
| `src/lib/platform-config.ts` | Centralized business facts (cene, garancija, kontakt). Kešira 5 min. Čitaju: WhatsApp bot, Brain Monitor i budući automation/tool slojevi |
| `src/lib/docx-generator.ts` | DOCX generisanje iz šablona (docxtemplater + nationality mapping) |

### Cron Jobs (vercel.json):
| Putanja | Raspored | Namena |
|---|---|---|
| `/api/cron/check-expiry` | Svaki sat | Provera isteklih sesija |
| `/api/cron/profile-reminders` | Daily 9 AM UTC | Podsetnik za nepotpune profile (reminder + warning + deletion) |
| `/api/cron/check-expiring-docs` | Daily 10 AM UTC | Alert za pasoš koji ističe za <6 meseci (max 1 email/30 dana) |
| `/api/cron/match-jobs` | Svakih 6 sati | Auto-matching radnika i poslova |
| `/api/cron/system-smoke` | Svaki sat (:30) | Automatizovan smoke monitoring ruta + servisa (Stripe/SMTP/WA/n8n) |

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
- **⚠️ worker_onboarding.id ≠ auth.uid()**: `worker_onboarding.id` / fizički `workers.id` je auto-generisan UUID, dok je `auth.uid()` = `profiles.id`. Za `worker_documents.user_id`, storage foldere i profile-based lookup uvek koristiti `user.id` (`profile_id`), NIKAD `workers.id`. Inače RLS i joins tiho pucaju ili vraćaju pogrešan red.
- **User Activity Tracking:** Svi ključni koraci korisnika se loguju u `user_activity` tabelu. Client: `logActivity()` / `logError()` iz `src/lib/activityLogger.ts`. Server: `logServerActivity()` iz `src/lib/activityLoggerServer.ts`. Nikad ne treba da blokira main flow — fire-and-forget.

---

## 7. 💡 PREDLOZI ZA UNAPREĐENJE
> AI treba da dopunjuje ovu listu kad vidi priliku. Korisnik odlučuje šta se implementira.
>
> **Važno:** Ovo je aktivni roadmap. `Sekcija 5 / TODO` je operativni backlog, a ova sekcija opisuje **zašto** i **kojim redom** sistem treba unapređivati.

### 7.1 Trenutni glavni cilj
- Napraviti platformu koja je istovremeno:
  - operativno jasna adminu
  - konzistentna worker/employer/agency korisnicima
  - spremna za skaliranje bez ručnih zakrpa i role/data drift-a

### 7.2 Preporučeni redosled rada
1. **Admin / Ops System**
   - pravi `inspect user` i `view as` bez mutacije admin profila
   - jasan ulaz u queue, payment, docs, offers, messaging, agency ownership
   - jedan admin koji služi radu, ne samo preview-u
2. **Profile & Workspace Consistency**
   - worker, employer i agency moraju deliti isti mentalni model
   - isti shell, isti ritam sekcija, iste karte/status signali, manje slepih ruta
   - ukloniti unexplained ikonice, dead-end preview-je i vizuelni drift
3. **Agency Operations**
   - agency kao pravi operativni kanal za unošenje worker-a
   - puni worker intake, `needs action`, bulk ops, status filteri, ownership jasnost
4. **Messaging**
   - v1 support inbox je baza
   - sledeće: worker/employer match chat, anti-contact leakage, admin oversight, transcript history
5. **Funnel & Payments**
   - abandoned checkout recovery
   - source attribution i real conversion insight
   - per-country placement fee infrastruktura
6. **AI & Automation**
   - email auto-responder
   - tool-using agent
   - health automation
   - tek posle operativne stabilnosti dalje širiti multi-model eksperimente

### 7.3 Principi za buduće promene
- **Ne dodavati nove AI slojeve pre nego što admin i operativa budu jasni.**
- **Ne praviti nove odvojene workspace obrasce po ulozi** ako isti problem može da reši shared komponenta/shell.
- **Ne vraćati legacy `candidate*` sloj nazad.** Novi SQL, helperi, payload-i i storage putanje moraju ostati worker-first (`workers`, `worker_onboarding`, `worker_documents`, `worker-docs`).
- **Support i employer komunikacija moraju ostati unutar platforme.** Email/phone reveal nije deo modela.

### 7.4 Backlog po uticaju
#### Visok uticaj
- [ ] **Admin/Ops rewrite v2** — case-centric admin, jasan pregled svih role workspace-a, agency ownership i messaging stanja
- [ ] **Profile workspace unification pass 2** — worker/employer/agency shared UX language, manje konfuzije, bolja mobilna upotrebljivost
- [ ] **Messaging phase 2** — employer inbox + worker/employer match thread unlock + anti-contact leakage filter
- [ ] **Payment recovery automation** — follow-up sekvence i admin funnel alerti za `created checkout / not paid`
- [ ] **Rate limiting** — dodati zaštitu na osetljive rute, posebno `verify-document`, `offers`, `track`, `send-email`
- [ ] **Error monitoring** — Sentry ili ekvivalent za hvatanje tihih production grešaka pre nego što ih korisnik prijavi

#### Srednji uticaj
- [ ] **Workspace visual regression smoke** — Playwright ili sličan screenshot/smoke paket za worker/employer/agency shell na desktop + mobile breakpoint-ima, sa proverom aktivnog sidebar state-a, header overlap-a i prisustva primarnog CTA-a na overview ekranima
- [ ] **WhatsApp delivery policy map** — pre slanja template nudževa razlikovati `invalid / no WhatsApp / country-restricted` brojeve od pravih platformskih kvarova, pa unsupported regione automatski prebacivati na email-only ili admin review umesto da stalno pune fail log
- [ ] **n8n Email AI Auto-Responder** — AI obrada inbox thread-ova
- [ ] **n8n AI Agent sa Tools** — aktivne radnje umesto čistog chat-a
- [ ] **Auth Design System unification** — shared auth komponente za `/signup` i `/login`
- [ ] **Brand assets hardening** — shared `BrandLogo` + guard da se legacy logo ne vrati
- [ ] **Type Safety Sprint (Phase 2)** — dalje smanjivanje `any` u admin/API sloju i vraćanje strožih lint pravila
- [ ] **Homepage Modular Document Blocks** — reusable landing blokovi za brže A/B testiranje copy-ja i strukture
- [ ] **Per-Country Landing Pages ZA POSLODAVCE** — SEO landing stranice po destinacijama
- [ ] **Cloud doctor automation** — pokretati `npm run cloud:doctor` periodično i alertovati samo na status prelaz u `FAIL`
- [ ] **Worker-first regression guard** — dodati CI/smoke proveru koja alarmira ako runtime, SQL ili storage ponovo uvedu `candidate*` putanje umesto `worker_onboarding` / `worker_documents` / `worker-docs`
- [ ] **Supabase migration history cleanup** — poravnati lokalne i remote migration lance tako da `supabase db push` više ne pokušava da reaplajuje stare bazne SQL fajlove; sledeći live hotfix ne sme zavisiti od ručnog Management API zaobilaza

#### Nizak / uslovni uticaj
- [ ] **Live Visa Process Tracker** — tek kad bude dovoljno stvarnih procesa (`100+` korisnika / aktivni slučajevi)
- [ ] **"Work in [Country]" Pages** — tek kad budu bar dve aktivne zemlje
- [ ] **Success Stories** — pravi case studies i video sadržaj kad bude dovoljno realnih uspeha
- [ ] **Referral sistem** — nakon prve jače baze zadovoljnih plasiranih worker-a
- [ ] **Multi-language support** — kad product copy i support operativa budu dovoljno stabilni

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
- `api/contracts/prepare/route.ts` + `api/contracts/generate/route.ts` — sklapanje contract payload-a i generisanje 4 PDF dokumenta iz admin toka
- `src/lib/contract-data.ts` — sklapa contract payload iz live `matches / worker_onboarding / profiles / employers / job_requests / worker_documents`
- `contract_data` Supabase tabela — čuva samo override/meta vrednosti za ugovor; worker override kolone su `worker_passport_issue_date`, `worker_passport_issuer`, `worker_place_of_birth`, `worker_gender`
- `document-ai.ts → extractPassportData()` — AI čita pasoše (full_name, passport_number, nationality, DOB, expiry, gender, POB, date_of_issue, issuing_authority)
- Generisani PDF ugovori idu u `worker-docs/contracts/{matchId}/`

### Kanonski template/data contract

#### 1. Template placeholder-i
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
> **UGOVOR O RADU** ima **2-kolonski layout**. Srpski tekst ide u levu kolonu, engleski u desnu. NIKAD ne svoditi ovaj dokument na single-column fallback bez eksplicitne odluke.

> [!CAUTION]
> **Opis posla ima 3 bullet-a po jeziku** — svaki bullet je zaseban paragraf u šablonu. NIKAD ne mapirati sve bullet-e na isti tekst jer to pravi 3x duplikaciju! Uvek `{{JOB_DESC_SR_1}}`, `{{JOB_DESC_SR_2}}`, `{{JOB_DESC_SR_3}}` zasebno.

#### 2. Passport extraction polja
`extractPassportData()` MORA da nastavi da izvlači:
- `date_of_issue` — datum izdavanja pasoša (POTREBNO za UGOVOR i POZIVNO PISMO)
- `issuing_authority` — izdavač pasoša (POTREBNO za POZIVNO PISMO)

Ako menjaš prompt ili `PassportData` interface, proveri da ova dva polja ostaju u AI output-u i u `documents.ai_extracted_data`.

#### 3. `contract_data` override kolone
Worker override kolone u live Supabase su:
```sql
SELECT
  worker_passport_issue_date,
  worker_passport_issuer,
  worker_place_of_birth,
  worker_gender
FROM contract_data;
```

`contract_data` NIJE source of truth za worker/employer/job core polja; ta polja i dalje dolaze iz live relacionih tabela preko `src/lib/contract-data.ts`.

#### 4. Server-side PDF generisanje
`api/contracts/generate/route.ts` danas:
1. Učita/ensure-uje kanonski `contract_data` za dati match
2. Generiše 4 PDF dokumenta iz deljenog `pdf-generator` sloja
3. Uploaduje PDF-ove u `worker-docs/contracts/{matchId}/`
4. Upisuje javne URL-ove u `contract_data.generated_documents`
5. Vraća URL-ove za download u admin UI

#### 5. Admin UI za generisanje
Dugme "Generate Contracts" na admin match detail stranici:
- Generiše sva 4 dokumenta
- Prikazuje status (generating / done / error)
- Link za download ZIP-a sa svim dokumentima

### Dupla verifikacija (online + offline)

```
Upload pasoša → document AI čita (OpenAI primarni, Gemini fallback) → čuva u ai_extracted_data
                                                      ↓
Admin: "Generate Contracts" → sajt generiše DOCX/PDF iz šablona
                                                      ↓
Offline verifikacija: admin preuzme PDF-ove lokalno
→ pokrene verify_all.py (provera legacy teksta i missing data)
→ vizuelna provera (layout, podaci, duplikacije)
→ gotovo
```

> [!IMPORTANT]
> **OpenAI GPT je primarni izvor podataka, Gemini je fallback** — Tesseract (lokalni OCR) se NE koristi kao dupli OCR jer je manje pouzdan.
> Lokalna verifikacija je **rule-based** (provera formata, logičnosti) + **vizuelna** (PDF pregled).

### ⚠️ Gotchas za dokument generisanje
1. **Job description 3x duplikacija** — NIKAD ne mapirati sve 3 bullet linije opisa posla na isti ceo tekst. Svaka linija mora imati svoj zaseban placeholder.
2. **Issuer** — za nepalske pasoše uvek `MOFA, DEPARTMENT OF PASSPORTS`. OCR/AI može da vrati garbage. Najbolje hardcoded po zemlji.
3. **Encoding** — DOCX generisanje mora podržati UTF-8 (srpski znakovi: Č, Ć, Š, Ž, Đ).
4. **Replacement sorting** — ako se radi string replacement (ne placeholder), sortirati parove LONGEST-FIRST.
5. **DOCX run splitting** — Word deli tekst u run-ove nepredvidivo. Placeholder `{{NAME}}` može biti u 2-3 run-a. Koristiti biblioteku koja to handluje (docxtemplater).
6. **Admin user counting** — kad se broje workeri iz auth usera, UVEK isključiti i `employer` I `admin` (`user_type !== 'employer' && user_type !== 'admin'`). Inače admin nalog ulazi u worker statistike.
7. **Admin profile access** — admin mora proći `user_type` check na 3 mesta: server-side `page.tsx`, klijentski `EmployerProfileClient.tsx fetchData()`, i layout guard. Ako dodaš novu zaštitu, proveri SVA 3.
8. **Kanonski i jedini aktivni storage bucket je `worker-docs`** — NIKAD ne koristiti `from("documents")` za storage. Bucket `documents` NE POSTOJI. `candidate-docs` je ugašen. Novi runtime/helperi moraju uvek gađati `worker-docs`. Generisani PDF ugovori idu u `worker-docs/contracts/{matchId}/`.
9. **Whitelist za edit-data mora da odgovara stvarnoj DB šemi** — pre dodavanja kolone u whitelist, PROVERI da kolona zaista postoji u tabeli (FULL_SETUP.sql + migracije). Phantom kolone u whitelistu = tihi fail.
10. **CHECK constraint na `workers.status`** — dozvoljene vrednosti: `NEW, PROFILE_COMPLETE, PENDING_APPROVAL, VERIFIED, APPROVED, IN_QUEUE, OFFER_PENDING, OFFER_ACCEPTED, VISA_PROCESS_STARTED, VISA_APPROVED, PLACED, REJECTED, REFUND_FLAGGED`. Svaka druga vrednost → DB error. Migracija: `007_admin_approval.sql`. **Kad dodaješ novi status, ažuriraj I migraciju I ovaj spisak.**
11. **JS operator precedence u ternary** — `A || B ? C : D` se evaluira kao `(A||B) ? C : D`, NE kao `A || (B ? C : D)`. Uvijek stavljaj zagrade.
12. **Unicode u regex** — za srpska imena (Č, Ć, Š, Ž, Đ) koristiti `\p{L}` sa `u` flagom, NIKAD `[A-Z]`.
13. **`profiles` tabela NEMA `role` kolonu** — kolona se zove `user_type`. NIKAD ne koristiti `profile?.role`. Svuda koristiti `profile?.user_type !== 'admin'`. Ovo je bila sistemska greška u 14 fajlova.
14. **Employer status vrednosti su UPPERCASE** — DB CHECK dozvoljava samo `PENDING`, `VERIFIED`, `REJECTED`. NIKAD lowercase `active/pending/rejected`.
15. **Admin auth check pattern** — za API rute: `select("user_type")` + `profile?.user_type !== "admin"`. Za stranice: isti pattern + `isGodModeUser()` fallback. Za server actions: samo `user_type`, bez godmode.
15a. **`worker` je kanonski domain naziv, a live DB/storage je worker-first** — za novi kod UVEK koristiti `src/lib/domain.ts` (`normalizeUserType()`, `shouldProvisionWorkerRecords()`), `src/lib/workers.ts` (`ensureWorkerRecord()`, `loadCanonicalWorkerRecord()`, `pickCanonicalWorkerRecord()`) i `src/lib/worker-documents.ts`. Ne uvoditi nove helpere/komentare/API payload-e sa `candidate*` imenima; ti tragovi smeju ostati samo u istorijskim migracijama, starim FK imenima i eksplicitno označenim kompatibilnim zapisima. Posebno: ne koristiti raw `.single()` / `.maybeSingle()` na `worker_onboarding` / fizičkom `workers` kada lookup radiš po `profile_id` ili telefonu, jer live može imati duplikate.
15b. **Agency foundation migration je live, ali schema guard ostaje obavezan** — puni agency flow sada očekuje `public.agencies` i ownership kolone na fizičkom `workers` (`agency_id`, `submitted_by_profile_id`, `submitted_full_name`, `submitted_email`, `source_type`, `claimed_by_worker_at`). Produkcija je poravnata, ali preview/local okruženja i dalje mogu biti bez te migracije, zato `getAgencySchemaState()` guard NE uklanjati.
16. **Webhook/Cron rute MORAJU koristiti service-role admin helper (`createAdminClient()` ili `createTypedAdminClient()`)** — `createClient()` zahteva auth cookies. Stripe webhooks, WhatsApp webhooks, i Vercel cron jobs NEMAJU cookies. Sve DB operacije će tiho da failuju. Za schema-sensitive rute (`Brain`, `system-smoke`, server activity logging) preferirati `createTypedAdminClient()`, a legacy query-heavy rute ostaviti na `createAdminClient()` dok se ne sanira postojeći query debt.
17. **`OFFER_ACCEPTED` status** — ~~NE POSTOJI u CHECK constraint~~ FIXED u migraciji `007_admin_approval.sql`. Videti Gotcha #10 za potpunu listu dozvoljenih statusa.
18. **`payments` tabela schema** — ~~drift~~ FIXED. `COMPLETE_RESET.sql` sada koristi `user_id` i `amount` (ne `profile_id`/`amount_cents`). Dodate kolone: `stripe_checkout_session_id`, `paid_at`, `deadline_at`, `metadata`, `refund_status`, `refund_notes`.
19. **Next.js `redirect()` u try/catch** — `redirect()` radi tako što THROWUJE specijalan error sa `digest: "NEXT_REDIRECT"`. Ako imaš try/catch, MORAŠ re-throwovati: `if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;`. Inače redirect nikad neće raditi.
20. **Admin stranice zahtevaju EKSPLICITAN auth check** — `AppShell variant="admin"` NE štiti stranicu. Svaka admin `page.tsx` MORA imati `profiles.user_type === 'admin'` check. Bez toga, SVAKI ulogovani korisnik može da vidi admin dashboard, queue, jobs.
21. **`email_queue.read_at` kolona** — notifications API čita/piše `read_at`, ali je kreirana tek u migraciji `007_round10_fixes.sql`. Ako migracija nije pokrenuta, notifications endpoint crashuje.
22. **Supabase `.in()` sa praznim nizom crashuje** — `.in("id", [])` baca error. UVEK koristi guard: `.in("id", ids.length > 0 ? ids : ["__none__"])`. Videti `document-status/route.ts` za ispravan pattern.
23. **`verify-document` storage/DB ops moraju koristiti admin klijent za admin pozive** — kada admin triggeruje re-verify (preko `/api/admin/re-verify`), `verify-document` prima admin-ove cookies. Ali storage operacije (upload/remove/update) koriste RLS. Admin ne može menjati tuđe fajlove preko RLS-bound klijenta. Koristiti `storageClient = isAdmin ? createAdminClient() : supabase` pattern.
24. **TypeScript interface ≠ DB kolona** — kad dodaješ novo polje u `ContractDataForDocs` interface ili bilo koji drugi tip koji mapira na DB tabelu, MORAŠ napraviti SQL migraciju (`ALTER TABLE ... ADD COLUMN`). TypeScript se kompajlira bez greške ali INSERT puca u runtime-u. Uvek ažuriraj i `COMPLETE_RESET.sql`.
25. **User/Admin delete MORA da obriše SVE povezane tabele** — `delete-user` i `account/delete` moraju brisati: `worker_documents`, `signatures`, `contract_data` (kroz matches), `offers`, `matches`, `payments`, `email_queue`, `whatsapp_messages`, pa tek onda `workers`, `employers`, `agencies`, `profiles`, auth. Bez toga ostaju siročići u bazi.
26. **`queue/auto-match` koristi `createClient()` umesto `createAdminClient()`** — ~~krhak pattern~~ FIXED. Admin-only ruta sada koristi `createAdminClient()` za sve DB operacije (`offers`, `worker_onboarding`, `job_requests`). `createClient()` ostaje samo za auth check.
27. **Profile completion drift — koristi `getWorkerCompletion()` kao single source of truth** — `workers/page.tsx` je imao inline 16-field proveru koja nije koristila deljenu `getWorkerCompletion()` funkciju. Svaki put kad se menja logika kompletnosti profila, morala bi se menjati na 3 mesta. UVEK koristiti `getWorkerCompletion()` iz `profile-completion.ts`.
28. **ContactForm → `/api/send-email` ruta je MORALA da postoji** — ContactForm je pozivao `/api/send-email` koji NIJE postojao. Svaki submit je davao 404. Ruta je kreirana sa email validacijom i slanjem na admin email preko `sendEmail()` iz `mailer.ts`.
29. **⚠️ SVI CRON JOBOVI SU UGAŠENI — sistem je u fazi pripreme** — `vercel.json` crons array je prazan. Četiri cron joba su bila aktivna i slala emailove korisnicima: `match-jobs` (svaki sat — matchovao workere sa jobovima), `check-expiry` (svaki sat — procesovao expired offers), `profile-reminders` (svaki dan — slao remindere i **BRISAO KORISNIKE posle 30 dana**), `check-expiring-docs` (svaki dan). Rute i dalje postoje u `/api/cron/` i mogu se ručno pozvati. Kad sistem bude spreman za produkciju, dodaj schedule-ove nazad u `vercel.json`.
30. **🚫 AUTOMATSKI CRON MEJLOVI SU UGAŠENI — welcome/signup emailovi RADE normalno** — Cron jobovi su ugašeni jer su slali lažne notifikacije (npr. "pronađen vam je posao") kad nema odobrenih profila u sistemu. Welcome email, signup potvrda, admin announcements, kontakt forma — SVE TO RADI. Samo `match-jobs`, `profile-reminders`, `check-expiring-docs`, `check-expiry` su isključeni u `vercel.json`. NE uključivati ih dok tim ne kaže.
31. **🛡️ MANUELNA ADMIN VERIFIKACIJA NIJE payment-gate** — Admin approval ostaje za operativni pregled i QA, ali $9 entry fee je otključan za sve worker profile. Worker može da plati bez `admin_approved=true`; webhook i dalje prebacuje u `IN_QUEUE` i postavlja `queue_joined_at`. DB kolone `admin_approved`, `admin_approved_at`, `admin_approved_by` ostaju za admin procese. Migracija: `007_admin_approval.sql`.
32. **🚀 LAUNCH DATUM: 01.03.2026** — sve mora biti gotovo do tada. Videti Sekciju 9.
33. **Stripe webhook MORA da postavi `queue_joined_at`** — kad se worker prebaci u `IN_QUEUE` posle plaćanja entry fee, MORA se postaviti i `queue_joined_at: new Date().toISOString()`. Bez toga, 90-dnevni countdown na admin dashboardu ne radi jer je `queue_joined_at` null.
34. **`notifications.ts` koristi `NEXT_PUBLIC_BASE_URL`** — env var za base URL je `NEXT_PUBLIC_BASE_URL`, NE `NEXT_PUBLIC_SITE_URL`. Offer link je `/profile/worker/offers/{id}`, NE `/profile/offers/{id}`. Format datuma je `en-GB`, NE `en-US`.
35. **`match-jobs` cron MORA filtrirati `IN_QUEUE` + `entry_fee_paid`** — bez ovih filtera, cron matchuje SVE workere sa verifikovanim pasošem, uključujući one koji nisu platili entry fee ni ušli u queue.
36. **Auto-deletion u `profile-reminders` MORA da obriše SVE tabele** — samo brisanje auth usera (`deleteUser`) ostavlja siročiće u `workers`, `profiles`, `worker_documents`, `payments`, `email_queue`, `employers`, `agencies`. UVEK brisati SVE povezane tabele + storage pre brisanja auth usera. Isti pattern kao `account/delete` i `admin/delete-user`.
37. **Google OAuth korisnici NEMAJU `user_type` pri prvom login-u** — ako korisnik klikne "Sign in with Google" na login stranici (ne signup), biće preusmeren na `/auth/select-role`. Auth callback proverava `user_metadata.user_type` i ako ga nema, šalje tamo. Signup stranica automatski šalje `user_type` kroz URL param.
38. **Google OAuth — Supabase Provider MORA biti konfigurisan** — potreban Google Cloud OAuth Client ID + Secret u Supabase Dashboard → Authentication → Providers → Google. Redirect URL iz Supabase mora biti dodat kao Authorized Redirect URI u Google Cloud Console.
39. **WhatsApp šabloni MORAJU biti odobreni u Meta Business Manager-u pre korišćenja** — `sendWhatsAppTemplate()` će vratiti error ako template nije approved. Imena šablona su lowercase sa underscores (npr. `document_reminder`). Maximum 550 karaktera za body. Utility šabloni ne smeju imati promotivni sadržaj — Meta ih automatski re-kategoriše u Marketing.
40. **WhatsApp webhook MORA koristiti `createAdminClient()`** — Meta šalje webhook bez auth cookies. Sve DB operacije moraju koristiti service role client. Webhook ruta ima i GET (verifikacija) i POST (poruke + status update-ovi).
41. **`queueEmail()` podržava opcionalni `recipientPhone` parametar** — kad se prosledi, automatski šalje i WhatsApp template uz email. WhatsApp failure NIKAD ne blokira email slanje. Dodati phone kao poslednji argument: `queueEmail(supabase, userId, type, email, name, data, scheduledFor, phone)`.
42. **RLS policy MORA koristiti `(select auth.uid())` a NE `auth.uid()` direktno** — `auth.uid()` se re-evaluira za SVAKI red u tabeli, što drastično usporava query-je. Zamotan u subquery `(select auth.uid())` se poziva samo jednom. Ovo važi za sve `auth.<function>()` pozive u RLS policy-ima (uid, jwt, role). Supabase Advisor detektuje ovo kao performance warning.
43. **Telefon se čuva u `worker_onboarding.phone` / fizičkom `workers.phone`, NE u Supabase Auth** — Auth `phone` polje je za SMS login. Naš phone se čuva u worker sloju. `ProfileClient.tsx` sinhronizuje phone u `auth.user_metadata` na save da bude vidljiv u Auth dashboardu. WhatsApp webhook prvo traži korisnika po `worker_onboarding.phone`, pa po auth metadata fallback-u.
44. **Business facts MORAJU ići u `platform_config` tabelu** — NIKAD ne hardkodovati cene, garanciju, kontakt email ili politiku u kod. Koristiti `getPlatformConfig()` iz `src/lib/platform-config.ts`. Admin menja u Settings → Platform Config. WhatsApp bot, Brain Monitor i budući automation/tool slojevi — svi čitaju iz iste baze. Cache: 5 min. Fallback: hardkodovane default vrednosti ako DB pukne.
45. **`brain_memory` upisi MORAJU ići kroz `saveBrainFactsDedup()`** — WhatsApp learning loop i Brain self-improve ne smeju direktno `insert` bez dedupa. Koristiti `src/lib/brain-memory.ts` da se spreče duplikati i prompt-bloat.
46. **WhatsApp webhook token + admin telefoni su ENV-driven** — `WHATSAPP_VERIFY_TOKEN` (ili fallback na `CRON_SECRET`) mora biti set; hardcoded verify token fallback je uklonjen. Admin telefon za WhatsApp komande ide kroz `OWNER_PHONE` ili `OWNER_PHONES` (comma-separated).
47. **ESLint gate: no blocking errors, warnings ostaju kao tehnički dug** — `@typescript-eslint/no-explicit-any` je privremeno warning da produkcioni lint ne blokira deploy dok se radi postepena tipizacija. `npm run lint` mora ostati na 0 errors.
48. **`brain_reports` schema koristi `report` JSON kolonu (ne `content`/`report_type`)** — Brain Monitor i `/api/brain/report` MORAJU upisivati u `report` polje i proveriti DB grešku pre nego što označe `reportSaved=true`.
49. **`/api/track` za anonimne evente MORA slati `user_id: null`** — string `"anonymous"` nije validan UUID i tiho ubija funnel telemetry; anonimni status i kontekst treba čuvati u `details`.
50. **Brain stall metrika mora mapirati po korisniku (`worker_documents.user_id`, `payments.user_id`)** — heuristika `created_at && c.created_at` daje lažne rezultate (`no_docs_uploaded`, `payment_at`) i vodi AI na pogrešne zaključke.
51. **Checkout route MORA imati onboarding self-heal** — ako nedostaje `profiles` ili `worker_onboarding` zapis, `/api/stripe/create-checkout` treba automatski da ih kreira pre eligibility check-a, da worker ne ostane blokiran i da payment telemetry beleži realne pokušaje.


---

## 9. 🚀 LAUNCH STATUS / ARHIVA

> Ova sekcija je **istorijski snapshot launch momenta**. Aktivni prioriteti su u Sekciji 5 (`TODO`) i Sekciji 7 (`Roadmap`).

### Launch snapshot — 01.03.2026
> **Cilj:** 1. marta sajt počinje da zarađuje.

### ⚠️ Preduslovi za launch
1. ✅ Sajt radi (Vercel deploy)
2. ✅ Auth (signup/login/logout + Google OAuth)
3. ✅ Worker profil + dokumenta + AI verifikacija
4. ✅ Admin panel + manual approval
5. ✅ Email sistem (welcome, reminders, admin updates)
6. ✅ Supabase Pro + password strength
7. ✅ Stripe plaćanja ($9 entry fee) — LIVE 28.02.2026
8. ✅ Cron jobovi aktivni (4 joba u `vercel.json`) — 28.02.2026
9. ✅ WhatsApp AI chatbot (n8n + GPT-4) — 28.02.2026
10. ⬜ Final smoke test
11. ⬜ n8n email automation (retry failed emails)

### Trenutno čitanje ovog statusa — 07.03.2026
- Platforma je live i naplaćuje `$9 Job Finder`
- Agency foundation, messaging v1 i unified profile shell su uvedeni
- Glavni preostali problemi više nisu "launch blockers", nego:
  - admin/ops ergonomija
  - profile/workspace konzistentnost
  - messaging phase 2
  - payment recovery i funnel intelligence

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

13. **WhatsApp AI Chatbot architecture** — The flow is: `User → WhatsApp → Meta → Vercel webhook (route.ts) → GPT-5 mini intent router → GPT-5 mini response generator → Vercel → WhatsApp reply`. Vercel handles both routing and reply generation directly via OpenAI Responses API and sends the reply using its own `WHATSAPP_TOKEN`. Key env vars: `OPENAI_API_KEY`, `WHATSAPP_ROUTER_MODEL`, `WHATSAPP_RESPONSE_MODEL`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`/`CRON_SECRET`.

14. **UVEK koristi `database.types.ts` za kolone** — Fajl `src/lib/database.types.ts` je generisan iz Supabase šeme i sadrži tačna imena kolona za sve tabele. Pre nego što napišeš `.select()` upit, pogledaj šta tip za tu tabelu kaže. Komanda za regenerisanje: `npx supabase gen types typescript --project-id qdwhwlusxjjtlinmpwms > src/lib/database.types.ts`. Pokreni ovo kad dodaš novu kolonu u bazu.

15. **Ne popravljaj SQL da sakrije bug — popravi kod** — Kad SQL indeks ili migracija pukne jer kolona ne postoji, to znači da KOD koristi pogrešno ime kolone. Pravi fix je popraviti kod, ne brisati SQL. Ovo je uhvatilo 5 kolona koje su bile pogrešne u produkciji.

16. **Brain API endpointi** — System ima tri API endpointa za AI Brain analizu:
    - `GET /api/brain/collect` — statistika iz baze (korisnici, dokumenti, plaćanja, emailovi)
    - `GET /api/brain/code` — čita source kod sa GitHub-a  
    - `GET/POST /api/brain/report` — čuva/čita nedeljne AI izveštaje
    - Svi zaštićeni sa `Authorization: Bearer CRON_SECRET` headerom
    - Env var: `GITHUB_TOKEN` (classic, repo scope) za `/api/brain/code`

17. **Meta signature verification za webhook** — WhatsApp webhook POST sada proverava `X-Hub-Signature-256` HMAC potpis. Env var: `META_APP_SECRET` (iz Meta Developer Portal → App Settings → Basic → App Secret). Bez ove env varijable, webhook loguje warning ali propušta sve — sa njom odbija lažne zahteve.

18. **Signed URLs za osetljive dokumente** — `verify-document/route.ts` koristi `createSignedUrl(path, 600)` umesto `getPublicUrl()`. URL važi 10 minuta. NIKADA ne koristiti `getPublicUrl()` za lične dokumente (pasoš, diploma, slika).

19. **God mode env varijable** — God mode je podrazumevano ISKLJUČEN. Zahteva dve env varijable: `GODMODE_ENABLED=true` i `OWNER_EMAIL`. Bez oba, `isGodModeUser()` uvek vraća `false`. Nema hardkodovanog fallback email-a.

20. **Auto-deletion safety flag** — Cron `profile-reminders` neće brisati korisnike bez `ALLOW_AUTO_DELETION=true` env varijable. Ovo sprečava slučajno masovno brisanje u produkciji.

21. **Stripe amount validacija** — Webhook proverava `session.payment_status === "paid"` i `session.amount_total` pre nego što dodeli entitlemente. Entry fee = 900 cents ($9), confirmation fee = 19000 cents ($190).

22. **Brain report mora da se sačuva u bazu** — svaki Brain izveštaj ili snapshot MORA da završi u `brain_reports`, bilo kroz `/api/cron/brain-monitor` ili `POST /api/brain/report` sa `Authorization: Bearer CRON_SECRET`. Bez toga nema baseline-a za poređenje. `model` ne hardkodovati; daily fallback sada ide kroz `BRAIN_DAILY_MODEL` (`gpt-5-mini` default).

30. **Daily Brain Monitor je snapshot-first, email-second** — `/api/cron/brain-monitor` sada svaki dan snima structured report u `brain_reports`, ali email šalje samo kada postoje pravi exception signali: kritičan operation status, health score ispod praga, issue findings ili `retry_email` akcija. Ne vraćati ga na obavezni narativni email za svaki run.

23. **Brain code coverage — `KEY_PATHS` mora da pokriva celu bazu** — `brain/code/route.ts` čita fajlove sa GitHub-a za AI analizu. `KEY_PATHS` niz MORA da uključuje `database.types.ts`, SVE API rute, SVE lib fajlove i `proxy.ts` (ranije `middleware.ts`). GPT 5.3 report je flagovao da ne može da validira kolone jer mu `database.types.ts` nije bio poslat. FIXED 01.03.2026: prošireno sa 28 na 70+ fajlova.

24. **Brain collect — `totalEmployers` mora da koristi `employers` tabelu** — `users.totalEmployers` je koristio `profiles.user_type === "employer"` filter, dok je `employers.total` brojao `employers` tabelu. Ovo stvara nekonzistentnost (3 vs 5). FIXED: obe metrike sada koriste `employers` tabelu.

25. **Document AI provider chain** — `src/lib/document-ai.ts` koristi OpenAI GPT-4o-mini kao primarni vision provider, pa tek onda Gemini fallback chain `gemini-3.0-flash → gemini-2.5-pro → gemini-2.5-flash`. Ako primarni provider padne (5xx, rate limit, outage), automatski se probava sledeći. Custom `AIInfraError` klasa razlikuje AI infra greške od pravih document issues. Kad AI padne, dokumenti idu na `manual_review` umesto da se odbiju korisniku.

26. **n8n Tool čvorovi sa `$fromAI()` — body mora biti "Using Fields Below"** — Nikad ne mešati `{{ $fromAI() }}` expression-e unutar raw JSON stringa. n8n ne može da parsira `{"action": {{ $fromAI('action') }}}` kao validan JSON. Umesto toga koristiti "Specify Body: Using Fields Below" i dodati svako polje pojedinačno. `$fromAI()` expressions prikazuju "undefined" u editoru — to je normalno, popunjavaju se u runtime-u.

27. **Brain Action API Tool nepotreban kad postoji Supabase Tool** — Umesto da brain šalje HTTP request na Vercel API koji onda piše u Supabase (n8n → HTTP → Vercel → Supabase), koristiti Supabase Tool čvor direktno (n8n → Supabase). Manje koda, manje tačaka pucanja, isti rezultat.

28. **n8n AI builder je nesiguran za kompleksne konfiguracije** — Za jednostavne promene OK, ali za JSON body formatting, expression syntax, i credential setup bolje davati korisniku ručna uputstva korak-po-korak nego prompt za n8n AI.

29. **Brain collect NE SME da guta query/schema greške** — Ako `src/app/api/brain/collect/route.ts` koristi nepostojeću kolonu (`recipient` umesto `recipient_email`, `profiles.phone`, `matches.created_at`, itd.), rezultat NE SME da bude `data: null` prosleđen AI-u. Ruta mora da fail-uje sa 500 i jasnim logom, inače Brain generiše lažne P0/P1 zaključke iz praznih setova. Pre svake izmene u brain query-ima proveri `src/lib/database.types.ts`.

---

## 📦 Legacy / Niche Suggestions

> Ovi predlozi nisu deo aktivnog glavnog roadmap-a, ali ostaju sačuvani kao korisne ideje ili specifični follow-up-i.

1. Consider adding article/section numbers back to UGOVOR O RADU — the original DOCX didn't have numbered articles (just section headers), but adding them could improve readability.
2. The POZIVNO PISMO has a hardcoded "1 ЈЕДНА (ONE)" for number of visits — this could be made configurable.
3. Consider adding a PDF preview feature in the admin panel before generating final documents.
4. **Brain multi-model debata** — Proširiti n8n workflow da koristi 3 modela (GPT, Claude, Gemini) u 4 runde kako je opisano u `brain_system_design.md`, ali tek kad core operativa bude stabilna.
5. **Automated DB backup verification** — Supabase Pro radi daily backup, ali treba bar jednom testirati restore.
6. **OpenGraph dynamic slike** — Generisati OG slike sa brojem radnika / zemljama za social sharing.
