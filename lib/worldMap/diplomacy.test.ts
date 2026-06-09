import { describe, it, expect } from "vitest"
import { mergeDiplomacy, autoHeadline, pairKey, NEUTRAL, type DiplomacyOverride } from "./diplomacy"

type Realm = { name: string; relations?: { relation: string; realm: string }[] }

const realm = (name: string, relations?: Realm["relations"]): Realm => ({ name, relations })

// An override row with a single shift of the given reveal state. from defaults to a
// neutral base so `to` is the interesting value.
const override = (
  a: string,
  b: string,
  status: string,
  reveal: DiplomacyOverride["log"][number]["reveal"],
  from = NEUTRAL,
): DiplomacyOverride => {
  const [realmA, realmB] = pairKey(a, b)
  return {
    realmA,
    realmB,
    status,
    log: [{ changedAt: 1, from, to: status, reveal }],
  }
}

const relOf = (realms: Realm[], name: string) =>
  realms.find((r) => r.name === name)?.relations ?? []

describe("mergeDiplomacy", () => {
  const realms = (): Realm[] => [
    realm("Thornmarch", [{ relation: "Ally", realm: "Vexel" }]),
    realm("Vexel", [{ relation: "Ally", realm: "Thornmarch" }]),
    realm("Karn"),
  ]

  it("no overrides returns the input untouched", () => {
    const input = realms()
    expect(mergeDiplomacy(input, [], "dm")).toBe(input)
  })

  it("DM sees the true current status even when the shift is only held (not revealed)", () => {
    const ovr = [override("Thornmarch", "Vexel", "Enemy", "held", "Ally")]
    const merged = mergeDiplomacy(realms(), ovr, "dm")
    expect(relOf(merged, "Thornmarch")).toEqual([{ relation: "Enemy", realm: "Vexel" }])
  })

  it("player sees the OLD base state until the shift is revealed", () => {
    const ovr = [override("Thornmarch", "Vexel", "Enemy", "held", "Ally")]
    const merged = mergeDiplomacy(realms(), ovr, "player")
    // Held → not applied for the player; the base Ally relation shows through.
    expect(relOf(merged, "Thornmarch")).toEqual([{ relation: "Ally", realm: "Vexel" }])
  })

  it("player sees a shift once it is revealed", () => {
    const ovr = [override("Thornmarch", "Vexel", "Enemy", "revealed", "Ally")]
    const merged = mergeDiplomacy(realms(), ovr, "player")
    expect(relOf(merged, "Thornmarch")).toEqual([{ relation: "Enemy", realm: "Vexel" }])
  })

  it("player folds to the LAST revealed shift, ignoring a later held one", () => {
    const [realmA, realmB] = pairKey("Thornmarch", "Vexel")
    const ovr: DiplomacyOverride[] = [
      {
        realmA,
        realmB,
        status: "Friendly", // current truth (the held shift)
        log: [
          { changedAt: 1, from: "Ally", to: "Enemy", reveal: "revealed" },
          { changedAt: 2, from: "Enemy", to: "Friendly", reveal: "held" },
        ],
      },
    ]
    expect(relOf(mergeDiplomacy(realms(), ovr, "player"), "Thornmarch")).toEqual([
      { relation: "Enemy", realm: "Vexel" }, // last REVEALED
    ])
    expect(relOf(mergeDiplomacy(realms(), ovr, "dm"), "Thornmarch")).toEqual([
      { relation: "Friendly", realm: "Vexel" }, // truth
    ])
  })

  it("Neutral clears the relation on both cards", () => {
    const ovr = [override("Thornmarch", "Vexel", NEUTRAL, "revealed", "Ally")]
    const merged = mergeDiplomacy(realms(), ovr, "dm")
    expect(relOf(merged, "Thornmarch")).toEqual([])
    expect(relOf(merged, "Vexel")).toEqual([])
  })

  it("applies symmetrically — both realms gain the new relation", () => {
    const ovr = [override("Thornmarch", "Karn", "Enemy", "revealed")]
    const merged = mergeDiplomacy(realms(), ovr, "dm")
    expect(relOf(merged, "Karn")).toEqual([{ relation: "Enemy", realm: "Thornmarch" }])
    expect(relOf(merged, "Thornmarch")).toContainEqual({ relation: "Enemy", realm: "Karn" })
  })

  it("introduces a brand-new relation between two formerly-neutral realms", () => {
    const ovr = [override("Vexel", "Karn", "Ally", "revealed")]
    const merged = mergeDiplomacy(realms(), ovr, "dm")
    expect(relOf(merged, "Karn")).toEqual([{ relation: "Ally", realm: "Vexel" }])
  })

  it("drops a relation to a realm not present on the map", () => {
    const ovr = [override("Thornmarch", "Ghostmere", "Enemy", "revealed")] // Ghostmere absent
    const merged = mergeDiplomacy(realms(), ovr, "dm")
    // Thornmarch keeps only its base Ally→Vexel; the absent-realm override is ignored.
    expect(relOf(merged, "Thornmarch")).toEqual([{ relation: "Ally", realm: "Vexel" }])
  })
})

describe("autoHeadline", () => {
  it("shatters a warm pact that turns cold", () => {
    expect(autoHeadline("Thornmarch", "Vexel", "Enemy", "Ally")).toMatch(/alliance has shattered/i)
  })
  it("makes peace when a cold pair warms", () => {
    expect(autoHeadline("Thornmarch", "Vexel", "Ally", "Enemy")).toMatch(/made peace/i)
  })
  it("falls back to a per-status line without a prior state", () => {
    expect(autoHeadline("Karn", "Vexel", "Ally")).toMatch(/forged an alliance/i)
  })
})
