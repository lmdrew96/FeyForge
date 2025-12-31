"use client"

import { AppShell } from "@/components/app-shell"
import { DMAssistant } from "@/components/dm-assistant/dm-assistant"
import { EncounterBuilder } from "@/components/dm-assistant/encounter-builder"
import { LootGenerator } from "@/components/dm-assistant/loot-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Swords, Coins } from "lucide-react"

export default function DMAssistantPage() {
  return (
    <AppShell pageTitle="DM Assistant">
      <div className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] lg:h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
        <Tabs defaultValue="chat" className="flex flex-col h-full">
          <div className="border-b border-border px-3 sm:px-4 lg:px-6 shrink-0">
            <TabsList className="bg-transparent h-12">
              <TabsTrigger 
                value="chat" 
                className="data-[state=active]:bg-fey-cyan/10 data-[state=active]:text-fey-cyan gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">AI Chat</span>
              </TabsTrigger>
              <TabsTrigger 
                value="encounters" 
                className="data-[state=active]:bg-fey-cyan/10 data-[state=active]:text-fey-cyan gap-2"
              >
                <Swords className="h-4 w-4" />
                <span className="hidden sm:inline">Encounters</span>
              </TabsTrigger>
              <TabsTrigger 
                value="loot" 
                className="data-[state=active]:bg-fey-cyan/10 data-[state=active]:text-fey-cyan gap-2"
              >
                <Coins className="h-4 w-4" />
                <span className="hidden sm:inline">Loot</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
            <DMAssistant />
          </TabsContent>
          
          <TabsContent value="encounters" className="flex-1 overflow-auto m-0 p-3 sm:p-4 lg:p-6">
            <EncounterBuilder />
          </TabsContent>
          
          <TabsContent value="loot" className="flex-1 overflow-auto m-0 p-3 sm:p-4 lg:p-6">
            <LootGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
