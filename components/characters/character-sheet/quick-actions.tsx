"use client"

/**
 * Quick Actions Component
 * One-click attack and spell casting buttons
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Sword, 
  Wand2, 
  Shield, 
  Target,
  Dices,
  ChevronRight,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { rollDice, rollWithAdvantage, rollWithDisadvantage, parseDiceNotation, type DiceConfig } from "@/lib/dice"
import { formatModifier } from "@/lib/character/constants"

// Local type for roll results in this component
interface LocalRollResult {
  rolls: number[]
  total: number
}

// ============================================
// TYPES
// ============================================

interface AttackAction {
  id: string
  name: string
  type: "melee" | "ranged" | "spell"
  attackBonus: number
  damage: {
    dice: string  // e.g., "1d8"
    bonus: number
    type: string  // e.g., "slashing"
  }
  properties?: string[]  // e.g., ["versatile (1d10)", "finesse"]
  range?: {
    normal: number
    long?: number
  }
  reach?: number
}

interface SpellAction {
  id: string
  name: string
  level: number
  school: string
  castingTime: string
  saveDC?: number
  spellAttackBonus?: number
  damage?: {
    dice: string
    type: string
  }
  effect?: string
  concentration?: boolean
}

interface RollResult {
  action: AttackAction | SpellAction
  attackRoll?: LocalRollResult
  damageRoll?: LocalRollResult
  isCritical?: boolean
  isFumble?: boolean
  advantage?: "advantage" | "disadvantage" | "normal"
}

// ============================================
// QUICK ACTIONS PANEL
// ============================================

interface QuickActionsProps {
  attacks: AttackAction[]
  spells?: SpellAction[]
  onRoll?: (result: RollResult) => void
  proficiencyBonus: number
}

export function QuickActions({ 
  attacks, 
  spells = [],
  onRoll,
  proficiencyBonus,
}: QuickActionsProps) {
  const [selectedAction, setSelectedAction] = useState<AttackAction | SpellAction | null>(null)
  const [lastResult, setLastResult] = useState<RollResult | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)

  // Helper to roll a d20
  const roll1d20 = (): LocalRollResult => {
    const config: DiceConfig = { count: 1, sides: 20, modifier: 0 }
    const rolls = rollDice(config)
    return { rolls, total: rolls.reduce((a, b) => a + b, 0) }
  }

  // Helper to roll damage dice
  const rollDamage = (dice: string): LocalRollResult => {
    const config = parseDiceNotation(dice) || { count: 1, sides: 6, modifier: 0 }
    const rolls = rollDice(config)
    return { rolls, total: rolls.reduce((a, b) => a + b, 0) }
  }

  const handleAttack = (attack: AttackAction, advantage: "advantage" | "disadvantage" | "normal" = "normal") => {
    // Roll attack
    let attackRoll: LocalRollResult
    
    if (advantage === "advantage") {
      const result = rollWithAdvantage(20)
      attackRoll = { rolls: result.rolls, total: result.result }
    } else if (advantage === "disadvantage") {
      const result = rollWithDisadvantage(20)
      attackRoll = { rolls: result.rolls, total: result.result }
    } else {
      attackRoll = roll1d20()
    }

    const naturalRoll = advantage !== "normal" 
      ? (advantage === "advantage" ? Math.max(...attackRoll.rolls) : Math.min(...attackRoll.rolls))
      : attackRoll.rolls[0]
    const isCritical = naturalRoll === 20
    const isFumble = naturalRoll === 1

    // Roll damage
    const [diceCount, diceSize] = attack.damage.dice.split("d").map(Number)
    const diceStr = isCritical ? `${diceCount * 2}d${diceSize}` : attack.damage.dice
    const damageRoll = rollDamage(diceStr)

    const result: RollResult = {
      action: attack,
      attackRoll: {
        rolls: attackRoll.rolls,
        total: attackRoll.total + attack.attackBonus,
      },
      damageRoll: {
        rolls: damageRoll.rolls,
        total: damageRoll.total + attack.damage.bonus,
      },
      isCritical,
      isFumble,
      advantage,
    }

    setLastResult(result)
    setShowResultDialog(true)
    onRoll?.(result)
  }

  const handleSpellAttack = (spell: SpellAction) => {
    if (!spell.spellAttackBonus && !spell.damage) {
      // Non-damage spell, just show info
      setSelectedAction(spell)
      return
    }

    let attackRoll: LocalRollResult | undefined
    let damageRoll: LocalRollResult | undefined
    let isCritical = false
    let isFumble = false

    if (spell.spellAttackBonus !== undefined) {
      attackRoll = roll1d20()
      isCritical = attackRoll.rolls[0] === 20
      isFumble = attackRoll.rolls[0] === 1
      attackRoll = {
        rolls: attackRoll.rolls,
        total: attackRoll.total + spell.spellAttackBonus,
      }
    }

    if (spell.damage) {
      const [diceCount, diceSize] = spell.damage.dice.split("d").map(Number)
      const diceStr = isCritical ? `${diceCount * 2}d${diceSize}` : spell.damage.dice
      damageRoll = rollDamage(diceStr)
    }

    const result: RollResult = {
      action: spell,
      attackRoll,
      damageRoll,
      isCritical,
      isFumble,
    }

    setLastResult(result)
    setShowResultDialog(true)
    onRoll?.(result)
  }

  return (
    <>
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Attacks */}
          {attacks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Sword className="h-3 w-3" />
                Attacks
              </h4>
              <div className="grid gap-2">
                {attacks.map((attack) => (
                  <AttackButton
                    key={attack.id}
                    attack={attack}
                    onAttack={handleAttack}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Spells */}
          {spells.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Wand2 className="h-3 w-3" />
                Quick Spells
              </h4>
              <div className="grid gap-2">
                {spells.slice(0, 5).map((spell) => (
                  <SpellButton
                    key={spell.id}
                    spell={spell}
                    onCast={handleSpellAttack}
                  />
                ))}
              </div>
            </div>
          )}

          {attacks.length === 0 && spells.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No quick actions configured
            </p>
          )}
        </CardContent>
      </Card>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dices className="h-5 w-5" />
              {lastResult?.action.name}
            </DialogTitle>
          </DialogHeader>
          {lastResult && <RollResultDisplay result={lastResult} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================
// ATTACK BUTTON
// ============================================

interface AttackButtonProps {
  attack: AttackAction
  onAttack: (attack: AttackAction, advantage?: "advantage" | "disadvantage" | "normal") => void
}

function AttackButton({ attack, onAttack }: AttackButtonProps) {
  const [showOptions, setShowOptions] = useState(false)

  const Icon = attack.type === "melee" ? Sword : attack.type === "ranged" ? Target : Wand2

  return (
    <div className="relative">
      <div className="flex gap-1">
        <Button
          variant="outline"
          className="flex-1 justify-between h-auto py-2 px-3"
          onClick={() => onAttack(attack, "normal")}
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="font-medium">{attack.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-primary font-medium">
              {formatModifier(attack.attackBonus)}
            </span>
            <span>|</span>
            <span>
              {attack.damage.dice}{attack.damage.bonus ? `+${attack.damage.bonus}` : ""}
            </span>
          </div>
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="px-2"
                onClick={() => setShowOptions(!showOptions)}
              >
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  showOptions && "rotate-90"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Advantage/Disadvantage</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {showOptions && (
        <div className="flex gap-1 mt-1">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs text-green-400"
            onClick={() => {
              onAttack(attack, "advantage")
              setShowOptions(false)
            }}
          >
            Advantage
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs text-red-400"
            onClick={() => {
              onAttack(attack, "disadvantage")
              setShowOptions(false)
            }}
          >
            Disadvantage
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================
// SPELL BUTTON
// ============================================

interface SpellButtonProps {
  spell: SpellAction
  onCast: (spell: SpellAction) => void
}

function SpellButton({ spell, onCast }: SpellButtonProps) {
  return (
    <Button
      variant="outline"
      className="justify-between h-auto py-2 px-3"
      onClick={() => onCast(spell)}
    >
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-purple-400" />
        <span className="font-medium">{spell.name}</span>
        {spell.concentration && (
          <Badge variant="outline" className="text-[10px] px-1">
            C
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {spell.level === 0 ? (
          <Badge variant="secondary" className="text-[10px]">Cantrip</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Lvl {spell.level}</Badge>
        )}
        {spell.damage && (
          <span className="text-primary">{spell.damage.dice}</span>
        )}
        {spell.saveDC && (
          <span>DC {spell.saveDC}</span>
        )}
      </div>
    </Button>
  )
}

// ============================================
// ROLL RESULT DISPLAY
// ============================================

interface RollResultDisplayProps {
  result: RollResult
}

function RollResultDisplay({ result }: RollResultDisplayProps) {
  const { attackRoll, damageRoll, isCritical, isFumble, advantage } = result
  const isAttack = "attackBonus" in result.action

  return (
    <div className="space-y-4">
      {/* Advantage indicator */}
      {advantage && advantage !== "normal" && (
        <div className={cn(
          "text-center text-sm font-medium py-1 rounded",
          advantage === "advantage" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        )}>
          Rolling with {advantage}
        </div>
      )}

      {/* Attack Roll */}
      {attackRoll && (
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Attack Roll</div>
          <div className={cn(
            "text-4xl font-bold",
            isCritical && "text-green-400",
            isFumble && "text-red-400"
          )}>
            {attackRoll.total}
          </div>
          <div className="text-sm text-muted-foreground">
            ({attackRoll.rolls.join(", ")}) {isAttack && `+ ${(result.action as AttackAction).attackBonus}`}
          </div>
          {isCritical && (
            <Badge className="bg-green-500 mt-2">CRITICAL HIT!</Badge>
          )}
          {isFumble && (
            <Badge className="bg-red-500 mt-2">CRITICAL MISS!</Badge>
          )}
        </div>
      )}

      {/* Damage Roll */}
      {damageRoll && (
        <div className="text-center border-t pt-4">
          <div className="text-sm text-muted-foreground mb-1">
            Damage {isCritical && "(Critical)"}
          </div>
          <div className="text-3xl font-bold text-orange-400">
            {damageRoll.total}
          </div>
          <div className="text-sm text-muted-foreground">
            ({damageRoll.rolls.join(" + ")})
            {isAttack && (result.action as AttackAction).damage.bonus > 0 && 
              ` + ${(result.action as AttackAction).damage.bonus}`
            }
          </div>
          {isAttack && (
            <Badge variant="outline" className="mt-2">
              {(result.action as AttackAction).damage.type}
            </Badge>
          )}
          {"damage" in result.action && result.action.damage && (
            <Badge variant="outline" className="mt-2">
              {result.action.damage.type}
            </Badge>
          )}
        </div>
      )}

      {/* Save DC for spells */}
      {"saveDC" in result.action && result.action.saveDC && !attackRoll && (
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Save DC</div>
          <div className="text-4xl font-bold">{result.action.saveDC}</div>
        </div>
      )}
    </div>
  )
}

// ============================================
// EXPORTS
// ============================================

export type { AttackAction, SpellAction, RollResult }
