# Opservor HQ — v1.3

9
Implementation of `Opservor-MVP-Spec-v1.3` (Founder Dashboard MVP). Next.js
(App Router) + Supabase, matching the spec's data model, Business Health
Score logic, and rule-based "Ask Opservor" panel exactly.

## What's built (maps to the spec)

| Spec section | Where |
|---|---|
| §4 Screens | `src/app/(dashboard)` — Dashboard and Data Entry are live; Fleet/Warehouse/Inventory/Finance/HR/Safety/Reports render "Coming soon" via `src/app/(dashboard)/[module]` |
| §5 Data model | `supabase/migrations/0001_init.sql`, mirrored in `src/lib/types.ts` |
| §6 Business Health Score | `src/lib/business-health.ts` |
| §7 Critical Alerts | `src/components/AlertsPanel.tsx` + `src/app/(dashboard)/actions.ts` |
| §8 Ask Opservor | `src/lib/ask-opservor.ts` (rule-based, no LLM call) + `src/app/api/ask-opservor/route.ts` |
| §9 Tech stack | Next.js / Supabase / Vercel, as specified |

Not built, on purpose: everything in §2 (multi-tenant, other roles, real
integrations, live LLM, mobile, billing). Nav items for the out-of-scope
modules exist and are visibly inert, per §4.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/migrations/0001_init.sql`. This creates
   the tables, RLS policies, and one seed `company` row.
3. In **Authentication → Users**, create the Founder's user (email +
   password). Copy their `User UID`.
4. In the SQL Editor, link that auth user to the seeded company:

   ```sql
   insert into app_user (auth_id, company_id, name, email)
   values (
     '<the User UID you copied>',
     (select id from company limit 1),
     'Ahsan',
     '<their email>'
   );
   ```

   (There's no self-serve signup in v1 — Founder is the only role, and
   there's only ever one company, so this one-time link-up is simpler than
   building a signup flow the spec doesn't call for.)

## 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
Supabase → Project Settings → API.

## 3. Run it

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, log in with the credentials from step 1.3.

## 4. Deploy (§9 / DoD "deployed and accessible from a browser")

Push to a Git repo, import it in [Vercel](https://vercel.com), and add the
same two env vars in the Vercel project settings. Free tier is enough for
MVP/pilot use, per the spec.

## Notes for whoever picks this up next

- **RLS is on and scoped by `company_id`** even though v1 is single-tenant —
  so flipping on multi-tenant later (§2, deferred) doesn't require touching
  the security model, just adding a way to create more `company` rows and
  users.
- **CSV import (v1.5, §4.5)**: the natural place to add it is a new route
  under `dashboard/entry` that parses a spreadsheet into the same
  `kpi_snapshot` / `category_score` shapes `actions.ts` already upserts —
  no schema change needed.
- **Live LLM Ask Opservor (v2, §8)**: swap the pattern-matching in
  `src/lib/ask-opservor.ts` for an API call, but keep gathering the same
  `AskOpservorContext` (latest KPI, latest category scores, open alerts)
  so the model has real numbers to answer from rather than hallucinating.
