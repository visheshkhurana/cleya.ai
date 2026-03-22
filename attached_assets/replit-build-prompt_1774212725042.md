# Cleo.ai — Complete Build Prompt for Replit AI Agent

## PROJECT OVERVIEW

Rebuild and upgrade the existing AI-powered professional networking platform at https://github.com/visheshkhurana/boardy-ai-platform into **Cleo.ai** — an AI superconnector for India's startup ecosystem.

**What it does:** Cleo is an AI that connects founders, investors, and talent through intelligent matching and warm introductions. Users onboard via conversational AI chat, get matched with relevant people, and Cleo facilitates double-opt-in warm introductions with personalized context.

**Current stack (keep):** Next.js, Node.js/Express, PostgreSQL, Prisma, pgvector, OpenAI GPT-4o-mini, Twilio, TailwindCSS

**Brand:** Dark navy (#0F172A) backgrounds, teal (#0D9488) accent color, clean modern UI.

---

## PHASE 1: CRITICAL BUG FIXES (Do These First)

Before building new features, fix these existing bugs:

### 1. Add Full Name to Registration
The signup modal currently only has email + password + terms. Add a "Full Name" field (required, text input) as the first field. Store in User model.

### 2. Fix Password Validation
- Add `minLength={8}` to the password input
- Add client-side validation: show error "Password must be at least 8 characters" before form submission
- Add server-side validation in the register API endpoint: if password < 8 chars, return 400 with `{ error: "Password must be at least 8 characters" }` — NEVER return 500

### 3. Fix Fake Hero Statistics
The landing page hero stats section currently shows randomized numbers on every page load. Replace with one of these approaches:
- **Option A (preferred):** Query the actual database for real counts: `SELECT COUNT(*) FROM users`, `SELECT COUNT(*) FROM introductions`, etc.
- **Option B (if numbers are too small):** Replace the stats section with qualitative text: "Join a growing community of founders, investors, and operators building India's future."

### 4. Fix Profile Edit Validation
Currently, users can clear required fields and save successfully. Add:
- Client-side: required attribute on key fields (Current Role, Company Name, etc.)
- Server-side: Validate required fields in PUT /api/profile — return 400 if empty

### 5. Fix /find-matches 404
The dashboard "Find Matches" button links to `/find-matches` which returns 404. Change the link to point to `/matches` instead.

### 6. Fix Data Persistence Bugs
- Phone number entered during onboarding must appear in Settings page
- Investor fund name from onboarding must appear in Edit Profile > Investor Details
- "Preferred Role" field for Talent persona must persist after save + refresh

### 7. Fix Dashboard Stale Stats
After a user connects/passes on a match, dashboard stats (Pending Review, Total Matches) must update when navigating back. Use React state management (SWR or React Query) with cache invalidation on match actions.

### 8. Add /login Route
Currently `/login` returns 404. Add a route that renders the login modal or redirects to `/?login=true`.

### 9. Fix Auth Guard Messages
Protected routes (/dashboard, /profile, /chat, /matches) currently redirect silently to homepage. Instead:
- Redirect to `/?login=true&next=/dashboard`
- Show toast/banner: "Please log in to access this page"

### 10. Add Mobile Hamburger Menu
At viewport width < 768px, collapse the nav into a hamburger menu icon. The slide-out drawer should include: Home, Log In / Get Started (if unauthenticated) or Dashboard, Matches, Chat, Profile, Settings, Sign Out (if authenticated). Ensure all tap targets are >= 44px.

---

## PHASE 2: CORE NEW FEATURES

### Feature 1: Persona Selection at Registration

Update the registration modal to include a persona selector after the name field:

```
Full Name: [text input, required]
Email: [email input, required]
Password: [password input, min 8 chars, required]
I am a: [Founder] [Investor] [Talent/Operator]  ← styled as 3 clickable cards/chips
☐ I agree to Terms of Service and Privacy Policy
[Get Started →]
```

Store persona on User model: `persona: FOUNDER | INVESTOR | TALENT`

### Feature 2: Onboarding Progress Indicator

Add a progress bar or step counter at the top of the chat onboarding page:

```
Step 2 of 5 ━━━━━━━━━━━━━━━━━━━━━░░░░░░░░
```

The steps are:
1. Welcome + Persona confirmation
2. Profile details (persona-specific form)
3. Goals/Priority
4. Additional details (industries, location, contact)
5. Referral source + Completion

### Feature 3: Personalized Match Reasoning

**This is critical.** Currently all matches show the same generic text: "You both have complementary backgrounds and interests in the startup ecosystem."

Replace this with AI-generated, specific reasoning for each match. When generating matches, call OpenAI to produce a 2-3 sentence explanation:

```javascript
const prompt = `You are Cleo, an AI networking assistant. Explain in 2-3 sentences why these two people should connect. Be specific — mention actual details from their profiles.

Person 1: ${user1.name}, ${user1.title} at ${user1.company}. ${user1.bio}. Industries: ${user1.industries}. Looking for: ${user1.goal}.

Person 2: ${user2.name}, ${user2.title} at ${user2.company}. ${user2.bio}. Industries: ${user2.industries}. Looking for: ${user2.goal}.

Write a concise, specific reason they should connect. Reference actual details from both profiles.`;
```

Store the reasoning in the Match model's `reasoning` field.

### Feature 4: Match Score Redesign

Replace raw percentage scores (30%, 34%) with qualitative labels:
- 80%+ → "Strong Match" (teal badge)
- 60-79% → "Good Fit" (blue badge)
- 40-59% → "Possible Fit" (gray badge)
- Below 40% → Don't show these matches

Do NOT display the raw percentage to users.

### Feature 5: Warm Introduction Engine

**This is the most important new feature.** When both users "Connect" on a match (double-opt-in), trigger a warm introduction flow:

1. **Generate intro text** using OpenAI:
```javascript
const prompt = `You are Cleo, an AI superconnector. Write a warm introduction email connecting these two professionals. The tone should be warm, specific, and helpful — like a well-connected friend making an intro.

Person 1: ${user1.name}, ${user1.title} at ${user1.company}. ${user1.bio}. Goal: ${user1.goal}.
Person 2: ${user2.name}, ${user2.title} at ${user2.company}. ${user2.bio}. Goal: ${user2.goal}.

Format:
"Hi [Person1 first name] and [Person2 first name],

I'd love to connect you two. [2-3 sentences explaining why they should know each other, referencing specific details from both profiles].

I'll let you two take it from here!"

Keep it under 100 words. Be specific and reference real details.`;
```

2. **Both users see a preview** of the intro on a new "Pending Introductions" page. They can approve or edit before sending.

3. **On approval, send via email** using Resend or the email service configured. Send to both users in one email (CC both).

4. **7-day follow-up**: Schedule a follow-up message: "How did your conversation with [name] go?" with buttons:
   - "Great meeting — we're talking next steps"
   - "Good chat — staying in touch"
   - "We didn't end up meeting"
   - "Not a great fit"

Store the outcome on the Introduction model.

**Database model:**
```prisma
model Introduction {
  id            String   @id @default(cuid())
  matchId       String
  match         Match    @relation(fields: [matchId], references: [id])
  introText     String
  status        IntroStatus @default(PENDING_APPROVAL)
  sentAt        DateTime?
  followUpAt    DateTime?
  outcome       String?
  outcomeNotes  String?
  createdAt     DateTime @default(now())
}

enum IntroStatus {
  PENDING_APPROVAL
  APPROVED
  SENT
  FOLLOWED_UP
  COMPLETED
}
```

**UI for Introductions:**
- New nav item: "Introductions" (between Matches and Profile)
- Shows list of all intros with status badges
- Each intro card shows: both users, intro text preview, status, date
- Action buttons: "Approve & Send" / "Edit" / "Cancel"

### Feature 6: Invite System

Add an invite/referral system:

**Database:**
```prisma
model InviteCode {
  id            String   @id @default(cuid())
  code          String   @unique
  creatorId     String
  creator       User     @relation("CreatedInvites", fields: [creatorId], references: [id])
  usedById      String?
  usedBy        User?    @relation("UsedInvite", fields: [usedById], references: [id])
  createdAt     DateTime @default(now())
  usedAt        DateTime?
}
```

**Logic:**
- On registration completion, generate 3 unique invite codes (8-char alphanumeric) for the user
- Display invite codes on dashboard in a "Share Cleo" card:
  ```
  🎟️ Your Invite Codes (3 remaining)
  ┌─────────────────────────────────┐
  │ cleo.ai/join/A8F3K2M1  [Copy]  │
  │ cleo.ai/join/B9G4L3N2  [Copy]  │
  │ cleo.ai/join/C0H5M4P3  [Copy]  │
  └─────────────────────────────────┘
  Share with founders, investors, or talent you think should be on Cleo.
  ```
- When someone visits an invite link, the signup page shows: "Arjun Mehta invited you to Cleo" with the inviter's name and title
- On successful signup via invite code, mark the code as used and credit the inviter
- Add `invitedBy` field to User model (references the inviter's userId)
- Add a `credits` integer field to User model (incremented on successful invite)

### Feature 7: Activity Feed on Dashboard

Replace the static dashboard with a live activity feed. Add a timeline section:

```
📊 Your Activity
─────────────────
🟢 New match found — Priya Sharma, Partner at Horizon Ventures
   2 hours ago

✅ Introduction approved — You and Arjun are now connected
   Yesterday

🎟️ Rahul Dev joined Cleo using your invite code
   2 days ago

📊 Weekly: You had 3 new matches and 1 successful intro this week
   3 days ago
```

**Database:**
```prisma
model Activity {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // MATCH_FOUND, INTRO_SENT, INTRO_ACCEPTED, INVITE_USED, WEEKLY_SUMMARY
  title     String
  metadata  Json?
  createdAt DateTime @default(now())
}
```

Create activities when: new match generated, intro sent, intro approved, invite code used, weekly summary.

### Feature 8: Real Admin Stats for Landing Page

Create an API endpoint `GET /api/stats/public` that returns real platform metrics:

```javascript
{
  memberCount: 127,        // SELECT COUNT(*) FROM users WHERE profileComplete = true
  introductionCount: 45,   // SELECT COUNT(*) FROM introductions WHERE status = 'SENT'
  meetingCount: 28,        // SELECT COUNT(*) FROM introductions WHERE outcome IS NOT NULL
  matchCount: 312          // SELECT COUNT(*) FROM matches
}
```

Use these in the landing page hero section. If memberCount < 100, show qualitative text instead of numbers.

---

## PHASE 3: ENHANCED FEATURES

### Feature 9: Trust Layer — Vouches

After a successful introduction (outcome recorded), both users can vouch for each other.

```prisma
model Vouch {
  id         String   @id @default(cuid())
  fromUserId String
  toUserId   String
  fromUser   User     @relation("VouchesGiven", fields: [fromUserId], references: [id])
  toUser     User     @relation("VouchesReceived", fields: [toUserId], references: [id])
  createdAt  DateTime @default(now())
  @@unique([fromUserId, toUserId])
}
```

- Add `vouchCount` to user profile display and match cards
- Show a "Vouch" button on the intro follow-up screen (after recording outcome)
- On match cards, show: "✓ Vouched by 5 members"
- Show mutual connections: "You both know 3 people on Cleo" — query users who are connected to both

### Feature 10: Deal Room

After mutual connect (intro sent), unlock a Deal Room for the founder-investor pair.

- New page: `/deal-room/[matchId]`
- Founder sees: Upload Pitch Deck (PDF), Add Key Metrics form (MRR, Growth Rate, Burn Rate, Runway), Add One-Liner
- Investor sees: Read-only view of all materials + "Schedule Call" button (links to founder's Calendly URL if set, otherwise opens email compose)
- Track page views: When investor opens the deal room, log timestamp and duration

### Feature 11: Notification Preferences

In Settings, add a Notifications section:

```
📬 Notification Preferences
──────────────────────────
☑ New match notifications (WhatsApp)
☑ Introduction updates (WhatsApp)
☑ Weekly digest (WhatsApp, every Monday)
☐ New match notifications (Email)
☑ Introduction updates (Email)
☐ Weekly digest (Email)
```

Store preferences on user profile and respect them in all notification-sending code.

---

## DATABASE SCHEMA (Complete Prisma Schema)

Here is the complete Prisma schema. Update the existing schema to include all new models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Persona {
  FOUNDER
  INVESTOR
  TALENT
}

enum MatchStatus {
  PENDING
  CONNECTED
  PASSED
  EXPIRED
}

enum IntroStatus {
  PENDING_APPROVAL
  APPROVED
  SENT
  FOLLOWED_UP
  COMPLETED
  CANCELLED
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  passwordHash    String
  persona         Persona
  emailVerified   Boolean   @default(false)
  profileComplete Boolean   @default(false)
  credits         Int       @default(0)
  invitedById     String?
  invitedBy       User?     @relation("InviteChain", fields: [invitedById], references: [id])
  invitees        User[]    @relation("InviteChain")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  founderProfile  FounderProfile?
  investorProfile InvestorProfile?
  talentProfile   TalentProfile?
  
  matchesAsUser1   Match[]        @relation("MatchUser1")
  matchesAsUser2   Match[]        @relation("MatchUser2")
  chatMessages     ChatMessage[]
  activities       Activity[]
  createdInvites   InviteCode[]   @relation("CreatedInvites")
  usedInvite       InviteCode?    @relation("UsedInvite")
  vouchesGiven     Vouch[]        @relation("VouchesGiven")
  vouchesReceived  Vouch[]        @relation("VouchesReceived")
  
  // Notification preferences
  whatsappNotifyMatches  Boolean @default(true)
  whatsappNotifyIntros   Boolean @default(true)
  whatsappWeeklyDigest   Boolean @default(true)
  emailNotifyMatches     Boolean @default(false)
  emailNotifyIntros      Boolean @default(true)
  emailWeeklyDigest      Boolean @default(false)
  whatsappOptIn          Boolean @default(false)
  phone                  String?
}

model FounderProfile {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  companyName   String?
  stage         String?  // PRE_SEED, SEED, SERIES_A, SERIES_B, GROWTH
  title         String?
  oneLiner      String?
  description   String?
  traction      String?
  fundingGoal   String?
  amountRaised  String?
  targetClose   String?
  industries    String[] @default([])
  location      String?
  linkedin      String?
  bio           String?
  embedding     Unsupported("vector(1536)")?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model InvestorProfile {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  fundName      String?
  title         String?
  investorType  String?  // ANGEL, VC_FUND, FAMILY_OFFICE, CORPORATE_VC
  stageFocus    String[] @default([])
  checkSizeMin  String?
  checkSizeMax  String?
  sectors       String[] @default([])
  industries    String[] @default([])
  location      String?
  linkedin      String?
  bio           String?
  portfolioCount Int?
  embedding     Unsupported("vector(1536)")?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model TalentProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentRole    String?
  currentCompany String?
  yearsExperience Int?
  skills         String[] @default([])
  preferredRoles String[] @default([])
  industries     String[] @default([])
  location       String?
  linkedin       String?
  bio            String?
  embedding      Unsupported("vector(1536)")?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Match {
  id          String      @id @default(cuid())
  user1Id     String
  user2Id     String
  user1       User        @relation("MatchUser1", fields: [user1Id], references: [id])
  user2       User        @relation("MatchUser2", fields: [user2Id], references: [id])
  score       Float
  reasoning   String      // AI-generated specific reasoning
  status      MatchStatus @default(PENDING)
  user1Action String?     // CONNECT or PASS
  user2Action String?     // CONNECT or PASS
  user1Rating Int?        // 1-5 star rating
  user2Rating Int?
  introduction Introduction?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  @@unique([user1Id, user2Id])
}

model Introduction {
  id           String      @id @default(cuid())
  matchId      String      @unique
  match        Match       @relation(fields: [matchId], references: [id])
  introText    String
  status       IntroStatus @default(PENDING_APPROVAL)
  sentVia      String?     // EMAIL, WHATSAPP, BOTH
  sentAt       DateTime?
  followUpAt   DateTime?
  outcome      String?     // GREAT_MEETING, GOOD_CHAT, DIDNT_MEET, NOT_A_FIT
  outcomeNotes String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model InviteCode {
  id        String    @id @default(cuid())
  code      String    @unique
  creatorId String
  creator   User      @relation("CreatedInvites", fields: [creatorId], references: [id])
  usedById  String?   @unique
  usedBy    User?     @relation("UsedInvite", fields: [usedById], references: [id])
  createdAt DateTime  @default(now())
  usedAt    DateTime?
}

model Vouch {
  id         String   @id @default(cuid())
  fromUserId String
  toUserId   String
  fromUser   User     @relation("VouchesGiven", fields: [fromUserId], references: [id])
  toUser     User     @relation("VouchesReceived", fields: [toUserId], references: [id])
  createdAt  DateTime @default(now())
  @@unique([fromUserId, toUserId])
}

model DealRoom {
  id              String   @id @default(cuid())
  matchId         String   @unique
  founderId       String
  investorId      String
  deckUrl         String?
  onePagerUrl     String?
  metrics         Json?    // { mrr, growthRate, burnRate, runway }
  calendlyUrl     String?
  lastViewedAt    DateTime?
  viewDuration    Int?     // seconds
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Activity {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // MATCH_FOUND, INTRO_SENT, INTRO_ACCEPTED, INVITE_USED, WEEKLY_SUMMARY
  title     String
  metadata  Json?
  createdAt DateTime @default(now())
}

model ChatMessage {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  role      String   // USER or ASSISTANT
  content   String
  metadata  Json?
  createdAt DateTime @default(now())
}
```

---

## PAGE STRUCTURE & ROUTING

```
/ .......................... Landing page (public)
/about ..................... About page (public) — CREATE NEW
/features .................. Features page (public) — CREATE NEW  
/contact ................... Contact page (public) — CREATE NEW
/terms ..................... Terms of Service (public, exists)
/privacy ................... Privacy Policy (public, exists)
/login ..................... Login modal/page — CREATE NEW
/join/[code] ............... Invite landing page — CREATE NEW
/dashboard ................. User dashboard (protected)
/matches ................... Match listing (protected)
/introductions ............. Intro listing + approval (protected) — CREATE NEW
/chat ...................... AI chat / onboarding (protected)
/profile ................... View/edit profile (protected)
/deal-room/[matchId] ....... Deal room (protected) — CREATE NEW
/settings .................. Account settings (protected)
/admin ..................... Admin dashboard (protected, admin only) — CREATE NEW
```

---

## DESIGN SYSTEM

- **Background:** Dark navy #0F172A (primary), #1E293B (surface/cards)
- **Accent:** Teal #0D9488 (primary actions, links, highlights)
- **Text:** White #F8FAFC (primary), #94A3B8 (secondary/muted)
- **Success:** #22C55E
- **Warning:** #F59E0B
- **Error:** #EF4444
- **Font:** System font stack (Inter or default sans-serif)
- **Border radius:** 8px for cards, 6px for buttons, 4px for inputs
- **Cards:** Background #1E293B, border 1px solid #334155
- **Buttons primary:** Background #0D9488, text white, hover #0F766E
- **Buttons secondary:** Background transparent, border #334155, text #94A3B8

---

## ENVIRONMENT VARIABLES NEEDED

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+1...
RESEND_API_KEY=re_...
JWT_SECRET=...
NEXTAUTH_SECRET=... (if using NextAuth)
BASE_URL=https://boardy-ai-platform.replit.app
```

---

## IMPLEMENTATION ORDER

Build in this exact order:

1. **Database migration** — Update Prisma schema with all new models, run `npx prisma migrate dev`
2. **Bug fixes** — All 10 critical/high bugs listed in Phase 1
3. **Registration upgrade** — Add name + persona fields
4. **Onboarding progress indicator** — Add step counter to chat
5. **Personalized match reasoning** — Replace generic text with AI-generated reasoning
6. **Match score labels** — Replace percentages with "Strong Match" / "Good Fit" / "Possible Fit"
7. **Warm Introduction Engine** — The core new feature. Generate intro, preview, approve, send via email
8. **Introductions page** — New page listing all intros with status
9. **Invite system** — Generate codes, invite landing page, credit tracking
10. **Activity feed** — Dashboard timeline of events
11. **Real stats API** — Replace fake hero numbers with real database queries
12. **Public pages** — Create /about, /features, /contact, /login
13. **Mobile navigation** — Hamburger menu
14. **Trust layer** — Vouches + mutual connections display
15. **Deal Room** — Pitch deck upload + viewer tracking
16. **Notification preferences** — Settings page additions

---

## KEY PRINCIPLES

1. **Never show fake data.** If the real number is small, show qualitative text instead.
2. **Never show generic match reasoning.** Every match explanation must reference specific details from both profiles.
3. **Double-opt-in always.** No user ever receives an introduction they didn't agree to.
4. **Mobile-first.** Most Indian users access via phone. Every page must work at 375px width.
5. **Server never crashes on bad input.** All API endpoints must validate input and return 400 with clear error messages, never 500.
6. **WhatsApp is primary.** Design notifications for WhatsApp first, email second.
7. **Speed matters.** Landing page < 2 seconds. Match generation < 60 seconds after onboarding.
