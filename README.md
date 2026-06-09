# FeyForge - D&D Campaign Manager

A comprehensive D&D 5e companion built with Next.js and Convex: full character sheets across the 2014 and 2024 rules, live real-time sessions with synced audio and live captions, an interactive world map, a campaign wiki, homebrew authoring, an AI DM assistant, a friends/social layer, and AI-assisted character & NPC building.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://feyforge.adhdesigns.dev)

## Features

- **Character Management** — Full D&D 5e character sheets across the 2014 and 2024 rulesets: ability scores, spellcasting, inventory & attacks, conditions, class features and resources (Rage, Ki, Sorcery Points, and the rest), and Wild Shape / companions.
- **AI-Assisted Character Building** — Claude-powered names, backstories, traits, build suggestions, and optimization, plus a guided creation companion and AI character portraits.
- **Homebrew** — Author custom races, backgrounds, and monsters that merge into the character builder and encounter tools; optionally publish them to a campaign.
- **Combat Tracker** — Initiative order, HP, conditions, and saved encounters — both a standalone builder and a live in-session tracker with a player view and monster attacks.
- **Session Management** — Log sessions, track plot threads, objectives, and XP, with AI-generated prep, recaps, and summaries.
- **Live Party Sessions** — Real-time shared sessions: DMs broadcast scenes, NPCs, and locations; players join with their characters and view live sheets; with synchronized audio and live speech-to-text captions.
- **World Map** — Import [Azgaar](https://azgaar.github.io/Fantasy-Map-Generator/) maps with location pins and fog of war, settlement/dungeon drill-downs, multimodal travel routing, a Realms & Faiths gazetteer, and Living Diplomacy with a player-facing World News feed.
- **DM Assistant** — A campaign-grounded AI chat docked in the app shell for rules questions, encounter building, lore, and loot.
- **Campaign Wiki** — Author lore, factions, and locations with player/DM reveal gating.
- **Campaign Hub** — A player's between-sessions home: a private journal, a personal quest log, readable recaps, and the NPCs they've met.
- **Campaign Web** — Interactive node graph for mapping NPC / location / faction relationships.
- **Friends & Social** — A friend graph (friend codes + "people you've played with" discovery), a reactive notification bell, presence ("who's online"), and direct campaign / live-session invites.
- **Audio Engine** — Synchronized adaptive music with sample-perfect stem sync (Web Audio API), layered ambience, explore/combat/victory modes, and Ko-fi premium tracks.
- **Codex** — Browse spells, monsters, magic items, and conditions from the self-hosted 2024 SRD, with class/level/school/type/CR filters, sorting, and bookmarks.
- **NPCs** — Create and manage NPCs with full stat blocks and AI assistance, plus a curated first-party pool of roadside-encounter NPCs dealt to map markers.
- **Dice Roller** — Dice-expression roller (e.g. `1d8+3d6`) with 3D dice, history, and saved rolls.
- **Premium** — Ko-fi-gated higher AI quotas, a premium world-map library, and premium audio.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Backend/Database:** Convex (real-time, serverless)
- **Authentication:** Clerk
- **AI:** Vercel AI SDK + Anthropic Claude
- **Audio Storage:** Cloudflare R2
- **Email:** Resend
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand + Immer
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm
- A [Convex](https://convex.dev) account
- A [Clerk](https://clerk.com) account

### Installation

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (set by `npx convex dev`) | Yes |
| `CONVEX_DEPLOYMENT` | Convex deployment id (set by `npx convex dev`) | Yes |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions endpoint | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (client-side) | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) | Yes |
| `ANTHROPIC_API_KEY` | Anthropic key — powers **all** AI features (character build/name/backstory/traits/optimize, creation assistant). Without it every AI route returns 500. | Yes |
| `R2_ACCOUNT_ID` | Cloudflare account ID for R2 | Yes |
| `R2_ACCESS_KEY_ID` | R2 access key | Yes |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | Yes |
| `R2_BUCKET_NAME` | R2 bucket name for audio storage | Yes |
| `R2_PUBLIC_URL` | Public base URL for the R2 bucket (server-side) | Yes |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Public base URL for the R2 bucket (client-visible, used to render stored images) | Yes |
| `ASSEMBLYAI_API_KEY` | AssemblyAI key — powers live-session speech-to-text captions | No |
| `RESEND_API_KEY` | Resend API key for email | Yes |
| `EMAIL_FROM` | Sender address for transactional email | Yes |
| `KOFI_VERIFICATION_TOKEN` | Ko-fi webhook verification token (premium) | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk sign-in route (default `/login`) | No |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk sign-up route (default `/signup`) | No |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Post-sign-in redirect (default `/dashboard`) | No |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Post-sign-up redirect (default `/dashboard`) | No |
| `SEED_SECRET` | Shared secret guarding the library seed script | No |

> **Deploying:** these must be set in your hosting provider (e.g. Vercel) too, not just `.env.local`. A missing `ANTHROPIC_API_KEY` in production is a common cause of AI features failing while everything else works.

### Running Locally

```bash
# Start Convex dev server (separate terminal)
npx convex dev

# Start Next.js dev server
pnpm dev
```

### Database

Convex handles schema and migrations automatically. Schema changes are pushed when you run `npx convex dev` (development) or `npx convex deploy` (production) — there is no separate migration step.

## Schema Overview

| Table | Purpose |
|---|---|
| `users` | Clerk-linked users — premium/role flags, active campaign, friend code |
| `campaigns` | Top-level campaign containers |
| `campaignMembers` | Per-campaign membership and role (DM / player) |
| `characters` | Full D&D 5e character sheets |
| `characterProperties` | Polymorphic per-character rows (spells, items, features, traits, class choices) |
| `homebrew` | User-authored races/backgrounds/monsters that merge into the builder |
| `npcs` | Campaign NPCs with stat blocks |
| `gameSessions` / `gameSessionNotes` | Session logs (objectives, encounters, XP) + DM notes |
| `plotThreads` | Campaign-level plot-thread tracking |
| `partySessions` | Live real-time sessions — DM-hosted, with audio sync and scene state |
| `partyMembers` / `partyInventory` | Players joined to a live session + shared party loot |
| `sessionNotes` | Per-user notes within a live session |
| `sessionBroadcasts` | DM scene/NPC/location reveals pushed to players |
| `liveCombat` | Live initiative/HP tracker for a session |
| `liveCaptions` | Streamed speech-to-text caption lines (AssemblyAI) |
| `savedEncounters` | Saved combat encounter templates |
| `dmConversations` | Saved DM Assistant conversation threads |
| `campaignJournal` / `campaignQuests` | Player Campaign Hub — per-member notebook and quest log |
| `wikiEntries` | Campaign wiki articles (with reveal gating) |
| `worldMaps` / `mapLocations` | World map data — image, pins, routes, realms, faiths, fog, events |
| `diplomacyOverrides` | Campaign-scoped realm-diplomacy overlay (Living Diplomacy) |
| `campaignWebNodes` / `campaignWebEdges` | Campaign relationship-graph nodes and edges |
| `friendships` | Friend graph (pending / accepted / blocked) |
| `notifications` | Reactive notification spine (friend requests, invites) |
| `presence` | Heartbeat "who's online" for the friends layer |
| `audioTracks` | Curated audio library (free + premium tiers) |
| `musicStems` | Stem assignments per scene+mode with intensity windows (1–5) |
| `ambienceLayers` / `ambiencePresets` | Named ambient layers + saved per-scene configs |
| `campaignSceneAudio` | Per-scene legacy audio track assignments |
| `libraryReviewComments` | Admin review reactions on audio tracks |
| `aiUsage` | Per-user daily AI generation quota counter |

## Audio System

Audio tracks are stored in Cloudflare R2 and managed through Convex. The library has two tiers:

- **Free** — available to all users
- **Premium** — requires an active Ko-fi subscription

### Adaptive music engine

The music engine (`hooks/use-audio-engine.ts`) uses the **Web Audio API** for sample-perfect stem synchronization. Each scene+mode (e.g. Forest → Explore) has 4–5 stems. Every stem has an intensity window (`intensityMin`–`intensityMax` on a 1–5 scale). When the DM moves the intensity slider, stems fade in and out over ~4 seconds based on their windows. All stems share one `AudioContext` clock — they start at exactly the same moment with no race conditions.

Ambience layers and SFX one-shots continue to use Howler for streaming playback.

### Layered ambience

Independent ambient layers (environment, weather, creature sounds) stack on top of the music engine. Layers are saved as named presets per scene and synced to all players in real time.

### Upload workflow

Bulk-upload stems and ambience files from a local folder:

```bash
pnpm upload --input ./feyforge-audio/ready --type music
pnpm upload --input ./feyforge-audio/ready --type ambience
```

Files land in the admin review queue as `pending`. Approve and assign stem intensity windows in the Audio Review panel. See `docs/guides/FEYFORGE-AUDIO-CURATION-GUIDE.md` for the full curation workflow.

> **Note:** The R2 bucket must have CORS configured (`Access-Control-Allow-Origin`) for the Web Audio `fetch` path to work. See Cloudflare R2 → Bucket Settings → CORS.

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Run ESLint with auto-fix |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without writing |
| `pnpm test` | Run the Vitest test suite |
| `pnpm upload` | Bulk-upload audio files to R2 + Convex review queue |
| `pnpm seed:presets` / `pnpm seed:premium` | Seed the world-map preset libraries |
| `pnpm seed:monsters` | Re-bake the self-hosted SRD monster bundle |
| `pnpm tag-premium` | Tag premium audio tracks |

> Convex schema/types are managed by `npx convex dev` / `npx convex deploy`, not a separate script.

## Deployment

Deployed to Vercel. Set all environment variables in the Vercel project settings. Convex deployment is managed separately via `npx convex deploy` or the Convex dashboard.

## Project Structure

```
app/          # Next.js App Router pages and API routes
convex/       # Convex schema, queries, mutations, and actions
components/   # Shared React components
lib/          # Zustand stores, utilities, and API clients
hooks/        # Custom React hooks (audio engine, etc.)
scripts/      # One-off scripts (audio seeding)
docs/         # Internal specs and design docs
assets/audio/ # Local audio assets (dev/seed use)
```

## License

MIT
