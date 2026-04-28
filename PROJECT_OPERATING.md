# Workers United — Project Operating File

> Created: 2026-04-28  
> Local path: `/mnt/ssd2/projects/github/b0r1v0j3/Workers-United`  
> Remote: `https://github.com/b0r1v0j3/Workers-United`

## Jedna rečenica

**Workers United je tvoja firma/platforma za vize, radnike, agencije i poslodavce: web app + Supabase + WhatsApp/email AI kanal + dokumenti + plaćanja.**

## Biznis kontekst

- Ovo je realan business projekat, ne demo.
- Glavni cilj je operativni tok: kandidat/worker → profil/dokumenti → komunikacija → matching/agency/employer → plaćanje/status.
- Site je na engleskom za korisnike; interna dokumentacija (`AGENTS.md`) je na srpskom.

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase Postgres/Auth/Storage
- Stripe za plaćanja
- WhatsApp Cloud API + email kanal
- OpenAI/Claude/Gemini delovi po postojećoj arhitekturi
- Vercel deploy sa `main`
- Vitest + ESLint + TypeScript checks

## Source of truth

Pre rada pročitati ovim redom:

1. `AGENTS.md` — ogroman, ali glavni izvor istine
2. `CLAUDE.md` — brzi kontekst
3. `.agent/workflows/project-architecture.md` ako task dira arhitekturu
4. `package.json` scripts
5. relevantne rute/komponente/testove

## Lokalni rad

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

Supabase types:

```bash
npm run db:types
```

## Security stanje

- `.supabase-token` je uklonjen iz git istorije i dodat u `.gitignore`.
- Ne vraćati lokalne tokene u repo.
- Svi credentials ostaju u `.env.local` ili platform secrets.

## Kako agent treba da radi ovde

1. Ne raditi polovične feature-e. Ako se dira flow, proveriti sve relevantne forme, email template-e, notifikacije i admin prikaze.
2. Kod svake promene razmisliti o Supabase šemi, RLS, email/WhatsApp side effect-ima i Stripe/webhook posledicama.
3. Ako se menja arhitektura ili env varijable, ažurirati `AGENTS.md` i/ili `.agent/workflows/project-architecture.md`.
4. Posle promene uvek predložiti unapređenje: UX, sigurnost, operativni tok, performanse ili monitoring.
5. Za public repo: nikad ne commitovati `.env*`, tokene, dumpove, logove ili output foldere.

## Ne dirati bez eksplicitne odluke

- Ne menjati pricing/Stripe live tokove bez posebne potvrde.
- Ne menjati WhatsApp webhook semantiku bez testiranja end-to-end.
- Ne dekriptovati lokalne deploy tokene kroz ad-hoc PowerShell.

## Sledeći pametni koraci

1. Uraditi sigurnosni sweep za javni repo: logovi, dumpovi, PDF-ovi, token-like strings, output folderi.
2. Napraviti “daily ops” komandu/proceduru za stanje worker-a, email/WhatsApp kanala, Stripe i Supabase greške.
3. Uvesti jasne smoke testove za najbitnije tokove: signup, dokument upload, payment, WhatsApp inbound, email inbound.
4. Razdvojiti public marketing/site od osetljivih operational/debug artefakata ako repo nastavi da bude public.
