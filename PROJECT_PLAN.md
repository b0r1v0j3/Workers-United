# 🏗️ Workers United — PROJECT PLAN

> **Poslednje ažuriranje:** 2026-02-07

---

## ⚠️ UPUTSTVO ZA AI (OBAVEZNO PROČITAJ PRVO)

Ovaj fajl je **jedini izvor istine** za ceo projekat. Svaki novi chat MORA da pročita ovaj fajl na početku rada.

### Pravila za čitanje:
1. Pročitaj **ceo** ovaj fajl pre nego što napišeš jednu liniju koda
2. Ako korisnik traži nešto što se kosi sa ovim planom — **pitaj ga** pre nego što uradiš bilo šta
3. Ne krpi — svaku promenu radi kompletno i ispravno
4. **UVEK predlaži unapređenja** — ti si partner u razvoju, ne samo izvršilac. Kad vidiš priliku za poboljšanje (UX, performanse, sigurnost, arhitektura), predloži i objasni zašto. Dodaj predloge u Sekciju 7 (Predlozi).
5. Kad završiš task, razmisli da li nešto može bolje i predloži

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
- **NIKAD ne pominjemo odakle radnici dolaze** — nema "Afrika", "Azija", ništa. Samo "international workers" ili "candidates".
- **Potpuna usluga** — mi nismo job board. Mi radimo SVE od A do Ž.
- **Poslodavci ne plaćaju ništa** — usluga je besplatna za poslodavce, zauvek.
- **NIŠTA LAŽNO** — nikad ne pravimo placeholder sadržaj, lažne reklame, lažne kontakte ili bilo šta što izgleda kao da postoji a ne postoji. Svaki element na sajtu mora biti funkcionalan i realan.

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

### URL Struktura:
- `/profile` — auto-redirect na worker ili employer
- `/profile/worker` — profil radnika (3 taba: Profile Info, Documents, Status)
- `/profile/worker/edit` — editovanje profila (single-page form, ne wizard)
- `/profile/worker/queue` — status u redu čekanja
- `/profile/worker/offers/[id]` — detalji ponude
- `/profile/employer` — profil poslodavca
- `/profile/employer/jobs` — lista job request-ova
- `/profile/employer/jobs/new` — kreiranje novog job request-a
- `/onboarding` — editovanje profila (ista forma kao edit)
- `/admin` — admin panel

### Tehnički stack:
- **Frontend:** Next.js (App Router), React, TypeScript
- **Backend:** Supabase (Auth + Database + Storage)
- **Plaćanja:** Stripe
- **AI Verifikacija:** GPT-4o za proveru dokumenata
- **Hosting:** Vercel

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

---

## 5. 📋 STANJE PROJEKTA

### ✅ Završeno

**Čišćenje lažnih elemenata (07.02.2026)**
- Uklonjeni "Sponsored", "Ad", "Contacts" iz AppShell desnog sidebara — ništa lažno

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
- [ ] Admin sub-stranice u AppShell stilu
- [ ] Mobilna responsivnost (mobile-first)
- [ ] Multi-country pricing za placement fee
- [ ] Employer profil verifikacija (100% pravilo)
- [ ] Automatsko matchovanje radnika sa poslodavcima
- [ ] Email notifikacije za sve korake procesa

---

## 7. 💡 PREDLOZI ZA UNAPREĐENJE
> AI treba da dopunjuje ovu listu kad vidi priliku. Korisnik odlučuje šta se implementira.

### Prioritet: Visok
- [ ] **GDPR Usklađenost** — čuvamo pasoše i lične podatke za EU poslodavce, treba: consent pri registraciji, pravo na brisanje podataka, privacy policy sadržaj
- [ ] **Istekli dokumenti** — dodati `expires_at` polje za pasoš, automatski alert kad ističe za <6 meseci
- [ ] **Admin Conversion Funnel** — vizuelni prikaz: signup → profil 100% → verified → platio → match → viza. Procentualno po koraku.

### Prioritet: Srednji
- [ ] **WhatsApp notifikacije** — webhook postoji, treba ga iskoristiti za: queue update, nova ponuda, podsetnik za profil
- [ ] **Per-Country Landing Pages** — `/work-in-serbia`, `/work-in-germany` sa specifičnim info o platama i uslovima (SEO)
- [ ] **Email sekvence** — welcome email, podsetnik za nepotpun profil, status update iz queue-a

### Prioritet: Nizak (kad bude živih korisnika)
- [ ] **Success Stories** — pravi case studies kad prvi radnici dobiju vize
- [ ] **Referral sistem** — radnik koji je uspešno plasiran preporučuje druge
- [ ] **Multi-language support** — ključne instrukcije na jezicima radnika

---

## 8. 🏛️ ARHITEKTURA

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
| Onboarding | `src/app/onboarding/page.tsx` | Edit profil forma |
| Admin | `src/app/admin/` | Admin panel |
| GodModePanel | `src/components/GodModePanel.tsx` | Dev testiranje |
