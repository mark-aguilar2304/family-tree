# Kinship — private family tree

An invitation-only, multi-workspace family genealogy app. Family members can
record people, complex parentage and partnerships, guardianships, and biography,
then explore the result as an interactive tree.

The product source of truth is [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

## Stack

- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS 4 and shadcn/ui
- Supabase PostgreSQL, Auth, RLS, and Storage
- React Flow (`@xyflow/react`) with Dagre layout
- Zod validation, Vitest unit tests, Playwright (smoke), PGlite RLS/domain tests

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and copy the environment file:

   ```bash
   cp .env.example .env
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
   `NEXT_PUBLIC_APP_URL` (for example `http://localhost:3000`). Never put a
   service-role or secret key in a `NEXT_PUBLIC_*` variable.

3. Apply the database migrations in order:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   Migrations live in `supabase/migrations/`:

   - `20261103142831_core.sql` — profiles, families, memberships, audit log
   - `20261103142834_invitations.sql` — hashed single-use invitations
   - `20261103142838_genealogy.sql` — people, names, parentage, partnerships,
     guardianships, claims, constraints, and domain RPCs
   - `20261103142841_rls.sql` — row-level security policies
   - `20261103142844_rpc.sql` — invitation acceptance and member-management RPCs
   - `20261103142847_storage.sql` — private `family-media` bucket foundation
   - `20261103143229_function_grants.sql` — least-privilege function grants
   - `20261103143311_rls_initplan.sql` — per-statement `auth.uid()` RLS evaluation

4. In the Supabase dashboard, enable email/password auth and add
   `<app-url>/auth/callback` to the allowed redirect URLs. Email confirmation is
   supported; confirm the address before signing in.

5. Start the app:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`, create an account, and create a workspace.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser-safe publishable/anon key |
| `NEXT_PUBLIC_APP_URL` | Yes in production | Exact app origin for auth and invitation links; required by `next build` in production |
| `RESEND_API_KEY` | No | Sends invitation emails through Resend |
| `INVITATION_FROM_EMAIL` | No | Verified Resend sender, for example `Kinship <invites@example.com>` |

The app never needs a service-role key. Keep any Supabase secret key out of
`NEXT_PUBLIC_*` variables and out of the deployment entirely.

Without Resend configuration, invitations still work: the members page returns
a copyable, single-use secure link. Only a SHA-256 hash of the token is stored.

There is no seed script. Create the first account and workspace through the UI.

## Roles and access

- **Owner** — full control, including ownership transfer and archiving.
- **Admin** — edits content, invites members, reviews claims, and manages most
  settings. Cannot grant admin, change another admin, or transfer ownership.
- **Contributor** — adds and edits people and relationships.
- **Viewer** — reads the tree and profiles.

Authorization is enforced twice: server actions check the signed-in user,
workspace membership, role, and record ownership; PostgreSQL RLS enforces the
same boundaries for every query. Multi-table operations use narrow
`SECURITY DEFINER` RPCs.

## Tests

```bash
npm run typecheck
npm run lint
npm test              # Vitest unit tests
npm run test:rls      # PGlite PostgreSQL + RLS/domain suite
npm run build
```

`npm run test:rls` needs no Docker or local PostgreSQL. It applies the SQL
migrations to an in-memory PGlite database with Supabase auth stubs and checks
workspace isolation, role limits, invitations, relationship validation, claims,
audit access, archiving, and ownership transfer.

Playwright smoke tests require a running app and installed browser:

```bash
npx playwright install chromium
npm run test:e2e
```

Set `E2E_BASE_URL` to test an already-running deployment. The default config
starts `npm run dev` on port 3000. Hosted end-to-end flows need a real Supabase
project with the migrations applied and confirmed test users.

## Deploy to production

Production: <https://family-tree-alpha-mauve.vercel.app> (Vercel, deployed
2026-11-04). The public smoke tests pass. Email confirmation and password reset
remain blocked until the Supabase URL, SMTP, and template settings below are
applied to the hosted project; its current Site URL is still
`http://localhost:3000`.

The checklist below is what was used and what remains for a fresh environment.
The milestone is only fully done when the deployed app passes the smoke tests
and the email flows work against the production origin.

### 1. Supabase

1. Create a production Supabase project.
2. Link and push the migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

3. Confirm the private `family-media` bucket exists under Storage and that
   public access is off. The storage migration creates it.
4. Authentication → URL configuration:
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/callback` and
     `https://<your-domain>/auth/confirm`
   - Add Vercel preview URLs only if preview sign-in is needed.
5. Authentication → Providers: enable Email and keep "Confirm email" on.
6. Authentication → SMTP: configure custom SMTP. Supabase's built-in email
   service is rate-limited and not intended for production.
7. Authentication → Email templates: use the token-hash links handled by
   `src/app/auth/confirm/route.ts`.
   - Confirm signup:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
   - Reset password:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

   Invitation links are separate. After confirming a new account created from
   an invitation, reopen the invitation link from the invitation email.

### 2. Vercel

1. Import the repository and keep the Next.js preset.
2. Set these environment variables for Production (and Preview if used):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_APP_URL` — the exact `https://` origin; the production build
     fails without it
   - `RESEND_API_KEY` and `INVITATION_FROM_EMAIL` only if sending invitation email
3. Deploy. Do not add a service-role key; the app does not use one.

### 3. Verify

```bash
E2E_BASE_URL=https://<your-domain> npm run test:e2e
```

PowerShell: `$env:E2E_BASE_URL="https://<your-domain>"; npm run test:e2e`

Then check by hand:

- Sign up, confirm the email, sign in, and create a workspace.
- Add a person and open the tree.
- Invite a second account and accept the link in a private window.
- Confirm responses include the headers from `next.config.ts`:
  `content-security-policy`, `strict-transport-security`,
  `x-content-type-options`, `x-frame-options`, `referrer-policy`, and
  `permissions-policy`.
- Confirm a signed-out request to `/dashboard` redirects to `/login`, and that
  an anonymous Supabase query returns no rows.
- Confirm the `family-media` bucket is private.

Deployment record: `https://family-tree-alpha-mauve.vercel.app` — 5/5
Playwright smoke tests passed on 2026-11-04. Roll back through Vercel's
deployment history if needed; migrations are forward-only, so review them
before pushing.

## Current scope

Included in this MVP: authentication, multiple workspaces, people and alternate
names, five parentage types, multiple partnerships with historical statuses,
guardianships, derived siblings, living-person account claims, members and
invitations, audit activity, and the interactive tree with search, focus modes,
branch collapse, and a text-list alternative.

Not included yet: media upload UI (the private bucket and policies exist),
hard deletion of people or workspaces (archive only), and automated hosted
integration tests that need Supabase credentials.
