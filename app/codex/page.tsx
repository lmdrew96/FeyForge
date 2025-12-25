"use client"

import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SpellBrowser } from "@/components/codex/spell-browser"
import { MonsterBrowser } from "@/components/codex/monster-browser"
import { ConditionsReference } from "@/components/codex/conditions-reference"
import { EquipmentReference } from "@/components/codex/equipment-reference"
import { Sparkles, Skull, AlertTriangle, Sword } from "lucide-react"

export default function CodexPage() {
  const [activeTab, setActiveTab] = useState("spells")

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div className="border-b border-border bg-card/30 px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Arcane Codex</h1>
          <p className="text-sm text-muted-foreground">D&D 5e SRD Reference Library</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border bg-card/30 px-6">
            <TabsList className="bg-transparent">
              <TabsTrigger value="spells" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Spells
              </TabsTrigger>
              <TabsTrigger value="monsters" className="gap-2">
                <Skull className="h-4 w-4" />
                Monsters
              </TabsTrigger>
              <TabsTrigger value="conditions" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Conditions
              </TabsTrigger>
              <TabsTrigger value="equipment" className="gap-2">
                <Sword className="h-4 w-4" />
                Equipment
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-6">
            <TabsContent value="spells" className="m-0 h-full">
              <SpellBrowser />
            </TabsContent>
            <TabsContent value="monsters" className="m-0 h-full">
              <MonsterBrowser />
            </TabsContent>
            <TabsContent value="conditions" className="m-0 h-full">
              <ConditionsReference />
            </TabsContent>
            <TabsContent value="equipment" className="m-0 h-full">
              <EquipmentReference />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppShell>
  )
}
