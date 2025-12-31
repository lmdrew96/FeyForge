# FeyForge - D&D Campaign Manager

A comprehensive D&D 5e campaign management tool built with Next.js, featuring character creation, combat tracking, session management, and AI-powered DM assistance.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://feyforge.adhdesigns.dev)

## Features

- **Character Management** - Create and manage D&D 5e characters with full character sheets
- **Combat Tracker** - Track initiative, HP, conditions, and manage encounters
- **DM Assistant** - AI-powered chat for rules questions, encounter building, and loot generation
- **Session Management** - Log sessions, track plot threads, and calculate XP
- **Codex** - Browse spells, monsters, and items from Open5e API
- **NPC Generator** - Create and manage NPCs with AI assistance
- **Dice Roller** - Full-featured dice roller with history and saved rolls
- **World Map** - Interactive world map with location pins
- **Campaign Wiki** - Document your campaign lore

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL via Neon + Drizzle ORM
- **Authentication:** NextAuth.js (Google OAuth + Credentials)
- **Styling:** Tailwind CSS + shadcn/ui
- **AI:** Anthropic Claude API
- **State:** Zustand
- **Deployment:** Vercel

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Environment Variables

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for NextAuth session encryption
- `NEXTAUTH_URL` - Full URL of your deployment (include https://)
- `AUTH_GOOGLE_ID` - Google OAuth client ID
- `AUTH_GOOGLE_SECRET` - Google OAuth client secret
- `ANTHROPIC_API_KEY` - Anthropic API key for AI features

## Development

```bash
# Run linting
pnpm lint

# Type checking
pnpm tsc --noEmit
```

## License

MIT
