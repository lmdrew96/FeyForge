import { describe, it, expect } from "vitest"
import { isHomebrewId, rawHomebrewId } from "./homebrew-id"

// Part B (NPCs in combat) links an NPC's "fights as…" homebrew stat block by the RAW
// Id<"homebrew">, but partitionHomebrew() hands the UI ids prefixed with "hb:". The
// whole homebrew-ref resolution path — editor stores raw, combat tracker + attack
// panel match `rawHomebrewId(m.id) === ref.homebrewId` against the live list —
// depends on this prefix round-trip being exact. tsc can't catch a prefix-handling
// slip, so pin it here.

describe("rawHomebrewId", () => {
  const PREFIXED = "hb:k1234567890abcdef"
  const RAW = "k1234567890abcdef"

  it("strips the hb: prefix to recover the raw Convex id", () => {
    expect(rawHomebrewId(PREFIXED)).toBe(RAW)
  })

  it("is idempotent on an already-raw id (stored refs are raw)", () => {
    expect(rawHomebrewId(RAW)).toBe(RAW)
  })

  it("round-trips so a stored ref matches the prefixed list id", () => {
    // editor: stores rawHomebrewId(m.id); tracker/panel: matches against m.id again.
    const stored = rawHomebrewId(PREFIXED)
    expect(rawHomebrewId(PREFIXED) === stored).toBe(true)
    expect(isHomebrewId(PREFIXED)).toBe(true)
    expect(isHomebrewId(stored)).toBe(false)
  })
})
