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
- **Audio Engine** — Synchronized ambient audio with explore/combat tiers, scene presets, and Ko-fi premium tracks
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

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) | Yes |
| `RESEND_API_KEY` | Resend API key for email | Yes |
| `EMAIL_FROM` | Sender address for transactional email | Yes |
| `KOFI_VERIFICATION_TOKEN` | Ko-fi webhook verification token (premium) | Yes |
| `R2_ACCOUNT_ID` | Cloudflare account ID for R2 | Yes |
| `R2_ACCESS_KEY_ID` | R2 access key | Yes |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | Yes |
| `R2_BUCKET_NAME` | R2 bucket name for audio storage | Yes |
| `R2_PUBLIC_URL` | Public base URL for R2 bucket | Yes |
| `SEED_SECRET` | Secret to gate the audio seed script | Dev |

Clerk also requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set automatically via the Clerk dashboard integration, and Convex requires `CONVEX_DEPLOYMENT` (set by `npx convex dev`).

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
| `partySessions` | Live real-time party sessions (DM-hosted) |
| `sessionNotes` | Per-user notes within a live party session |
| `partyMembers` | Players joined to a live session with their characters |
| `partyInventory` | Shared party loot during a live session |
| `partySessions` | Live session state including audio sync and scene |
| `campaignScenes` | Custom scene presets with color palette |
| `campaignSceneAudio` | Per-scene audio track assignments |
| `campaignWebNodes` / `campaignWebEdges` | Campaign relationship graph nodes and edges |
| `audioTracks` | Curated audio library (free + premium tiers) |
| `libraryReviewComments` | Admin review reactions on audio tracks |
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

Tracks are tagged by `type` (ambience, music, sfx), `intensityTier` (explore, combat), and `sceneTag` for multi-scene applicability. Live party sessions sync the active track and volume state to all connected players in real time.

Seed the audio library in development:

```bash
pnpm seed
```

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
| `pnpm seed` | Seed the audio track library |

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
