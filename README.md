# 📍 Near Miss

See every time you and your friends almost crossed paths, sometimes years before you met.

- **App:** React Native + Expo SDK 57 (TypeScript, Expo Router)
- **Backend:** Supabase (Postgres + PostGIS, Auth, Storage, Edge Functions), coming in step 2

## Run it on your phone

1. Install **Expo Go** from the App Store / Play Store.
2. In this folder:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android).

Press `w` in the terminal to open it in a browser instead.

## Where things are

```
app/                    Screens (Expo Router: file name = route)
  (onboarding)/         welcome → profile → scan → find-friends
  (tabs)/               Near misses feed, Friends, You (settings)
  activity.tsx          Bell → activity list
  reveal.tsx            "Maya just joined" reveal
  near-miss/[id].tsx    One near miss: map, photos, comments
  friend/[id].tsx       Friend page: timeline, "you met" date, shared photos
src/
  theme.ts              Colors, fonts, radii (the design system)
  components/           Buttons, cards, chips, avatars, maps, illustrations
  data/mock.ts          Sample data (replaced by Supabase in step 2)
  state/store.ts        App state (zustand)
```

## Build plan

1. ✅ All screens, clickable, on sample data
2. Auth + profiles + Supabase schema, automatic deploys
3. Photo scan (real `expo-media-library`) → moments → upload
4. Contacts matching, invites, share sheet
5. Matching function, feed, near miss page, reveal
6. Photo sharing, comments, friend page
7. Activity, read state, push notifications, weekly report, feedback
8. Background location (development build), delay, hidden places
9. Share card export, polish, App Store checklist

Everything is currently sample data: there's no real sign-in or matching yet.
