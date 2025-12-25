"use client"

import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Download, Upload, AlertTriangle } from "lucide-react"
import { useState } from "react"

export default function SettingsPage() {
  const [diceSound, setDiceSound] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(true)
  const [diceAnimation, setDiceAnimation] = useState(true)

  const handleExportData = () => {
    const data = {
      characters: localStorage.getItem("dnd-characters"),
      sessions: localStorage.getItem("dnd-sessions"),
      npcs: localStorage.getItem("dnd-npcs"),
      combat: localStorage.getItem("dnd-combat"),
      world: localStorage.getItem("dnd-world"),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `arcane-codex-backup-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      localStorage.removeItem("dnd-characters")
      localStorage.removeItem("dnd-sessions")
      localStorage.removeItem("dnd-npcs")
      localStorage.removeItem("dnd-combat")
      localStorage.removeItem("dnd-world")
      window.location.reload()
    }
  }

  return (
    <AppShell title="Settings" subtitle="Configure your Arcane Codex experience">
      <div className="max-w-2xl space-y-6">
        {/* General Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif">General</CardTitle>
            <CardDescription>Basic application preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-save">Auto-save</Label>
                <p className="text-sm text-muted-foreground">Automatically save changes as you make them</p>
              </div>
              <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="confirm-delete">Confirm deletions</Label>
                <p className="text-sm text-muted-foreground">Ask for confirmation before deleting items</p>
              </div>
              <Switch id="confirm-delete" checked={confirmDelete} onCheckedChange={setConfirmDelete} />
            </div>

            <Separator className="bg-border" />

            <div className="space-y-2">
              <Label htmlFor="default-dice">Default dice notation</Label>
              <Select defaultValue="1d20">
                <SelectTrigger className="w-full bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="1d20">1d20 (Standard)</SelectItem>
                  <SelectItem value="2d6">2d6</SelectItem>
                  <SelectItem value="1d100">1d100 (Percentile)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Dice Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif">Dice Roller</CardTitle>
            <CardDescription>Customize your dice rolling experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dice-sound">Dice sounds</Label>
                <p className="text-sm text-muted-foreground">Play sound effects when rolling dice</p>
              </div>
              <Switch id="dice-sound" checked={diceSound} onCheckedChange={setDiceSound} />
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dice-animation">Dice animations</Label>
                <p className="text-sm text-muted-foreground">Show rolling animations for dice</p>
              </div>
              <Switch id="dice-animation" checked={diceAnimation} onCheckedChange={setDiceAnimation} />
            </div>
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif">AI Assistant</CardTitle>
            <CardDescription>Configure your AI DM assistant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-style">Response style</Label>
              <Select defaultValue="balanced">
                <SelectTrigger className="w-full bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="concise">Concise - Brief, to-the-point responses</SelectItem>
                  <SelectItem value="balanced">Balanced - Moderate detail</SelectItem>
                  <SelectItem value="detailed">Detailed - Rich, descriptive responses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif">Data Management</CardTitle>
            <CardDescription>Export, import, or clear your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2 border-border bg-transparent" onClick={handleExportData}>
                <Download className="h-4 w-4" />
                Export All Data
              </Button>
              <Button variant="outline" className="gap-2 border-border bg-transparent" disabled>
                <Upload className="h-4 w-4" />
                Import Data
              </Button>
            </div>

            <Separator className="bg-border" />

            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-destructive">Danger Zone</h4>
                  <p className="text-sm text-muted-foreground">
                    Clearing your data will permanently delete all characters, sessions, NPCs, and other saved content.
                  </p>
                  <Button variant="destructive" size="sm" className="gap-2" onClick={handleClearData}>
                    <Trash2 className="h-4 w-4" />
                    Clear All Data
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
