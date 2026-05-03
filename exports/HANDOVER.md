# Cleya.ai Mobile — Handover Document

**For:** Continuing development in Rork and publishing to the App Store / Play Store.
**Source archive:** `cleya-mobile-source.tar.gz`
**Date:** May 2026

---

## 1. What this is

Cleya.ai's mobile app — a React Native app built with **Expo SDK 52** + **expo-router 4** (file-based routing) + **TypeScript**. Single codebase compiles to both iOS and Android. The app is a thin client that talks to the Cleya.ai backend (Node/Express) over HTTPS.

The app covers: authentication, onboarding, profile management, AI-powered match discovery, introductions, in-app messaging, and settings.

---

## 2. Tech stack at a glance

| Layer | Choice | Why it matters for Rork |
|---|---|---|
| Framework | Expo SDK 52 | Rork is built on Expo — direct compatibility |
| Routing | expo-router 4 (file-based, like Next.js) | All screens live in `app/` directory |
| Language | TypeScript (strict) | `tsconfig.json` included |
| Auth | `@clerk/clerk-expo` | Needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| Data | `@tanstack/react-query` v5 | Server-state caching layer |
| Styling | Inline styles + `constants/colors.ts` design tokens | No external CSS framework |
| Fonts | `@expo-google-fonts/inter` | Loaded in `app/_layout.tsx` |
| Storage | `expo-secure-store` | Auth token kept in OS keychain |
| Other native | gesture-handler, reanimated, safe-area-context, keyboard-controller, haptics | All listed in `package.json` |

---

## 3. Source structure

```
mobile/
├── app.json                    ← Expo config: name, bundle IDs, plugins, scheme
├── package.json                ← Dependencies + npm scripts
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── expo-env.d.ts
│
├── app/                        ← All screens (file-based routes)
│   ├── _layout.tsx             ← Root layout: providers (Clerk, ReactQuery, Auth)
│   ├── index.tsx               ← Splash/redirect logic
│   │
│   ├── (auth)/                 ← Unauthenticated routes group
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── join.tsx            ← Invite-code join flow
│   │   ├── forgot-password.tsx
│   │   ├── reset-password.tsx
│   │   └── verify-email.tsx
│   │
│   └── (tabs)/                 ← Authenticated tab navigation
│       ├── _layout.tsx         ← Bottom tab bar
│       ├── index.tsx           ← Home / dashboard
│       ├── matches.tsx         ← Match list + accept/decline
│       ├── introductions.tsx   ← Active intros
│       ├── messages.tsx        ← DM list
│       ├── chat.tsx            ← Chat detail screen
│       ├── profile.tsx         ← Edit profile
│       └── settings.tsx        ← Notification prefs, account
│
├── components/
│   ├── ClerkContinueButton.tsx
│   └── ClerkSignOutBridge.tsx  ← Bridges Clerk session → AuthContext
│
├── contexts/
│   └── AuthContext.tsx         ← Global auth state + token mgmt
│
├── lib/
│   ├── api.ts                  ← Backend API client (all HTTP calls)
│   ├── query-client.ts         ← React Query setup
│   ├── clerkBridge.ts          ← Sync Clerk JWT → backend session
│   ├── clerkTokenCache.ts      ← SecureStore cache for Clerk tokens
│   └── displayScore.ts         ← Match-score formatter
│
├── constants/
│   └── colors.ts               ← Design tokens (dark mode palette)
│
└── assets/
    └── images/                 ← icon.png, splash assets
```

---

## 4. App identity

These come from `app.json` — change only if you want to fork to a new bundle.

| Field | Value |
|---|---|
| App name | `Cleya.ai` |
| Slug | `cleya-mobile` |
| Scheme (deep links) | `cleya://` |
| iOS bundle identifier | `ai.cleya.mobile` |
| Android package | `ai.cleya.mobile` |
| Tablet support | Yes (iPad) |
| Theme | Dark (`userInterfaceStyle: "dark"`) |
| Splash background | `#0F172A` |
| New Architecture | Enabled (`newArchEnabled: true`) |

---

## 5. Environment variables (required to run)

