# Supabase Isolated Database Tests Design

## Objective

Add a reproducible database test environment that applies every migration from
scratch and verifies the security and transactional guarantees of the financial
domain without connecting to a hosted Supabase project.

## Scope

The first database suite will verify:

1. all tracked migrations apply successfully to a clean local stack;
2. Row Level Security isolates financial records belonging to two authenticated
   users;
3. authenticated users cannot insert, update, or delete audit records directly;
4. confirming the same pending financial change twice is idempotent and creates
   only one domain record;
5. expired pending changes cannot create domain records and are marked expired;
6. confirmed domain changes produce the expected automatic audit entries.

The suite covers representative tables and RPCs rather than duplicating every
policy against every table. A failure in the representative flow must identify
whether the regression is in schema replay, RLS, RPC behavior, expiration, or
auditing.

## Architecture

The project will use the Supabase CLI as a development dependency and commit a
safe `supabase/config.toml`. Docker hosts an ephemeral local Supabase stack;
neither the application nor the tests receive hosted-project credentials.

Database tests live under `supabase/tests/database/` and use pgTAP. Each test
opens a transaction, creates deterministic users and fixtures, switches to the
`authenticated` role with `request.jwt.claim.sub`, asserts behavior, calls
`finish()`, and rolls back. Test files therefore remain independent and leave no
data behind.

The tests exercise SQL policies, triggers, constraints, and RPCs directly. They
do not mock `auth.uid()` or the persistence layer. The existing Vitest suite
continues to cover TypeScript domain and repository behavior; pgTAP owns database
semantics that require a real PostgreSQL/Supabase runtime.

## Local Workflow

The supported commands will be exposed as npm scripts:

- `npm run supabase:start` starts the local stack and applies migrations;
- `npm run supabase:reset` rebuilds the local database from all migrations;
- `npm run test:supabase` runs the pgTAP suite against the local stack;
- `npm run supabase:stop` stops local containers.

The reset command is explicitly local. No script will include `--linked`, run
`db push`, or accept a hosted database URL.

## Continuous Integration

The existing CI workflow gains a third, independent `supabase` job on
`ubuntu-latest`. It checks out the repository, installs the Supabase CLI with
the official setup action, starts the local stack, runs `supabase test db`, and
always stops the stack during cleanup.

The job requires Docker supplied by the GitHub-hosted runner but requires no
repository secrets. It runs for the same `push`, `pull_request`, and manual
workflow triggers as the quality and Playwright jobs.

## Test Data and Authentication

Each SQL test uses fixed UUIDs scoped to that transaction. Required rows in
`auth.users` are inserted before financial fixtures so foreign keys and the
profile trigger behave exactly as they do for real users.

Authenticated requests are represented by setting both the database role and
JWT subject for the transaction. Administrative fixture setup occurs before the
role switch. Assertions query through the authenticated role unless the test is
specifically inspecting side effects after the user action.

## Failure Handling

- Migration failures stop `supabase start` before tests execute.
- pgTAP plan mismatches or failed assertions return a non-zero exit code.
- Cleanup runs with an unconditional GitHub Actions step.
- Local Docker startup errors remain explicit; scripts do not fall back to the
  hosted project.

## Files

- `package.json`: project-scoped CLI dependency and local database scripts.
- `package-lock.json`: locked Supabase CLI version.
- `supabase/config.toml`: committed local project configuration without secrets.
- `supabase/tests/database/*.test.sql`: pgTAP security and workflow tests.
- `.github/workflows/ci.yml`: isolated database job.
- `.gitignore`: Supabase CLI transient directories.
- `README.md`: setup, commands, validation count, and completed Etapa 4 status.

## Non-goals

- No hosted Supabase project is reset, seeded, or queried.
- No production or staging credentials are added to GitHub.
- No browser-level authenticated onboarding flow is added in this stage.
- No exhaustive test is added for every financial action or every RLS policy.
- No application schema or business behavior is changed unless a failing
  database test exposes a genuine defect, which will require a migration and a
  regression assertion.

## Acceptance Criteria

- A clean local stack applies all migrations without manual SQL.
- The pgTAP suite passes locally and on GitHub Actions.
- Cross-user reads and writes are rejected by RLS in the representative flow.
- Direct audit-log mutation is rejected for authenticated users.
- Duplicate confirmation returns the stored result without duplicate records.
- Expired confirmation produces no domain record.
- Successful confirmation produces an audit record for the authenticated user.
- Existing lint, Vitest, build, and Playwright jobs remain green.
