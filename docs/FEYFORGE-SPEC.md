# FeyForge — Product Spec v2.0
**Date:** 2026-05-20  
**Status:** Active  
**Deployed:** feyforge.adhdesigns.dev  
**Authors:** Nae + Ashley (brainstorm), Nae (spec)

---

## The Idea in One Sentence

FeyForge is a live D&D companion where the DM conducts the session — broadcasting scenes, NPCs, and narrative moments to players in real time — and the whole table's UI shifts to reflect the world they're in.

---

## What This Is Not

- Not a character sheet replacement (D&D Beyond owns that, we don't fight it)
- Not a VTT (no battle grid, no token movement)
- Not a static campaign manager (the current FeyForge — that's dead)

---

## What This Is

A **live session layer** for the whole table. The DM is the narrator and conductor. Players are active participants in a shared, responsive space. The app itself is alive — it looks, feels, and breathes the current scene.

The core loop:
1. **DM sets the scene** → the UI transforms for every player
2. **DM reveals NPCs, locations, lore** → players receive it as a narrative event
3. **Everyone plays together** in an interface that responds to the story

---

## Core Philosophy: The UI Is the World

The current FeyForge is static dark green forever. It has no relationship to the story being told.

In the new FeyForge, **CSS variables are a narrative tool.** When the DM selects or switches a scene, the entire interface transforms — colors, shadows, glows, textures — for every connected player simultaneously. The dungeon *feels* like a dungeon. The tavern *feels* like a tavern. The transition between them is a story beat.

This is the whimsy. This is the variety. This is the differentiator.

---

## What's Kept From the Current Codebase

**Keep everything:**
- Neon Postgres DB + Drizzle ORM schema (well-designed, don't touch)
- All server actions
- All API routes
- NextAuth v5 (auth is solid)
- `lib/` utilities (character math, AI client)
- Deployment config, env vars

**Delete everything:**
- `components/` — all of it
- All `page.tsx` and `layout.tsx` files
- `app/globals.css`
- The three tangled character Zustand stores

This is a frontend gut, not a rebuild. The backend is done.

---

## Tech Stack (unchanged)

Next.js 16 App Router · TypeScript · Neon Postgres + Drizzle ORM · NextAuth v5 · Zustand · Tailwind v4 · shadcn/ui · Anthropic Claude API · Vercel

---

## The Scene System

### Overview

Scenes are the heartbeat of FeyForge. Each scene is a named environment with a color palette that drives the entire UI through CSS custom properties.

When the DM activates a scene, every connected player's interface transforms in real time.

### CSS Variable Architecture

Each scene defines a token set:

```css
/* Example: Dungeon scene */
--scene-bg: #0f0e13;
--scene-surface: #1a1825;
--scene-border: #2d2a3e;
--scene-accent: #4a90d9;        /* cold blue */
--scene-accent-glow: rgba(74, 144, 217, 0.3);
--scene-text-primary: #e8e6f0;
--scene-text-muted: #6b6882;
--scene-highlight: #7b5ea7;     /* deep purple */
--scene-shadow: rgba(0, 0, 0, 0.6);
--scene-particle: #4a90d9;
```

Every UI element — sidebar, cards, nav, modals, badges, glows — uses these variables. No hardcoded colors anywhere in the component layer.

### Prebuilt Scenes (v1)

| Scene | Vibe | Primary | Accent | Mood |
|---|---|---|---|---|
| **Dungeon** | Cold, oppressive, ancient | Deep slate | Ice blue | Dread |
| **Tavern** | Warm, chaotic, alive | Amber/oak | Firelight orange | Cozy |
| **Forest** | Dappled, breathing, alive | Warm sage | Gold-green | Wonder |
| **Underdark** | Void, alien, bioluminescent | Near-black | Cyan/violet | Alien |
| **Castle** | Imposing, regal, cold stone | Stone grey | Royal gold | Grandeur |
| **Coastal** | Open, salt-air, vast | Seafoam | Bright cerulean | Freedom |
| **Infernal** | Scorched, suffocating, red | Char black | Deep crimson | Danger |
| **Celestial** | Radiant, impossibly bright | Pearl white | Warm gold | Awe |
| **Shadowfell** | Ashen, grief-heavy, still | Ash grey | Muted violet | Melancholy |
| **Feywild** | Saturated, shifting, alive | Deep jewel tones | Iridescent | Euphoria |

### Custom Scene Builder

DMs can create named custom scenes by defining:
- Scene name
- 4 core palette values (background, surface, accent, highlight)
- The UI previews the scene live as they adjust
- Saved to their campaign, shareable with other DMs

Custom scenes stored in `campaign_scenes` table:
```ts
campaignScene: {
  id: uuid
  campaignId: uuid
  name: text
  palette: jsonb  // the full CSS variable map
  isPrebuilt: boolean
  createdBy: text (userId)
}
```

### Scene Transitions

Scene switches are not instant — they animate. A 600ms crossfade via CSS transitions on all CSS variables, creating a felt shift rather than a hard cut. The transition is itself a story beat.

---

## Character Creation — Branched Flow

Character creation offers three entry points. The DM or player chooses their intent first.

### The Three Paths

**1. Guided Creation**
For new players or anyone who wants handholding. Step-by-step wizard with contextual explanations. Each choice comes with flavor text and what-it-means explanations. Longer, warmer, more narrative. "A Fighter is someone who has trained their body into a weapon — maybe you're a soldier, a gladiator, or someone who learned to fight to survive."

**2. Quick Roll**
For chaos goblins who just want to play. Hit one button, get a randomly generated character with stats rolled using standard method (4d6 drop lowest), random race/class combo weighted toward playable builds, auto-assigned name from a curated list. Minimal decisions. Out in under 60 seconds. Can customize after.

**3. Normal Creation**
The full builder for experienced players who know what they want. No hand-holding, all options available, stat entry (standard array, point buy, or manual roll), full spell selection, equipment choices. Compact, efficient, assumes D&D knowledge.

### Entry Screen

The character creation landing is not a form. It's a **choice card UI** — three visually distinct cards, each with an evocative description and a clear label. Whimsy here: the cards could subtly animate, the Guided card warmer/softer, the Quick Roll card chaotic/energetic, the Normal card clean/precise.

---

## Live Session — The DM Broadcast Layer

### Overview

This is the core of what makes FeyForge new. The DM has a **conductor's interface** — a set of tools for controlling what players see and feel. Players have a **receiver interface** — they experience what the DM reveals, when the DM reveals it.

### DM Interface — Session Control Panel

**Scene Controls**
- Scene selector (grid of prebuilt + custom scenes, visual swatches)
- "Activate Scene" → pushes to all connected players instantly
- Transition preview before activating

**Audio Panel** *(local only — DM's device)*
- Ambience tracks (Forest Rain, Tavern Murmur, Dungeon Drips, Combat Drums, etc.)
- SFX buttons (Door Creak, Thunder, Sword Clash, Crowd Gasp, etc.)
- Master volume + per-category sliders
- DM controls their own audio; players manage theirs independently

**NPC Broadcast**
- DM selects an NPC from their campaign roster
- Chooses what to reveal: name, portrait, description, quote — individually toggleable
- Hits "Reveal to Party" → NPC card appears on every player's screen

**Location Broadcast**
- Similar to NPC: DM selects a location, toggles what to reveal, pushes to players

**Lore Broadcast**
- Push arbitrary text/images as "story drops" — journal entries, letters, prophecies, maps

### Player Interface — The Receiver

**Persistent Party Rail**
- Always-visible sidebar or bottom rail showing all party members: avatar, HP bar, conditions
- Glanceable — designed for quick eyes-up checks

**Notification System**
- When the DM pushes something new, a card appears with:
  - Flashing badge (animated pulse)
  - Edge glow in the current scene's accent color
  - Content type label (NPC / Location / Lore)
- Tapping/clicking opens a full modal with the revealed content
- Modal inherits the scene palette
- Notifications stack if multiple arrive in quick succession

**My Character**
- Quick-access panel: HP, spell slots, conditions, hit dice
- Edit HP inline (self-reported damage/healing)

**Party Inventory**
- Shared loot pool visible to all players
- DM assigns items from pool to characters

**Session Notes**
- Shared notepad, both DM and players can write
- DM notes visually distinct from player notes

---

## Real-Time Architecture

### Approach

**v1: Polling (5-second interval)**
Simple, reliable, no added infrastructure. For tabletop pacing (turns take minutes) this is completely adequate. Players won't notice a 5-second lag on an NPC reveal.

**v2: Server-Sent Events (SSE)**
Upgrade to true push once the data model is proven. Next.js Route Handlers support SSE natively — no new services needed.

**Explicitly out of scope:** WebSockets, Pusher, Ably, Partykit, or any third-party real-time service. Keep the stack lean.

### Data Flow

```
DM action (reveal NPC, switch scene, assign loot)
  → POST /api/session/[action]
  → Server action updates DB
  → Next poll cycle picks it up for all connected players
  → Player UI updates
```

### New DB Tables Needed

**`party_sessions`** — a live session all members join
```ts
{
  id, campaignId, dmUserId,
  activeSenreId: uuid | null,  // current scene
  status: 'active' | 'ended',
  startedAt, endedAt
}
```

**`party_members`** — links user + character to a live session
```ts
{ id, partySessionId, userId, characterId, joinedAt }
```

**`session_broadcasts`** — the DM's reveal queue
```ts
{
  id, partySessionId,
  type: 'npc' | 'location' | 'lore' | 'scene',
  payload: jsonb,        // the revealed content
  revealedAt: timestamp,
  seenBy: text[]         // userIds who have opened it
}
```

**`party_inventory`** — shared loot pool
```ts
{
  id, partySessionId, name, description,
  quantity, assignedToCharacterId: uuid | null,
  addedByUserId, addedAt
}
```

**`campaign_scenes`** — custom scene definitions
```ts
{ id, campaignId, name, palette: jsonb, isPrebuilt, createdBy }
```

---

## Information Architecture

### Routes

```
/                        Landing (public, not "Forge Slumbers")
/login
/signup
/forgot-password

/dashboard               Campaign home — recent sessions, party status, quick actions
/characters              Character roster
/characters/[id]         Character sheet
/characters/new          Branched creation flow (Guided / Quick Roll / Normal)

/session                 Live session — DM conductor view OR player receiver view
                         (same route, different UI based on role)
/session/join/[code]     Player join flow

/dm                      DM-only tools hub
/dm/npcs                 NPC roster + generator
/dm/scenes               Scene manager (prebuilt + custom)
/dm/assistant            DM Assistant (Claude AI)
/dm/wiki                 Campaign wiki
/dm/world-map            World map

/codex                   Open5e reference (spells, monsters, items)
/dice                    Dice roller
/settings
/account
```

### Role-Based UI

The app detects whether the current user is the **DM** (campaign creator) or a **Player** for the active campaign. The nav, available actions, and session view differ accordingly. This is not a permissions system — it's a UI branching based on campaign role.

---

## Design Direction

### Philosophy

The UI is the world. Every design decision should serve that principle. The app should feel *alive* — responsive to the story, not a static tool that sits next to it.

### Anti-Patterns (current FeyForge)
- Same value/opacity everywhere — no contrast hierarchy
- "Fantasy" theming as decoration only (small caps + forest green)
- Eye goes nowhere because nothing has priority
- Glassmorphism without purpose — just vibes, no function

### Target Aesthetic

**Base state (no active scene):** Dark, atmospheric, restrained. Establishes that something is *about to happen*. The neutral state is expectant, not dead.

**Active scene:** Fully transformed. Rich, committed, immersive. Not "tinted dark mode" — actually different.

**Whimsy:** In the transitions, the interactions, the character creation cards, the notification pulses. Not in persistent decoration.

**Typography:** Needs a display font with personality (not a system font) paired with a highly legible body font. The current small-caps all-caps SMALL CAPS thing is doing a lot of work and not earning it.

**Contrast hierarchy:** Every screen should have one thing that's clearly the most important. Cards, panels, and content areas should have distinct visual weight.

---

## Phased Build Plan

### Phase 1 — Frontend Gut + Design System
- Delete all components, pages, CSS
- Build scene token system (CSS vars) with the 10 prebuilt scenes
- Build base layout (shell, nav, routing) that uses scene tokens throughout
- No active session yet — static scene for dev purposes

### Phase 2 — Character Creation
- Build the three-path entry screen
- Build Guided flow
- Build Quick Roll (random gen)
- Build Normal builder (port logic from old builder, new UI)

### Phase 3 — Live Session Core
- DM conductor view: scene switcher, NPC broadcast, location broadcast
- Player receiver view: notification cards with pulse/glow, modal reveal
- Polling-based real-time (5s interval)
- Party rail (HP, conditions glanceable)

### Phase 4 — Supporting Features
- Shared inventory
- Session notes (collaborative)
- Audio panel (local, DM only)
- Scene builder (custom palette UI)

### Phase 5 — Polish + Ship
- SSE upgrade (replace polling)
- DM Assistant (markdown rendering fixed, wired to campaign context)
- Codex, Dice Roller (quick ports, new UI)
- Auth middleware
- Performance pass (image optimization, etc.)

---

## Out of Scope (v1)

- Battle grid / token movement (not a VTT)
- Audio sync across clients (DM controls locally only)
- Player-to-DM action queue
- Mobile native app (responsive web only)
- Per-item weight, attunement tracking
- Multi-campaign active sessions simultaneously
- Real-time dice rolls visible across the table

---

## Open Questions (to resolve with Ashley)

- What does the **landing page** look like? (currently "The Forge Slumbers" — this needs a real landing)
- Any specific SFX/ambience tracks in mind, or use a library (Howler.js + royalty-free)?
- Does the **world map** survive into the new UX or get cut for v1?
- Are there any **specific scenes** beyond the 10 listed that feel essential?
- What does the **player join flow** feel like? (Campaign code? QR code? Link?)

---

## Patch References (ChaosPatch: `feyforge`)

| Patch | Priority | Phase |
|---|---|---|
| Frontend gut — delete components, pages, CSS | High | 1 |
| Build scene token system (CSS vars, 10 prebuilt palettes) | High | 1 |
| Build base layout shell with scene token integration | High | 1 |
| Branched character creation (Guided / Quick Roll / Normal) | High | 2 |
| DM conductor view — scene switcher + broadcast UI | High | 3 |
| Player receiver view — notification cards + modal reveal | High | 3 |
| Polling-based real-time (session_broadcasts table) | High | 3 |
| Party rail (HP + conditions, always visible) | High | 3 |
| Shared inventory | Medium | 4 |
| Session notes (collaborative) | Medium | 4 |
| Audio panel (local, DM only) | Medium | 4 |
| Custom scene builder | Medium | 4 |
| SSE upgrade (replace polling) | Medium | 5 |
| DM Assistant — markdown fix + campaign context | Medium | 5 |
| Add auth middleware | Medium | 5 |
| FeyForge MCP server | Low | Post-launch |
| Vitest for lib/character/ math | Low | Post-launch |
