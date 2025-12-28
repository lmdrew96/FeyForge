"use client"

import { Swords, Play, Square, SkipForward, SkipBack, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CombatantCard } from "./combatant-card"
import { useCombatStore } from "@/lib/combat-store"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function InitiativeList() {
  const { combatants, isInCombat, startCombat, endCombat, nextTurn, previousTurn, sortByInitiative, clearCombat } =
    useCombatStore()

  if (combatants.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Swords className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">No Combatants</h3>
            <p className="text-sm">Add combatants to begin tracking initiative.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Swords className="h-5 w-5 text-fey-purple" />
            Initiative Order
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {!isInCombat ? (
              <>
                <Button variant="outline" size="sm" onClick={sortByInitiative}>
                  Sort
                </Button>
                <Button size="sm" onClick={startCombat} className="bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={previousTurn}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={nextTurn} className="bg-fey-cyan hover:bg-fey-cyan/90">
                  <SkipForward className="h-4 w-4 mr-1" />
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={endCombat}
                  className="text-red-500 border-red-500/50 hover:bg-red-500/10 bg-transparent"
                >
                  <Square className="h-4 w-4 mr-1" />
                  End
                </Button>
              </>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Combat?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all combatants from the tracker. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearCombat} className="bg-destructive hover:bg-destructive/90">
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {combatants.map((combatant, index) => (
          <CombatantCard key={combatant.id} combatant={combatant} index={index} />
        ))}
      </CardContent>
    </Card>
  )
}
