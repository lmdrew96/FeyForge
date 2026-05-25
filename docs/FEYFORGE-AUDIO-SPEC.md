# FeyForge Audio System Spec
**Version:** 1.0  
**Date:** 2026-05-25  
**Status:** Active  
**Feature area:** `/dm/library`, `/dm/scenes`, `/session`

---

## Vision

The FeyForge audio system turns the DM into a sound conductor. When a scene changes, the ambience shifts automatically. During tense moments, the DM slides from exploration music into combat music without breaking the narrative. Players on remote connections can opt into synced audio and hear exactly what the DM is playing. The whole thing runs off a curated, DM-owned library stored in Cloudflare R2 — no streaming dependencies, no mid-session silence.

---

## Core Concepts

### Track Types

Every audio asset in the library has a type:

| Type | Description | Loops? |
|---|---|---|
| `ambience` | Environmental background sound (forest rain, dungeon drips, tavern murmur) | Yes |
| `music` | Scored music tracks, split into explore/combat intensity tiers | Yes |
| `sfx` | One-shot sound effects (door creak, thunder, sword clash, crowd gasp) | No |

### Intensity Tiers

Music tracks come in pairs, bound to the same scene:

- **Explore tier** — calm, atmospheric, low tension
- **Combat tier** — driving, intense, high energy

The intensity slider crossfades between them in real time. At 0, only the explore track plays. At 100, only the combat track plays. At 50, both play at equal volume. The transition is seamless — no cuts, no silence.

Ambience tracks are intensity-agnostic. They play at a consistent volume regardless of slider position (with their own separate volume knob).

### Scene Binding

Each of the 10 prebuilt scenes (plus any custom scenes) has:
- A default ambience track
- A default explore music track  
- A default combat music track

These are set by the DM in `/dm/scenes` per campaign. When the DM activates a scene during a live session, the bound tracks start playing automatically. The DM can override any of them mid-session from the audio panel without changing the scene.

---

## Infrastructure

### Cloudflare R2 Storage

All audio files live in the existing ADHDesigns R2 bucket under a `feyforge/audio/` prefix:

```
feyforge/audio/
  ambience/
    dungeon-drips.mp3
    tavern-murmur.mp3
    forest-rain.mp3
    ...
  music/
    dungeon-explore.mp3
    dungeon-combat.mp3
    tavern-explore.mp3
    tavern-combat.mp3
    ...
  sfx/
    door-creak.mp3
    thunder-crack.mp3
    sword-clash.mp3
    crowd-gasp.mp3
    ...
```

Files are served via R2 public URL or a signed URL route depending on access model. For v1, public URLs are fine — the assets are royalty-free and non-sensitive.

### Convex Schema

**`audioTracks` table**
```ts
{
  id: Id<"audioTracks">
  name: string                          // display name
  type: "ambience" | "music" | "sfx"
  intensityTier: "explore" | "combat" | null  // null for ambience + sfx
  sceneTag: string | null               // e.g. "dungeon", "tavern" — null = untagged
  r2Key: string                         // path in R2 bucket
  r2Url: string                         // public playback URL
  duration: number                      // seconds
  sourceUrl: string | null              // original Pixabay/Freesound URL for attribution
  uploadedBy: string                    // userId
  createdAt: number
}
```

**`campaignSceneAudio` table** — DM's per-campaign scene bindings
```ts
{
  id: Id<"campaignSceneAudio">
  campaignId: Id<"campaigns">
  sceneName: string                     // "dungeon", "tavern", etc.
  ambienceTrackId: Id<"audioTracks"> | null
  exploreTrackId: Id<"audioTracks"> | null
  combatTrackId: Id<"audioTracks"> | null
}
```

**`partySession` additions** (extend existing table)
```ts
{
  // existing fields...
  activeAmbienceTrackId: Id<"audioTracks"> | null
  activeExploreTrackId: Id<"audioTracks"> | null
  activeCombatTrackId: Id<"audioTracks"> | null
  intensity: number          // 0–100, drives crossfade
  ambienceVolume: number     // 0–100, separate from intensity
  masterVolume: number       // 0–100
  audioSyncEnabled: boolean  // DM toggles whether session audio is broadcast
}
```

