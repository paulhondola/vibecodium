# Full Migration Plan: Auth0 + MongoDB + SQLite → Supabase

See the complete plan document: [auth0-to-supabase-migration.md](file:///Users/paulhondola/Developer/vibecodium/docs/superpowers/plans/auth0-to-supabase-migration.md)

## Summary

Consolidate **three separate data stores** into **one Supabase project**:

| Currently                                                                       | Replaced By                         |
| ------------------------------------------------------------------------------- | ----------------------------------- |
| Auth0 (`@auth0/auth0-react`)                                                    | `@supabase/supabase-js` on frontend |
| MongoDB (Mongoose) — Users, Tokens, HelpPosts, DeployedApps, Projects, Timeline | Supabase PostgreSQL tables          |
| SQLite (Drizzle) — projects, files, snapshots, sessions                         | Supabase PostgreSQL tables          |

## Key Design Decisions

1. **Frontend-direct auth** — Supabase JS handles OAuth, session, token refresh natively
2. **Postgres trigger** — `handle_new_user()` fires on `auth.users` INSERT/UPDATE to populate `public.users` with GitHub profile data + random fun bio/language/location
3. **Service-role client on backend** — replaces both Mongoose and Drizzle, single `supabase.from("table")` API
4. **Same `useAuth()` API shape** — drop-in replacement for `useAuth0()` across 14 files
5. **RLS on all tables** — proper security policies per table

## Scope

- **4 new files** (supabase client, auth context, migration SQL, server supabase client)
- **~20 modified files** (frontend auth swap + backend route rewrites)
- **10 deleted files** (Mongoose models, Drizzle schema, SQLite init, mongoose connector)

## Answered questions

1. **Supabase keys**: Need `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` from dashboard
2. **Fresh start confirmed** No data migration from existing MongoDB/SQLite
