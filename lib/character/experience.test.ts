import { describe, it, expect } from "vitest"
import {
  getLevelFromXP,
  getXPForLevel,
  getXPToNextLevel,
  getXPProgress,
  wouldLevelUp,
  getLevelsGained,
  ExperienceTracker,
  MilestoneLeveling,
} from "./experience"

describe("getLevelFromXP", () => {
  it("clamps to level 1 below the first threshold", () => {
    expect(getLevelFromXP(0)).toBe(1)
    expect(getLevelFromXP(299)).toBe(1)
    expect(getLevelFromXP(-100)).toBe(1)
  })

  it("lands exactly on a threshold's level", () => {
    expect(getLevelFromXP(300)).toBe(2)
    expect(getLevelFromXP(900)).toBe(3)
    expect(getLevelFromXP(2700)).toBe(4)
  })

  it("returns the lower level when between thresholds", () => {
    expect(getLevelFromXP(899)).toBe(2)
    expect(getLevelFromXP(2699)).toBe(3)
  })

  it("caps at level 20", () => {
    expect(getLevelFromXP(355000)).toBe(20)
    expect(getLevelFromXP(9_999_999)).toBe(20)
  })
})

describe("getXPForLevel", () => {
  it("returns the threshold for valid levels", () => {
    expect(getXPForLevel(1)).toBe(0)
    expect(getXPForLevel(5)).toBe(6500)
    expect(getXPForLevel(20)).toBe(355000)
  })

  it("clamps out-of-range levels", () => {
    expect(getXPForLevel(0)).toBe(0)
    expect(getXPForLevel(-5)).toBe(0)
    expect(getXPForLevel(25)).toBe(355000)
  })
})

describe("getXPToNextLevel", () => {
  it("is the gap to the next threshold", () => {
    expect(getXPToNextLevel(0)).toBe(300) // L1 -> L2
    expect(getXPToNextLevel(300)).toBe(600) // L2 -> L3
  })

  it("is 0 at level 20", () => {
    expect(getXPToNextLevel(355000)).toBe(0)
  })
})

describe("getXPProgress", () => {
  it("is 0 at the start of a level", () => {
    expect(getXPProgress(0)).toBe(0)
    expect(getXPProgress(300)).toBe(0)
  })

  it("is the floored percentage into the current level", () => {
    expect(getXPProgress(150)).toBe(50) // halfway from 0 to 300
  })

  it("is 100 at level 20", () => {
    expect(getXPProgress(355000)).toBe(100)
  })
})

describe("wouldLevelUp", () => {
  it("is true when added XP crosses a threshold", () => {
    expect(wouldLevelUp(0, 300)).toBe(true)
  })

  it("is false when it does not", () => {
    expect(wouldLevelUp(0, 299)).toBe(false)
  })
})

describe("getLevelsGained", () => {
  it("lists every level crossed in order", () => {
    expect(getLevelsGained(0, 900)).toEqual([2, 3])
  })

  it("is empty when no level is gained", () => {
    expect(getLevelsGained(0, 100)).toEqual([])
  })
})

describe("ExperienceTracker", () => {
  it("clamps a negative starting XP to 0", () => {
    expect(new ExperienceTracker(-50).xp).toBe(0)
  })

  it("derives level from XP", () => {
    expect(new ExperienceTracker(6500).level).toBe(5)
  })

  it("addXP advances XP and reports levels gained", () => {
    const t = new ExperienceTracker(500) // level 2
    const result = t.addXP(400) // -> 900 = level 3
    expect(result.newXP).toBe(900)
    expect(result.levelsGained).toEqual([3])
    expect(t.level).toBe(3)
  })

  it("setLevel snaps XP to that level's threshold", () => {
    const t = new ExperienceTracker()
    t.setLevel(5)
    expect(t.xp).toBe(6500)
  })
})

describe("MilestoneLeveling", () => {
  it("setToLevel returns the threshold", () => {
    expect(MilestoneLeveling.setToLevel(3)).toBe(900)
  })

  it("levelUp moves to the next level, capped at 20", () => {
    expect(MilestoneLeveling.levelUp(0)).toBe(300)
    expect(MilestoneLeveling.levelUp(355000)).toBe(355000)
  })

  it("levelDown moves to the previous level, floored at 0", () => {
    expect(MilestoneLeveling.levelDown(900)).toBe(300)
    expect(MilestoneLeveling.levelDown(0)).toBe(0)
  })
})
