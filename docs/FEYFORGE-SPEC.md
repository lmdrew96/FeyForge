# FeyForge — Overhaul Spec
**Version:** 1.0  
**Date:** 2026-05-20  
**Status:** Active  
**Deployed:** feyforge.adhdesigns.dev

---

## Vision

FeyForge is a D&D 5e campaign companion for the whole table — not just the DM, not just one player. The goal is to be the layer that sits *on top of* a session and makes the table feel connected: shared party state, live inventory, collaborative notes.

D&D Beyond owns character sheets. Fighting them head-on is a losing battle. FeyForge wins by doing what D&D Beyond doesn't: **the table layer** — shared, real-time, collaborative.

---

## Target Users

- **DMs** who want a single place to run their session: NPC notes, encounter tracker, loot distribution, world wiki
- **Players** who want to see the party at a glance: everyone's HP, conditions, shared inventory, session notes
- **Whole tables** that play together online or in-person and want a shared digital surface without paying for a full VTT

---

## What Already Exists

The FeyForge codebase has a solid foundation. These features are scaffolded and partially or fully implemented:

| Feature | Route | Status |
|---|---|---|
| Character sheets | `/characters`, `/create-character` | Built |
| Combat tracker | `/combat` | Built |
| DM Assistant (Claude AI) | `/dm-assistant` | Built — markdown broken |
| Session tracker | `/sessions` | Built |
| Codex (Open5e API) | `/codex` | Built |
| NPC Generator | `/npcs` | Built |
| Dice Roller | `/dice` | Built |
| World Map | `/world-map` | Built |
| Campaign Wiki | `/wiki` | Built |
| Auth (Google + credentials) | `/login`, `/signup` | Built |
| Dashboard | `/dashboard` | Built — broken nav |

**Stack:** Next.js 16 App Router · TypeScript · Convex · Clerk · Zustand · Tailwind v4 · shadcn/ui · Anthropic Claude API (AI SDK) · Vercel

---

## Phased Roadmap

### Phase 1 — Quick Wins (< 1 hour)
The existing app has user-facing bugs that undermine first impressions. Fix these before anything else.

1. **Fix Dashboard nav link** — `app-shell.tsx:29`, `"/"` → `"/dashboard"`
2. **Update Claude model ID** — `lib/ai.ts` → `claude-haiku-4-5-20251001`
3. **Remove `images.unoptimized: true`** — `next.config.mjs`

---

### Phase 2 — Polish (1–2 days)
4. **DM Assistant markdown rendering** — add `react-markdown` + `rehype-sanitize`, build as shared `<MarkdownRenderer />` component (sessions, NPCs, characters also return markdown)
5. **Auth middleware** — add Clerk `middleware.ts` at root; redirect unauthenticated users on protected routes to `/login`
6. **Character store consolidation** — merge three overlapping Zustand stores (`character-store.ts`, `feyforge-character-store.ts`, `character-builder-store.ts`) into one canonical store; wizard state scoped to `/create-character` only

---

### Phase 3 — The Party Layer (the differentiator)
This is what makes FeyForge worth shipping publicly. See full spec below.

---

### Phase 4 — Infrastructure (later)
- Vitest unit tests for `lib/character/` math
- FeyForge MCP server (read access to campaign/character/session data)
- CI/CD pipeline (GitHub Actions)

---

## The Party Layer — Full Spec

### Overview

The Party Layer is a set of collaborative, real-time surfaces that connect everyone at the table. It lives at `/party` and is accessible to both DMs and players in a campaign.

The core concept: **the DM is the source of truth, players are subscribers.** The DM manages encounters and distributes loot; players see their character's state and the party's state together.

---

### Data Model

The existing schema is already multi-user aware (campaigns, characters, sessions are all user-scoped). The Party Layer needs a few additions:

#### `party_sessions` table
A live session that all party members join. Distinct from the session log (`sessions` table which is historical).

```ts
partySession: {
  id: uuid
  campaignId: uuid (FK → campaigns)
  dmUserId: text
  status: 'active' | 'ended'
  startedAt: timestamp
  endedAt: timestamp | null
}
```

#### `party_members` table
Links a user + their character to a live party session.

```ts
partyMember: {
  id: uuid
  partySessionId: uuid (FK → party_sessions)
  userId: text
  characterId: uuid (FK → characters)
  joinedAt: timestamp
}
```

#### `party_inventory` table
Shared loot pool for the party. Items can be unassigned (in the "party pool") or assigned to a character.

```ts
partyInventoryItem: {
  id: uuid
  partySessionId: uuid (FK → party_sessions)
  name: text
  description: text | null
  quantity: integer
  assignedToCharacterId: uuid | null  -- null = party pool
  addedByUserId: text                 -- DM who added it
  addedAt: timestamp
}
```

#### `session_notes` (extend existing or new table)
Shared notes visible to DM and all players. Both sides can write.

```ts
sessionNote: {
  id: uuid
  partySessionId: uuid
  authorUserId: text
  authorRole: 'dm' | 'player'
  content: text
  createdAt: timestamp
}
```

