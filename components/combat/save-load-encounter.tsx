"use client"

import { useState, useEffect } from "react"
import { Save, FolderOpen, Trash2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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

export function SaveEncounterDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const { saveEncounter, combatants } = useCombatStore()

  const handleSave = () => {
    if (name.trim()) {
      saveEncounter(name.trim())
      setName("")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={combatants.length === 0}>
          <Save className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="hidden sm:inline">Save</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle>Save Encounter</DialogTitle>
          <DialogDescription>Save the current combat state to load later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 min-w-0">
          <Input
            placeholder="Encounter name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button onClick={handleSave} disabled={!name.trim()} className="w-full">
            <Save className="h-4 w-4 mr-2 flex-shrink-0" />
            Save Encounter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LoadEncounterDialog() {
  const [open, setOpen] = useState(false)
  const { savedEncounters, loadEncounter, deleteEncounter, initialize } = useCombatStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  const handleLoad = (id: string) => {
    loadEncounter(id)
    setOpen(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="hidden sm:inline">Load</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle>Load Encounter</DialogTitle>
          <DialogDescription>Load a previously saved encounter.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden min-w-0">
          {savedEncounters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No saved encounters.</p>
              <p className="text-sm">Save an encounter to load it later.</p>
            </div>
          ) : (
            savedEncounters.map((encounter) => (
              <div
                key={encounter.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors min-w-0 overflow-hidden"
              >
                <button 
                  onClick={() => handleLoad(encounter.id)} 
                  className="flex-1 text-left min-w-0 overflow-hidden"
                  aria-label={`Load ${encounter.name} encounter`}
                >
                  <p className="font-medium truncate text-sm sm:text-base">{encounter.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                    <span className="whitespace-nowrap">{encounter.combatants.length} combatants</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="whitespace-nowrap">Round {encounter.round}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      {formatDate(encounter.createdAt)}
                    </span>
                  </div>
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="overflow-hidden">
                    <AlertDialogHeader className="min-w-0">
                      <AlertDialogTitle>Delete Encounter?</AlertDialogTitle>
                      <AlertDialogDescription className="break-words">
                        This will permanently delete &quot;{encounter.name}&quot;. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteEncounter(encounter.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
