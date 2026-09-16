# Supabase

Project: `nearmiss` (ref `shvpzhwpcgqnrcchgobf`, US East).

`migrations/` holds every change applied to the database, in order. File names match the
versions recorded in Supabase, so the Supabase CLI (`supabase db push`) sees them as already applied.

## What's in the database

- **profiles** (visible only to yourself, friends and near-miss matches) and **user_settings** (private). Both are created automatically on sign-up.
- **location_points → moments → near_misses**: raw time + place, clustered moments, and matches between two people.
  Photo history only. Near misses are read-only for the two people involved, and photos from the last 30 days are never matched.
- **friendships** (including the shared "you met" date), **shared_photos**, **comments**, **read_state**,
  **activity**, **match_feedback**, **blocks**, **reports**, **hidden_zones**, **contact_hashes**.
- Storage buckets: `avatars` (public) and `shared-photos` (private; only the two people in a near miss can see them).
- Every table has row-level security on. Helper functions live in the `private` schema, which the API can't reach.

## One-time dashboard setup

1. **Email sign-in links:** Authentication → URL Configuration → *Redirect URLs* → add
   `exp://**` (Expo Go while developing) and `nearmiss://**` (installed builds).
   The default "Magic link" email then opens the app signed in.
2. **Sign in with Apple:** Authentication → Sign In / Providers → Apple → enable, and under *Client IDs* enter
   `com.poncheka.nearmiss,host.exp.Exponent` (the second one lets it work inside Expo Go). Leave the secret empty:
   the app uses Apple's native sign-in, which doesn't need one.

## Before inviting other people

Supabase's built-in email only delivers to members of this Supabase account and is heavily rate-limited.
Before inviting testers, connect a custom SMTP provider (for example Resend, with our own domain) under
Authentication → Emails → SMTP. Custom SMTP also unlocks template editing (branding the sign-in email).

While testing in Expo Go, set **Site URL** to the `exp://…/--/auth-callback` address Expo prints.
In the installed app, set it to `nearmiss://auth-callback`.
