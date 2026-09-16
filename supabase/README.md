# Supabase

Project: `nearmiss` (ref `shvpzhwpcgqnrcchgobf`, US East).

`migrations/` holds every change applied to the database, in order. File names match the
versions recorded in Supabase, so the Supabase CLI (`supabase db push`) sees them as already applied.

## What's in the database

- **profiles** (public to signed-in users) and **user_settings** (private). Both are created automatically on sign-up.
- **location_points → moments → near_misses**: raw time + place, clustered moments, and matches between two people.
  Near misses are read-only for the two people involved, and hidden until their delay has passed.
- **friendships** (including the shared "you met" date), **shared_photos**, **comments**, **read_state**,
  **activity**, **match_feedback**, **blocks**, **reports**, **hidden_zones**, **contact_hashes**.
- Storage buckets: `avatars` (public) and `shared-photos` (private; only the two people in a near miss can see them).
- Every table has row-level security on. Helper functions live in the `private` schema, which the API can't reach.

## One-time dashboard setup

1. **Email code sign-in:** Authentication → Emails → *Magic Link* template. Replace the body with:
   ```html
   <h2>Your Near Miss code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
2. **Sign in with Apple:** Authentication → Sign In / Providers → Apple → enable, and under *Client IDs* enter
   `com.poncheka.nearmiss,host.exp.Exponent` (the second one lets it work inside Expo Go). Leave the secret empty:
   the app uses Apple's native sign-in, which doesn't need one.
