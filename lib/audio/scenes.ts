/**
 * Scene IDs for music stem assignment. Mirrors the live-session scene picker
 * in lib/scenes.ts so admin assignments line up with what
 * `partySessions.activeScene` actually holds — without this match, stems
 * never resolve. "" (Neutral) is excluded since "no scene" has no audio.
 */
import { SCENES } from "@/lib/scenes"

type NonNeutralSceneId = Exclude<(typeof SCENES)[number]["id"], "">

export const FEYFORGE_SCENES: ReadonlyArray<NonNeutralSceneId> = SCENES
  .filter((s): s is (typeof SCENES)[number] & { id: NonNeutralSceneId } => s.id !== "")
  .map((s) => s.id)

export type FeyForgeScene = NonNeutralSceneId
