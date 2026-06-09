import { describe, it, expect } from "vitest"
import { archetypeFor, eventScopeBand, eventTemplate, type WorldEventLike } from "./eventHooks"

const place = (name: string, realm?: string): NonNullable<WorldEventLike["places"]>[number] => ({
  name,
  x: 0,
  y: 0,
  town: realm ? { realm } : undefined,
})

describe("archetypeFor", () => {
  it("routes Azgaar conflict types", () => {
    expect(archetypeFor("Invasion", "Invasion of the North")).toBe("conflict")
    expect(archetypeFor("Rebels", "The Iron Rebellion")).toBe("conflict")
  })

  it("routes religious types (incl. Crusade, which is an armed faith-war)", () => {
    expect(archetypeFor("Proselytism", "The Great Conversion")).toBe("religious")
    expect(archetypeFor("Crusade", "Crusade of the Dawn")).toBe("religious")
  })

  it("routes geological/weather disasters", () => {
    expect(archetypeFor("Eruption", "Mount Cinder Wakes")).toBe("disaster")
    expect(archetypeFor("Flood", "The Long Rains")).toBe("disaster")
    expect(archetypeFor("Disaster", "The Cataclysm")).toBe("disaster")
  })

  it("routes Disease/Plague to affliction", () => {
    expect(archetypeFor("Disease", "The Grey Cough")).toBe("affliction")
  })

  // THE GOTCHA: Azgaar files Famine/Dearth under type "Disaster". The name must win so a
  // famine reads as a slow humanitarian crisis, not a geological calamity.
  it("routes a Famine tagged type=Disaster to affliction via name-sniff", () => {
    expect(archetypeFor("Disaster", "The Great Famine")).toBe("affliction")
    expect(archetypeFor("Disaster", "Years of Dearth")).toBe("affliction")
  })

  it("routes economic flux", () => {
    expect(archetypeFor("Trade", "The Salt Boom")).toBe("flux")
  })

  it("falls back to generic for unknown types", () => {
    expect(archetypeFor("Mystery", "A Strange Omen")).toBe("generic")
  })
})

describe("eventScopeBand", () => {
  it("bands by cell count, null when absent", () => {
    expect(eventScopeBand(undefined)).toBeNull()
    expect(eventScopeBand(0)).toBeNull()
    expect(eventScopeBand(5)).toBe("Localized")
    expect(eventScopeBand(8)).toBe("Localized")
    expect(eventScopeBand(9)).toBe("Regional")
    expect(eventScopeBand(40)).toBe("Regional")
    expect(eventScopeBand(41)).toBe("Widespread")
  })
})

describe("eventTemplate", () => {
  it("names the involved realms and affected settlements in the hook", () => {
    const ev: WorldEventLike = {
      name: "Invasion of the North",
      type: "Invasion",
      cellCount: 50,
      places: [place("Aldermoor", "Aldland"), place("Castle Grey", "Aldland")],
    }
    const t = eventTemplate(ev)
    expect(t.archetype).toBe("conflict")
    expect(t.scope).toBe("Widespread")
    expect(t.realms).toEqual(["Aldland"]) // deduped
    expect(t.settlements).toEqual(["Aldermoor", "Castle Grey"])
    expect(t.hook).toContain("Aldland")
    expect(t.hook).toContain("Aldermoor and Castle Grey")
    expect(t.hook).toContain("widespread")
  })

  it("degrades gracefully with no places and no cellCount", () => {
    const t = eventTemplate({ name: "A Strange Omen", type: "Mystery" })
    expect(t.scope).toBeNull()
    expect(t.realms).toEqual([])
    expect(t.settlements).toEqual([])
    expect(t.hook).toContain("the surrounding settlements")
    expect(t.hook).toContain("A Strange Omen") // generic fallback leads with the name
    // No scope word and no realm clause leaks through as undefined/empty.
    expect(t.hook).not.toContain("undefined")
  })

  it("caps long settlement lists with an 'and N more' tail", () => {
    const places = ["A", "B", "C", "D", "E"].map((n) => place(n, "Realm"))
    const t = eventTemplate({ name: "Plague", type: "Disease", cellCount: 3, places })
    expect(t.archetype).toBe("affliction")
    expect(t.scope).toBe("Localized")
    expect(t.hook).toContain("A, B, C, and 2 more")
  })
})
