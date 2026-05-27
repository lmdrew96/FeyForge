# FEYFORGE-AUDIO-ADMIN-SPEC.md

## Overview

Two deliverables:

1. **Bulk upload script** — pushes a folder of audio files to R2 and creates
   pending `audioTrack` records in Convex. No metadata beyond filename and type.
2. **Admin review page — combined approve + stem assign** — extend the existing
   review UI so approving a track and assigning it to one or more scene+mode
   stem slots happens in a single submit action.

---

## Part 1 — Bulk upload script

### Location

`scripts/audio-pipeline/upload.ts` (or `.js` — match whatever Cody used for
existing pipeline scripts in that folder).

### Behavior

```
node scripts/audio-pipeline/upload.ts --input ./feyforge-audio/ready --type music
```

Flags:
- `--input` — folder of MP3/WAV files to upload
- `--type` — `"music"` or `"ambience"` (written to the `audioTrack` record)
- `--dry-run` — print what would happen without uploading or writing to DB

Per file:
1. Upload to R2 at key `audio/{type}/{filename}` (same convention as existing
   upload route)
2. Call `createAudioTrack` mutation (or equivalent) with:
   - `r2Url` — the resulting R2 public URL
   - `type` — from the `--type` flag
   - `status: "pending"` — goes straight to the admin review queue
   - `originalFilename` — the source filename (useful as a label in the review UI)
   - `tier: "free"` — default, admin can change on review
3. Print success/skip per file. Skip if a track with the same `r2Url` already
   exists (dedup check).

The script does **not** set scene tags, intensity windows, stem name, or any
other metadata. All of that happens in the admin review UI.

### Dependencies

Uses the Convex CLI HTTP client or the existing Convex backend URL + admin key
to call mutations directly. Check how existing pipeline scripts authenticate —
match that pattern exactly.

---

## Part 2 — Admin review page

### What already exists

The admin review page can:
- List pending tracks
- Play/preview audio
- Set `type`, `tier`, scene tags
- Approve a track (`approveAudioTrack` mutation)

### What changes

When `type === "music"`, show a **Stem Assignments** section below the existing
fields. This section replaces — or sits alongside — the existing scene tag
multi-select for music tracks. (Scene tags on `audioTrack` can remain for
ambience tracks; music tracks are assigned via `musicStems` instead.)

---

### Predefined scenes constant

Create `lib/audio/scenes.ts`:

```ts
export const FEYFORGE_SCENES = [
  "town",
  "tavern",
  "forest",
  "dungeon",
  "cave",
  "wilderness",
  "castle",
  "ruins",
  "ocean",
  "plains",
  "mountain",
  "swamp",
  "temple",
  "market",
  "sewers",
] as const

export type FeyForgeScene = typeof FEYFORGE_SCENES[number]
```

Cody adds to this list as new scenes are needed. The admin UI dropdown is
populated from this array.

---

### Stem Assignments UI

Rendered only when `type === "music"`.

A list of **slot rows**, each representing one `musicStem` record to create.
Start with one empty row. Admin can add more with an "Add slot" button and
remove any row with an X button.

**Per slot row fields:**

| Field | Input type | Notes |
|-------|-----------|-------|
| Scene | Dropdown | `FEYFORGE_SCENES` |
| Mode | Dropdown | `explore` / `combat` / `victory` |
| Stem name | Text input | e.g. "Strings", "Pads", "Full Percussion" |
| Intensity min | Number input (1–5) | Must be ≤ intensityMax |
| Intensity max | Number input (1–5) | Must be ≥ intensityMin |

**Sort order** is not exposed — auto-assigned as `intensityMin` on the backend
when the stem record is created.

**Validation** (inline, before submit):
- Scene required
- Mode required
- Stem name required
- `intensityMin` ≥ 1, ≤ 5
- `intensityMax` ≥ intensityMin, ≤ 5
- At least one slot row must be complete if `type === "music"` (can't approve a
  music track with no stem assignments — it would be unreachable by the engine)

---

### Combined submit action

Replace the existing "Approve" button with **"Approve + Assign Stems"** when
`type === "music"`, or keep as "Approve" for ambience/SFX tracks.

On submit for music tracks:
1. Validate all slot rows
2. Call new `approveAndAssignStems` mutation (see below)
3. On success: remove the track from the pending list

---

### Backend: `approveAndAssignStems` mutation

Add to `convex/audio.ts`:

```ts
export const approveAndAssignStems = mutation({
  args: {
    trackId: v.id("audioTracks"),
    tier: v.union(v.literal("free"), v.literal("premium")),
    stems: v.array(v.object({
      sceneName: v.string(),
      mode: v.union(
        v.literal("explore"),
        v.literal("combat"),
        v.literal("victory")
      ),
      name: v.string(),
      intensityMin: v.number(),
      intensityMax: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Verify admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()
    if (!user?.isAdmin) throw new Error("Not authorized")

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")
    if (track.type !== "music") throw new Error("approveAndAssignStems is for music tracks only")

    // Validate all stem intensity ranges
    for (const stem of args.stems) {
      if (stem.intensityMin < 1 || stem.intensityMin > 5)
        throw new Error(`Invalid intensityMin: ${stem.intensityMin}`)
      if (stem.intensityMax < stem.intensityMin || stem.intensityMax > 5)
        throw new Error(`Invalid intensityMax: ${stem.intensityMax}`)
    }

    // Approve the track
    await ctx.db.patch(args.trackId, {
      status: "approved",
      tier: args.tier,
      approvedAt: Date.now(),
      approvedBy: identity.tokenIdentifier,
    })

    // Create one musicStem record per slot
    await Promise.all(
      args.stems.map((stem) =>
        ctx.db.insert("musicStems", {
          userId: identity.tokenIdentifier,
          campaignId: undefined, // global — not campaign-scoped
          sceneName: stem.sceneName,
          mode: stem.mode,
          name: stem.name,
          trackId: args.trackId,
          intensityMin: stem.intensityMin,
          intensityMax: stem.intensityMax,
          sortOrder: stem.intensityMin, // auto-assign
          createdAt: Date.now(),
        })
      )
    )
  },
})
```

---

## Data flow summary

```
Admin drops MP3s in feyforge-audio/ready/
  → node scripts/audio-pipeline/upload.ts --input ./feyforge-audio/ready --type music
  → each file: R2 upload → createAudioTrack (status: pending)
  → tracks appear in admin review queue

Admin opens review page
  → listens to track
  → sets tier (free/premium)
  → fills out stem slot rows:
      scene: "forest", mode: "explore", name: "Strings", min: 2, max: 4
      scene: "dungeon", mode: "explore", name: "Strings", min: 2, max: 4
  → clicks "Approve + Assign Stems"
  → approveAndAssignStems mutation:
      patches audioTrack status → approved
      inserts 2 musicStem records, sortOrder = intensityMin

Engine reads musicStems for active scene+mode
  → stems immediately available in any live session
```

---

## Out of scope (MVP)

- Editing stem assignments after approval (delete + re-approve for now)
- Bulk-assigning the same slot row to multiple tracks at once
- Preview of which stems are active for a given scene+mode before going live
- Campaign-scoped stems (all stems are global for now — `campaignId: undefined`)