### Howler.js Playback Architecture

Three active Howl instances at any time during a session:

```ts
const ambienceHowl = new Howl({ src: [ambienceTrack.r2Url], loop: true, volume: ambienceVolume })
const exploreHowl  = new Howl({ src: [exploreTrack.r2Url],  loop: true, volume: 1 - (intensity / 100) })
const combatHowl   = new Howl({ src: [combatTrack.r2Url],   loop: true, volume: intensity / 100 })
```

Intensity slider movement:
```ts
exploreHowl.volume(1 - (intensity / 100))
combatHowl.volume(intensity / 100)
```

SFX = fire-and-forget instances, created on demand, not stored.

Scene switches: fade out current tracks (500ms), swap src, fade in new tracks (500ms). No silence gap.

---

## The Library — `/dm/library`

This is the DM's audio asset manager. Not visible during sessions — it's a setup tool.

### Import Flow

Three ways to add tracks:

**1. URL Import (Pixabay / Freesound)**
- DM pastes a Pixabay or Freesound track URL
- FeyForge fetches track metadata (name, duration) from the respective API
- FeyForge downloads the audio file via a server-side Next.js route handler → streams to R2
- DM fills in: name override (optional), type, intensity tier (if music), scene tag (optional)
- Hits "Save to Library" → written to `audioTracks` in Convex

**2. Direct Upload**
- DM uploads an MP3/WAV/OGG directly from their device
- Same metadata form as URL import
- File uploaded to R2 via presigned URL, metadata saved to Convex

**3. Bulk Import (v2)**
- Connect Freesound OAuth → pull all bookmark categories
- Map bookmark categories to FeyForge types/scene tags
- One-click import all

### Library UI

Grid/list view of all tracks, filterable by:
- Type (ambience / music / sfx)
- Scene tag
- Intensity tier

