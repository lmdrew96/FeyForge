"use client"

import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DmChat } from "@/components/dm-assistant/dm-chat"
import { EncounterBuilder } from "@/components/dm-assistant/encounter-builder"
import { LootGenerator } from "@/components/dm-assistant/loot-generator"
import { MessageSquare, Sword, Coins } from "lucide-react"

export default function DmAssistantPage() {
  const [activeTab, setActiveTab] = useState("chat")

  return (
    <AppShell title="DM Assistant" subtitle="AI-powered tools to help you run your game">
      <div className="flex flex-1 flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0">
          <div className="border-b border-border bg-card/30 px-6">
            <TabsList className="bg-transparent">
              <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-accent">
                <MessageSquare className="h-4 w-4" />
                AI Chat
              </TabsTrigger>
              <TabsTrigger value="encounter" className="gap-2 data-[state=active]:bg-accent">
                <Sword className="h-4 w-4" />
                Encounter Builder
              </TabsTrigger>
              <TabsTrigger value="loot" className="gap-2 data-[state=active]:bg-accent">
                <Coins className="h-4 w-4" />
                Loot Generator
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="chat" className="m-0 h-full">
              <DmChat />
            </TabsContent>
            <TabsContent value="encounter" className="m-0 h-full overflow-auto p-6">
              <EncounterBuilder />
            </TabsContent>
            <TabsContent value="loot" className="m-0 h-full overflow-auto p-6">
              <LootGenerator />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppShell>
  )
}