---

### Real-Time Strategy

Use **Convex** for all data — it replaces Neon Postgres + Drizzle ORM entirely. Convex's built-in reactivity means all party state (HP, conditions, inventory, notes) is live for all connected clients with no additional SSE or polling infrastructure needed.

Pattern:
- **DM actions** (HP changes, loot drop, condition update) → Convex mutation → all subscribed clients update automatically via Convex's real-time subscriptions
- **Players** use `useQuery` hooks on mount → Convex pushes updates as they happen

All tables in the Data Model section below are Convex documents. The Party Layer data model maps directly — `party_sessions`, `party_members`, `party_inventory`, `session_notes` are Convex tables.

---

### `/party` Route — DM View

The DM sees the full party dashboard:

**Party Status Panel**
- Each player's character: name, class, HP (current/max), conditions, concentration spells
- Dead/unconscious characters highlighted
- Click a character → HP adjustment modal (DM can update any player's HP during combat)

**Shared Inventory**
- Party loot pool: list of unassigned items
- "Assign to player" action per item — opens a dropdown of party members
- "Add loot" button — quick-add item by name, description, quantity
- DM Assistant integration: "Generate loot for CR 5 encounter" → auto-populates items into the pool

**Session Notes**
- Shared notepad visible to all
- DM notes render with a distinct visual treatment vs. player notes
- No rich text for v1 — plain text only, markdown rendering via `<MarkdownRenderer />`

**Party Controls**
- "End Session" → marks party session as ended, prompts DM to add session summary to the session log
- "Invite Players" → generates a join link (campaign join code or direct link)

---

### `/party` Route — Player View

Players see a focused, read-heavy view:

**My Character Panel**
- Own HP, conditions, spell slots, hit dice — pulled live from their character sheet
- Quick HP self-report: "I took X damage" → updates their character, DM sees it in the party panel
  - *(Note: DM can override — DM is source of truth)*

**Party Panel**
- All other party members: name, class, HP bar (visual), conditions
- No editing other players' characters — read-only

**My Inventory**
- Items assigned to their character
- Party pool: items not yet assigned, visible to all players

**Session Notes**
- Same shared notepad as DM view
- Players can add notes (labeled with their name)

---

### Join Flow

1. DM creates a campaign → gets a campaign code
2. DM starts a party session from `/party` → session goes live
3. Players navigate to `/party/join/[campaignCode]` → linked to their character in that campaign
4. All connected members see the shared state

For v1: players must already have an account and a character in the campaign. Self-service character creation from the join flow is a v2 feature.

---

### Inventory Management — Detailed Flow

This is the most complex collaborative feature. The flow:

1. **DM adds loot** (manually or via DM Assistant generation) → item appears in party pool
2. **Anyone can see** the party pool in real time
3. **DM assigns** an item to a player → item moves from pool to that player's inventory
4. **Player receives** notification (visual indicator, not a push notification for v1)
5. **Player can "drop"** an item back to the pool (with DM confirmation for v1)

Item schema is intentionally minimal for v1 — name, description, quantity. No weight, no attunement, no spell requirements. Those are v2 additions once the core flow is validated.

---

### Acceptance Criteria — Party Layer v1

- [ ] DM can start a party session from a campaign
- [ ] Players can join a live party session via campaign code
- [ ] All party members' HP and conditions are visible in real time (or near-real-time with polling)
- [ ] DM can add items to the party pool
- [ ] DM can assign items from the pool to a specific character
- [ ] Both DM and players can add session notes, visible to all
- [ ] DM can end the session; summary prompted for the session log
- [ ] Party session state persists on refresh (no lost state on browser reload)

---

## Design Notes

FeyForge has an existing fey-themed aesthetic: glassmorphism, fey-cyan/gold/purple palette, floating particles, runic animations. The Party Layer should feel continuous with this — not a new design system bolted on.

Specific considerations:
- **HP bars** should use the existing color system — green → yellow → red as health drops
- **Conditions** (Poisoned, Blinded, etc.) should use icon + label, not just text
- **Inventory items** benefit from subtle hover states and a drag-to-assign interaction for DM (v2)
- **Session notes** should feel like a shared parchment surface — consistent with the wiki aesthetic

---

## Out of Scope for v1

- Real-time dice rolling visible to the party (dice rolls stay local for now)
- Initiative tracker in the party view (combat tracker at `/combat` handles this separately)
- Character creation from the party join flow
- Push notifications for loot assignments
- Mobile-native PWA (web responsive is fine)
- Per-item weight, attunement, or spell-requirement tracking
- Multi-campaign switching within a party session

---

## Patch References

All tracked in ChaosPatch under project `feyforge`:

| Patch | Priority |
|---|---|
| Fix Dashboard nav link | High |
| DM Assistant markdown rendering | High |
| Update Claude model ID | High |
| Build the Party Layer | High |
| Add auth middleware | Medium |
| Consolidate character stores | Medium |
| Remove images.unoptimized | Medium |
| Add Vitest for lib/character/ | Low |
| FeyForge MCP server | Low |