Set these as Expo public env vars (`EXPO_PUBLIC_*` so they're inlined at build time). In Rork, set them in the project settings; for EAS Build, use `eas.json` env or `eas secret:create`.

| Variable | Required | What it does |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | Cleya backend URL (e.g. `https://api.cleya.ai`). Defaults to localhost in dev. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (starts with `pk_live_…` or `pk_test_…`). Get from Clerk dashboard. |

The app reads these in:
- `lib/api.ts` (line ~ where `EXPO_PUBLIC_API_URL` is referenced)
- `app/_layout.tsx` (line 24: `CLERK_PUBLISHABLE_KEY`)

**Important:** the app expects the Cleya backend at the configured URL. Keep that backend running (the `apps/backend/` Express app — already deployed on Replit, currently at the `.replit.app` domain). The mobile app does **not** include the backend.

---

## 6. Backend dependency

This mobile app is a thin client. It will not work without the backend. The backend lives separately in the Cleya monorepo at `apps/backend/` and exposes a REST API + WebSocket. Endpoints used by mobile (non-exhaustive):

- `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/clerk-bridge`
- `GET/PATCH /api/profile`
- `POST /api/ai/bio` (5/day rate limit)
- `GET /api/matches`, `POST /api/matches/:id/respond`
- `GET /api/introductions`
- `GET/POST /api/messages`, `GET /api/conversations`
- `GET/POST /api/notifications`, `PATCH /api/communication-preferences`

If you're publishing the mobile app to stores, the backend must be reachable from outside (i.e. deployed at a stable HTTPS URL — your Replit deploy URL works).

---

## 7. Importing into Rork

Rork runs Expo apps natively. Steps:

1. **Extract the archive:**
   ```bash
   tar -xzf cleya-mobile-source.tar.gz
   ```
2. **Create a new Rork project** (or "Import from existing source" if Rork supports it — check their docs).
3. **Upload the entire `mobile/` folder** as the project root.
4. **Set environment variables** in Rork project settings:
   - `EXPO_PUBLIC_API_URL` → your backend URL
   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` → your Clerk key
5. **Install dependencies** — Rork should run `npm install` automatically based on `package.json`. If not, trigger it manually.
6. **Run the dev preview** — Rork should serve the Expo dev server. Scan the QR with Expo Go on your phone, or use Rork's built-in preview.

If Rork asks about workflow type, choose **"Managed (Expo)"** — keep it that way unless you have a specific need for native code (which would require ejecting to bare workflow).

### One package-version note for Rork

When you boot the project, Expo will warn:
```
@expo/vector-icons@14.1.0 - expected version: ~14.0.4
expo-status-bar@2.2.3 - expected version: ~2.0.1
```
These are minor mismatches from the monorepo. Run `npx expo install --check` and let it auto-fix the versions. Won't break anything.

---

## 8. Publishing to the App Store + Play Store

You don't need a Mac. Use **EAS Build** (Expo Application Services).

### One-time setup

```bash
npm install -g eas-cli
eas login                                    # use your Expo account
cd mobile
eas build:configure                          # generates eas.json (if not present)
```

### Apple side (one-time)

1. Enroll in **Apple Developer Program** ($99/year) — https://developer.apple.com
2. In App Store Connect → My Apps → "+" → New App
   - Bundle ID: `ai.cleya.mobile`
   - Name: `Cleya.ai`
   - SKU: `cleya-mobile`
3. EAS handles certificates and provisioning profiles automatically — no manual signing needed.

### Google side (one-time)

1. Create a **Google Play Console** account ($25 one-time)
2. Create new app: `Cleya.ai`, package `ai.cleya.mobile`
3. Generate a service account JSON for Play uploads (instructions in EAS docs).

### Build & submit

```bash
# iOS
eas build --platform ios --profile production
eas submit --platform ios --latest             # uploads to TestFlight → App Store

# Android
eas build --platform android --profile production
eas submit --platform android --latest         # uploads to Play Console
```

Builds run in EAS cloud (15–25 min). Output is a `.ipa` for iOS and `.aab` for Android — both signed and ready for the stores.

### Required store assets

You'll need to provide (App Store Connect / Play Console UI):
- **App icon** — 1024×1024 PNG (already in `assets/images/icon.png`, may need higher-res)
- **Screenshots** — at least 3 per device size (iPhone 6.7", iPhone 5.5", iPad 12.9" for iOS; phone + 7" tablet + 10" tablet for Android)
- **App description, keywords, category** ("Business" or "Social Networking")
- **Privacy policy URL** — required by both stores. Cleya already has one at https://cleya.ai/privacy (verify URL).
- **Support URL & marketing URL**
- **Age rating questionnaire** answers
- **iOS:** App Privacy section (declare data collection — Clerk auth, profile data, etc.)
- **Android:** Data safety form (same disclosures)

### Review timelines

- **iOS:** typically 24–48 hours, can be 7+ days if rejected for revision
- **Android:** typically a few hours, occasionally 1–2 days for first submission

---

## 9. Pre-launch checklist

Things to verify before submitting to either store:

- [ ] All screens load against the **production** backend URL (not localhost)
- [ ] Clerk is in **production mode** (use `pk_live_*` not `pk_test_*`)
- [ ] App icon is 1024×1024 with no transparency, no rounded corners (Apple adds them)
- [ ] Splash screen displays correctly on iPhone notched + Android edge-to-edge
- [ ] Deep links work — open `cleya://matches` from a browser; should open the app to the matches tab
- [ ] Sign up → onboarding → see first match → accept it (full happy path on a real device)
- [ ] Sign out clears the SecureStore token (verify by reopening the app)
- [ ] WhatsApp opt-in/opt-out toggles persist (on Settings tab)
- [ ] Push notifications — **not yet integrated**; if you want them, add `expo-notifications` and wire up Expo Push Tokens
- [ ] Privacy policy + terms URLs are reachable
- [ ] No hard-coded `console.log`s leaking sensitive data
- [ ] Test on iOS 16+ and Android 8+ (the minimums Expo SDK 52 supports)

---

## 10. Known gaps + future work

The mobile app is feature-complete for v1 but a few things are explicitly **not** implemented and may be worth adding before a public launch:

| Gap | Impact | Fix effort |
|---|---|---|
| Push notifications | Users only see in-app notifications | Add `expo-notifications`, register token, update backend `notification` route to send via Expo Push API |
| Offline mode | Hard fails when network is down | Add React Query persistence + retry-on-reconnect; show offline banner |
| Image upload (avatar) | Profile avatar relies on backend setting | Add `expo-image-picker` + upload to `/api/files` endpoint |
| Universal Links | Only `cleya://` deep links work, not `https://cleya.ai/*` | Add `associatedDomains` in `app.json` + Apple `apple-app-site-association` file on the web domain |
| In-app analytics | Backend has PostHog, mobile doesn't yet emit events | Add `posthog-react-native`, wire into key flows |
| Biometric auth | Re-prompt password on app open | Add `expo-local-authentication` for FaceID/TouchID unlock |

---

## 11. Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| Blank screen on launch | `EXPO_PUBLIC_API_URL` not set or backend unreachable |
| "Authentication failed" loops | Clerk publishable key is wrong env (test vs live mismatch) |
| Tabs not showing | User is unauthenticated — auth flow redirects to `(auth)/login` |
| Build fails on `pod install` | Run `npx expo install --fix` then retry; usually a version mismatch |
| Android build fails on Gradle | Check JDK version (need 17+); EAS handles this in cloud |
| App rejected by Apple for "missing privacy policy" | Add the URL in App Store Connect → App Privacy |

---

## 12. Useful links

- **Expo docs:** https://docs.expo.dev
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **EAS Submit:** https://docs.expo.dev/submit/introduction/
- **Clerk Expo:** https://clerk.com/docs/quickstarts/expo
- **App Store Connect:** https://appstoreconnect.apple.com
- **Play Console:** https://play.google.com/console
- **Rork:** https://rork.com (their docs for Expo project import)

---

## 13. Contact / handoff context

- **Project owner:** Jivraj (jivraj@cleya.ai)
- **Backend repo:** Same monorepo as this mobile app, in `apps/backend/`
- **Backend deploy:** Replit (currently on a `.replit.app` domain)
- **Auth provider:** Clerk (separate dashboard)
- **Database:** PostgreSQL (Replit-managed) with Prisma ORM
- **AI provider:** OpenAI (gpt-4o-mini for chat + bio generation)

If you (or whoever's continuing the build in Rork) need to update the backend URL the mobile app points at, it's a single environment variable — no code changes required.

Good luck with the launch.
