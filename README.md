# FeyForge - D&D Campaign Manager

A comprehensive D&D 5e campaign management tool built with Next.js and Convex, featuring character creation, combat tracking, live party sessions, AI-powered DM assistance, and synchronized ambient audio.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://feyforge.adhdesigns.dev)

## Features

- **Character Management** — Full D&D 5e character sheets with stats, spellcasting, equipment, and conditions
- **Combat Tracker** — Initiative order, HP tracking, conditions, and saved encounters
- **DM Assistant** — AI-powered chat for rules questions, encounter building, and loot generation
- **Session Management** — Log sessions, track plot threads, objectives, and XP
- **Live Party Sessions** — Real-time shared sessions where players join and DMs broadcast scenes
- **Campaign Web** — Interactive node graph for mapping NPC/location/faction relationships
- **Audio Engine** — Synchronized adaptive music with sample-perfect stem sync (Web Audio API), layered ambience, explore/combat/victory modes, and Ko-fi premium tracks
- **Codex** — Browse spells, monsters, and items from the Open5e API
- **NPC Generator** — Create and manage NPCs with full stat blocks and AI assistance
- **Dice Roller** — Full-featured dice roller with history and saved rolls
- **World Map** — Interactive map with location pins and fog of war
- **Campaign Wiki** — Document lore, factions, and locations

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
| `R2_PUBLIC_URL` | Public base URL for R2 bucket | Yes |
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

Convex handles schema and migrations automatically. No manual migration step is needed — push schema changes with:

```bash
pnpm db:push
```

## Schema Overview

| Table | Purpose |
|---|---|
| `users` | Clerk-linked users with premium/role flags |
| `campaigns` | Top-level campaign containers |
| `characters` | Full D&D 5e character sheets |
| `characterProperties` | Polymorphic properties (spells, items, features, traits) |
| `npcs` | Campaign NPCs with stat blocks |
| `gameSessions` | Session logs with objectives, encounters, and XP |
| `gameSessionNotes` | DM notes attached to a game session |
| `partySessions` | Live real-time party sessions — DM-hosted, includes audio sync and scene state |
| `sessionNotes` | Per-user notes within a live party session |
| `partyMembers` | Players joined to a live session with their characters |
| `partyInventory` | Shared party loot during a live session |
| `campaignScenes` | Custom scene presets with color palette |
| `campaignWebNodes` / `campaignWebEdges` | Campaign relationship graph nodes and edges |
| `audioTracks` | Curated audio library (free + premium tiers) |
| `libraryReviewComments` | Admin review reactions on audio tracks |
| `musicStems` | Stem assignments per scene+mode with intensity windows (1–5) |
| `ambienceLayers` | Named audio layers (environment/weather/creature) for layered ambience |
| `ambiencePresets` | Saved layer configurations per scene variation |
| `campaignSceneAudio` | Per-scene legacy audio track assignments |
| `dmConversations` | Saved AI DM Assistant conversation threads |
| `wikiEntries` | Campaign wiki articles |
| `worldMaps` / `mapPins` / `mapLocations` | World map data |
| `plotThreads` | Campaign-level plot thread tracking |
| `savedEncounters` | Saved combat encounter templates |
| `sessionBroadcasts` | DM scene/NPC/location reveals pushed to players |

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
| `pnpm db:push` | Push Convex schema changes |
| `pnpm db:studio` | Open Drizzle Studio (local Convex inspector) |
| `pnpm db:generate` | Generate Convex types |
| `pnpm upload` | Bulk-upload audio files to R2 + Convex review queue |

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
