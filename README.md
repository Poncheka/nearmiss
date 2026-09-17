# 📍 Near Miss

See every time you and your friends almost crossed paths, sometimes years before you met.

- **App:** React Native + Expo SDK 57 (TypeScript, Expo Router)
- **Backend:** Supabase (Postgres + PostGIS, Auth, Storage). See `supabase/README.md`.

## Run it on your phone

1. Install **Expo Go** from the App Store / Play Store.
2. In this folder:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android).

Press `w` in the terminal to open it in a browser instead.

Sign in with Apple, Google or an emailed link. While developing, "Look around with sample data" on the
welcome screen skips sign-in.

## When do I need a new build?

Only when **native** code changes: a new package with native code (`npx expo install ...` of a module like
location, camera or sign-in), or a change to `plugins` / `ios` / `android` in `app.json`.
Everything else (screens, logic, styling) reaches the installed app live from `npx expo start`,
or through the automatic update on push.

The development build includes every native module the MVP needs: photo library, one-time location
(for marking home/work), contacts, notifications, image picker, maps, clipboard, sharing, haptics,
share-card capture, Apple and Google sign-in.

## MVP scope

- Near misses come only from **photo history**. No background location, no "recent" near misses,
  and photos from the last 30 days are never matched (enforced in the database).
- **No public profiles.** A profile is visible only to friends and people you share a near miss with.
  Friends are found through hashed contacts (`find_contacts_on_app`).
- Email sign-in is a **magic link** that opens the app.

## Automatic updates (EAS Workflows)

- **Push to `main`** → `.eas/workflows/update-on-push.yml` sends an over-the-air update to installed test builds.
- **Push a tag like `v0.1.0`** (or start it on expo.dev) → `.eas/workflows/release-testflight.yml`
  builds the iOS app and sends it to TestFlight.

## Where things are

```
app/                    Screens (Expo Router: file name = route)
  (auth)/               welcome, email link sign-in
  (onboarding)/         scan → profile → find-friends
  (tabs)/               Invite, Near misses (timeline, center tab), You (settings)
  places.tsx            Hidden places (home, work, ...)
  activity.tsx          Bell → activity list
  reveal.tsx            "Maya just joined" reveal
  near-miss/[id].tsx    One near miss: map, photos, comments
  friend/[id].tsx       Friend page: timeline, "you met" date, shared photos
src/
  theme.ts              Colors, fonts, radii (the design system)
  components/           Buttons, cards, chips, avatars, maps, illustrations
  lib/supabase.ts       Supabase client
  lib/auth.tsx          Sign-in, profile, photo, settings (saved to Supabase)
  lib/photoScan.ts      Reads photo times/places, saves to location_points
  lib/places.ts         Hidden places (hidden_zones)
  state/scan.ts         The running scan, shared by onboarding and You
  data/mock.ts          Sample near misses and friends (replaced in steps 3–7)
  state/store.ts        Local state for the sample data (zustand)
```

## Build plan

1. ✅ All screens, clickable, on sample data
2. ✅ Auth + profiles + Supabase schema, automatic updates
3. ✅ Photo scan (real `expo-media-library`) → moments → upload, profile photo, hidden places
4. Contacts matching, invites, share sheet
5. Matching function, feed, near miss page, reveal
6. Photo sharing, comments, friend page
7. Activity, read state, push notifications, weekly report, feedback
8. (Background location and delay are out of the MVP)
9. Share card export, polish, App Store checklist

Sign-in, profiles, profile photos, settings, hidden places and the photo scan are real.
Contacts, friends, near-miss matching, the feed and comments are real too.
Shared photos, the activity bell and push notifications are still sample data.

### How matching works

`private.match_pair` (Supabase) pairs two people's photos taken within 15 minutes and 100m, one
near miss per pair per night, only for photos older than 30 days. It skips accounts that scanned the
same photo library, photos that exist in both libraries (AirDrop), and nights when the two were
clearly together. It runs when you scan, when two people become friends, and nightly at 10:00 UTC
(pg_cron job `nightly-near-miss-matching`).

### Website (nearmiss.io)

`docs/` is the coming-soon page, served by GitHub Pages (Settings → Pages → main, /docs).
Invite links (`nearmiss.io/i/<username>`) use `docs/404.html`. Waitlist sign-ups land in the
`waitlist` table.

### Checking a scan landed in the database

In the Supabase SQL editor:

```sql
select count(*), min(at), max(at) from location_points;  -- one row per photo with a place
select count(*) from moments;                             -- photos grouped by time and place
select label, radius_m from hidden_zones;
```
