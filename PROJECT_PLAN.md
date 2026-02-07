# 🏗️ Workers United — Project Plan

> **Poslednje ažuriranje:** 2026-02-07  
> **Svrha:** Ovo je živi dokument koji prati šta radimo na projektu. Svaki chat i svaki računar treba da čita ovaj fajl da bi znao kontekst.

---

## 📌 Trenutni Fokus

Refaktorisanje celog sajta u **Facebook-stil** profil sistem. Svaki korisnik (radnik, poslodavac, admin) ima jedinstven profil sa istim layoutom.

---

## 🗣️ Diskusije i Zahtevi (Active Memory)
> **Ovde beležimo sve što se dogovorimo u chatu da ne zaboravimo.**

### 📐 Dizajn Filozofija (dogovoreno 07.02.2026)
- **Facebook DIZAJN, ne klon** — koristimo FB stil (kartice, boje, tipografiju) ali prilagođeno našim potrebama
- **NEMA socijalnih feature-ova** — nema prijatelja, pisanja na zidu, Like/Comment/Share
- **NEMA Home feed-a** — samo profil gde se unose podaci i dokumenta
- **Jednostavno** — profil → dokumenta → verifikacija → čekanje
- **Dashboard ima 3 taba**: Profile Info, Documents, Status

### 🆕 Protokol
- [x] Ažurirati `PROJECT_PLAN.md` na početku svakog chata sa novim zahtevima i statusom
- [x] Uvek uraditi `git pull` pre početka rada


## ✅ Završeno

### Facebook-Style Layout Refaktor (Feb 2026)
- [x] Kreiran `AppShell` komponenta — wrapper sa Sidebar, Navbar, Content Area
- [x] Kreiran `UnifiedNavbar` — zajednički navbar za sve korisnike
- [x] `/dashboard` (Worker) — koristi `AppShell`, text-only header, Tabs (Posts, About, Photos, Documents)
- [x] `/profile` (ProfileClient) — koristi `AppShell`, tabovi (Timeline, About, Jobs/Applications, Photos, Documents)
- [x] `/admin` — koristi `AppShell`, card-based stats, recent activity feed
- [x] `/employer/jobs` — koristi `AppShell`, card-based job listings
- [x] `/admin/candidates` — koristi `AppShell`, korisnik cards umesto tabele
- [x] Uklonjen Cover Photo i Profile Picture — čist text-only header na svim profilima
- [x] `/employer/dashboard` i `/employer/profile` — redirect na `/profile`

### Design System (Feb 2026)
- [x] Unified boje i tipografija kroz ceo sajt
- [x] Facebook-stil tabovi, Intro kartice, Feed items
- [x] Employer forma za editovanje kompanije (About tab)
- [x] Fix: Uklonjen dupli navbar (layout.tsx + AppShell), smanjen logo sa h-28 na h-10, sidebar 360→280px
- [x] Redesign: Dashboard kompletno prepisan — skinuti svi socijalni feature-ovi, dodat clean 3-tab profil (Profile Info, Documents, Status)

---

## 🔲 Planirano / TODO

- [x] Dodati funkcionalne tabove na `/dashboard` (About, Photos, Documents sada rade - koriste `DashboardClient`)
- [ ] Konekcija "Post a Job" dugmeta sa `/employer/jobs/new`
- [ ] Admin sub-stranice (`/admin/employers`, `/admin/jobs`, `/admin/queue`, `/admin/refunds`) — refaktorisati u `AppShell`
- [ ] Mobilna responsivnost — testirati i popraviti na malim ekranima
- [ ] Pravi post/feed sistem (ako se odlučimo za to)
- [ ] Deployment i testiranje na produkciji

---

## 🏛️ Arhitektura

| Komponenta | Putanja | Opis |
|---|---|---|
| `AppShell` | `src/components/AppShell.tsx` | Glavni layout wrapper (Sidebar + Navbar + Content) |
| `UnifiedNavbar` | `src/components/UnifiedNavbar.tsx` | Top navigacija za sve korisnike |
| Worker Dashboard | `src/app/dashboard/page.tsx` | Profil radnika sa FB stilom |
| Profile (oba tipa) | `src/app/profile/ProfileClient.tsx` | Klijentska komponenta za Worker/Employer profil |
| Admin | `src/app/admin/page.tsx` | Admin dashboard sa statistikama |
| Employer Jobs | `src/app/employer/jobs/page.tsx` | Lista job request-ova |
| Admin Candidates | `src/app/admin/candidates/page.tsx` | Lista svih korisnika |

---

## 📝 Napomene

- **Podaci su sačuvani** — sve refaktorisanje je samo vizuelno, baza i logika su isti
- **Supabase** je backend (auth + database + storage)
- **God Mode** — admin pristup preko `isGodModeUser()` funkcije
- **Cover/Profile foto** — namerno uklonjeni po zahtevu korisnika, fokus je na čistom FB stilu bez slika
