# 🏗️ Workers United — Project Plan

> **Poslednje ažuriranje:** 2026-02-07  
> **Svrha:** Ovo je živi dokument koji prati šta radimo na projektu. Svaki chat i svaki računar treba da čita ovaj fajl da bi znao kontekst.

---

## 📌 Trenutni Fokus

Refaktorisanje celog sajta u **Facebook-stil** profil sistem. Svaki korisnik (radnik, poslodavac, admin) ima jedinstven profil sa jasnom, čistom strukturom.

---

## 🗣️ Diskusije i Zahtevi (Active Memory)
> **Ovde beležimo sve što se dogovorimo u chatu da ne zaboravimo.**

### 📐 Dizajn Filozofija (dogovoreno 07.02.2026)
- **Facebook DIZAJN, ne klon** — koristimo FB stil (kartice, boje, tipografiju) ali prilagođeno našim potrebama
- **NEMA socijalnih feature-ova** — nema prijatelja, pisanja na zidu, Like/Comment/Share
- **NEMA Home feed-a** — samo profil gde se unose podaci i dokumenta
- **Jednostavno** — profil → dokumenta → verifikacija → čekanje
- **Dashboard ima 3 taba**: Profile Info, Documents, Status

### ⚠️ Princip Razvoja (dogovoreno 07.02.2026)
- **NE KRPIMO — PRAVIMO SAVRŠENSTVO**
- Nikad ne radimo "quick fix" ili "workaround" — svaka promena se radi kompletno i ispravno
- Ako nešto treba preimenovati — menjamo SVUDA, ne samo na jednom mestu
- Bolje je potrošiti više vremena sada nego večno krpiti posle
- Svaka odluka se dokumentuje DETALJNO u ovom fajlu

### 🗺️ URL Struktura (dogovoreno 07.02.2026)
- **`/profile`** — auto-redirect na `/profile/worker` ili `/profile/employer` na osnovu tipa korisnika
- **`/profile/worker`** — radnički profil i dashboard (3 taba: Profile Info, Documents, Status)
- **`/profile/worker/edit`** — editovanje profila (single-page form)
- **`/profile/worker/queue`** — status u redu čekanja
- **`/profile/worker/offers/[id]`** — detalji ponude
- **`/profile/worker/documents`** — dokumenta (redirect na profil)
- **`/profile/employer`** — profil poslodavca (EmployerProfileClient)
- **`/profile/employer/jobs`** — lista job request-ova
- **`/profile/employer/jobs/new`** — kreiranje novog job request-a
- **`/onboarding`** — editovanje profila / prvi put

### 🆕 Protokol
- [x] Ažurirati `PROJECT_PLAN.md` na početku svakog chata sa novim zahtevima i statusom
- [x] Uvek uraditi `git pull` pre početka rada

---

## ✅ Završeno

### URL Restrukturisanje /dashboard → /profile (07.02.2026)
- [x] Premešteno `src/app/dashboard/` → `src/app/profile/worker/`
- [x] Premešteno `src/app/employer/profile/` i `src/app/employer/dashboard/` → `src/app/profile/employer/`
- [x] Kreiran `/profile/page.tsx` kao auto-redirector
- [x] Ažurirano 50+ referenci: middleware, auth, Stripe, email templates, GodMode, AppShell, i svi sub-routovi
- [x] Obrisani stari stub fajlovi

### Fix Profile Completion i Single-Page Edit (07.02.2026)
- [x] Popravljen bug: profil completion padao sa 100% na 86% jer se `signature_url` nije učitavao nazad u formu
- [x] Onboarding konvertovan iz multi-step wizard u single-page formu
- [x] Uklonjeni Police Record i Medical Certificate iz dokumenata

### Facebook-Style Layout Refaktor (Feb 2026)
- [x] Kreiran `AppShell` komponenta — wrapper sa Sidebar, Navbar, Content Area
- [x] Kreiran `UnifiedNavbar` — zajednički navbar za sve korisnike
- [x] Redesign: Dashboard kompletno prepisan — skinuti svi socijalni feature-ovi, dodat clean 3-tab profil
- [x] Fix: Uklonjen dupli navbar, smanjen logo, sidebar prilagođen

### Design System (Feb 2026)
- [x] Unified boje i tipografija kroz ceo sajt
- [x] Facebook-stil tabovi, Intro kartice
- [x] Employer forma za editovanje kompanije

---

## 🔲 Planirano / TODO

- [ ] Admin sub-stranice — refaktorisati u `AppShell` stil
- [ ] Mobilna responsivnost — testirati i popraviti na malim ekranima
- [ ] Deployment i testiranje na produkciji

---

## 🏛️ Arhitektura

| Komponenta | Putanja | Opis |
|---|---|---|
| `AppShell` | `src/components/AppShell.tsx` | Glavni layout wrapper (Sidebar + Navbar + Content) |
| `UnifiedNavbar` | `src/components/UnifiedNavbar.tsx` | Top navigacija za sve korisnike |
| Worker Profile | `src/app/profile/worker/page.tsx` | Profil radnika (3 taba) |
| Worker Edit | `src/app/profile/worker/edit/` | Editovanje profila (single-page) |
| Employer Profile | `src/app/profile/employer/page.tsx` | Profil poslodavca |
| Employer Jobs | `src/app/profile/employer/jobs/page.tsx` | Lista job request-ova |
| Profile Redirector | `src/app/profile/page.tsx` | Auto-redirect worker/employer |
| Admin | `src/app/admin/page.tsx` | Admin dashboard sa statistikama |
| Admin Candidates | `src/app/admin/candidates/page.tsx` | Lista svih korisnika |

---

## 📝 Napomene

- **NE KRPIMO** — svaka promena se radi kompletno, nema brzih zakrpa
- **Podaci su sačuvani** — sve refaktorisanje je samo vizuelno, baza i logika su isti
- **Supabase** je backend (auth + database + storage)
- **God Mode** — admin pristup preko `isGodModeUser()` funkcije
- **Cover/Profile foto** — namerno uklonjeni, fokus na čistom stilu