Each track card shows:
- Name, type badge, duration
- Scene tag pill (if set)
- Intensity tier badge (Explore / Combat, if music)
- Play preview button (plays inline, doesn't affect session)
- Edit metadata
- Delete (with confirmation)

---

## The Audio Panel — Session View

### DM Conductor — Audio Section

The audio panel lives in the DM conductor view, below the broadcast controls. Collapsible.

**Scene Audio** (top section)
- Shows currently playing ambience + music tracks (names, waveform-style progress indicator)
- "Override" button per slot → opens track picker modal filtered to that type/scene

**Intensity Slider**
- Large, prominent, labeled "Explore ←→ Combat"
- Keyboard accessible (arrow keys)
- Visual indicator showing current blend (e.g. "70% Combat")
- Updates in real time — no debounce, immediate crossfade response

**Ambience Volume**
- Separate slider, labeled "Ambience"
- Independent of intensity

**Master Volume**
- Global volume for the DM's local audio

**SFX Board**
- Grid of one-shot buttons, organized by category:
  - ⚡ Impact (explosion, boom, body fall, sword clash)
  - 🌩️ Weather (thunder, rain start, wind gust)  
  - 🚪 Environment (door creak, door slam, chains, torch flicker)
  - 🧙 Magic (enchant, spell cast, portal open, shimmer)
  - 👥 Crowd (gasp, cheer, scream, murmur)
- Each button fires the SFX immediately on tap
- Visual flash on trigger (satisfying feedback)
- DM can add custom SFX to any category from their library

**Audio Sync Toggle**
- "Sync audio to players" on/off switch
- When ON: session's audio state (tracks + intensity + volumes) broadcasts to connected players
- When OFF: DM audio is local only (in-person mode)
- Clearly labeled — DM should always know whether players are hearing what they're hearing

### Player Receiver — Audio Section

Only visible when `audioSyncEnabled === true` on the session.

**My Audio**
- "Synced to session" indicator with scene-accent color dot
- Master volume slider (local override — player can turn it down without affecting sync)
- "Unsync" toggle — opts out of sync, audio stops

When sync is on and DM switches scene → player's Howler instances update to the new tracks automatically. The scene palette change and audio change happen together — visual and audio as one event.

---

## Music Sync — Technical Flow

```
DM moves intensity slider
  → debounced 100ms → updates partySession.intensity in Convex

Players with sync=true
  → useQuery(api.liveSessions.getActiveSession) picks up intensity change
  → useEffect triggers exploreHowl.volume() + combatHowl.volume() update
  → Crossfade happens client-side in each player's browser

DM switches scene
  → activateScene() updates partySession.activeAmbienceTrackId etc.
  → Players' useEffect detects track ID change
  → Old tracks fade out (500ms), new tracks fade in (500ms)
  → No server-side audio streaming — each client fetches R2 URLs independently
```

The key insight: **no audio data crosses the network**. Only track IDs and volume values sync through Convex. Each client fetches and plays the R2 files independently. This means:
- Zero latency on intensity changes (local computation)
- ~1–5s sync lag on track switches (acceptable for tabletop pacing)
- No bandwidth cost for the sync mechanism itself

---

## Autoplay Consent

Browsers block audio autoplay without a user gesture. Solution:

- Players must click "Join Session" or toggle "Sync Audio" to opt in
- That gesture unlocks autoplay for the session
- On the join screen: clear indication that session includes synced audio
- If a player navigates away and returns, the sync toggle re-triggers autoplay unlock

---

## Scene Builder Integration

In `/dm/scenes`, each scene card gets an "Audio" section:

- Ambience track selector (filtered to type: ambience)
- Explore track selector (filtered to type: music, tier: explore)
- Combat track selector (filtered to type: music, tier: combat)
- Preview button per slot (plays 10s preview)
- "Clear" button per slot (revert to no default)

This is per-campaign — two campaigns can have different audio bindings for the same scene.

---

## Acceptance Criteria

**Library**
- [ ] DM can import a track via Pixabay or Freesound URL
- [ ] DM can upload a local audio file (MP3/WAV/OGG)
- [ ] Tracks are stored in R2 and metadata in Convex
- [ ] Library is filterable by type, scene tag, tier
- [ ] Tracks can be previewed inline without affecting the session

**Scene Binding**
- [ ] Each scene can have ambience, explore, and combat tracks bound per campaign
- [ ] Activating a scene during a session auto-plays bound tracks
- [ ] DM can override any slot mid-session without changing scene

**Session Audio Panel**
- [ ] Intensity slider crossfades explore/combat tracks in real time
- [ ] Ambience volume is independently controllable
- [ ] SFX board fires one-shot sounds on tap with visual feedback
- [ ] DM can toggle audio sync on/off
- [ ] Scene switch triggers crossfade to new scene's tracks

**Player Sync**
- [ ] Players can toggle audio sync on/off
- [ ] When synced, track switches follow the DM automatically
- [ ] When synced, intensity changes propagate within ~100ms
- [ ] Local master volume works independently of sync state
- [ ] Autoplay consent is handled gracefully on join

---

## Out of Scope (v1)

- Bulk Freesound OAuth import (v2)
- Per-player volume control from DM side
- Crossfade duration customization
- Audio visualizer / waveform display during playback
- Playlist mode (queue of tracks, auto-advance)
- Mobile app (web responsive only)
- Spatial audio / panning
- Recording session audio

---

## Patch References (ChaosPatch: `feyforge`)

| Patch | Priority | Depends on |
|---|---|---|
| Convex audioTracks + campaignSceneAudio schema | High | — |
| Extend partySession with audio state fields | High | Schema patch |
| `/dm/library` — URL import (Pixabay + Freesound) | High | Schema patch |
| `/dm/library` — direct file upload to R2 | High | Schema patch |
| `/dm/library` — grid UI with filter/preview | High | Import patches |
| Scene builder audio binding UI | Medium | Library |
| Session audio panel — DM conductor view | High | Library + scene binding |
| Howler.js integration — explore/combat crossfade | High | Audio panel |
| SFX board — one-shot triggers with visual flash | Medium | Howler integration |
| Audio sync — player receiver + sync toggle | High | DM panel |
| Convex live sync — intensity + track propagation | High | Audio sync |
| Autoplay consent handling on player join | Medium | Sync |
