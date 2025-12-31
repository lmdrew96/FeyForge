"use client"

import { AppShell } from "@/components/app-shell"
import { NPCList } from "@/components/npcs/npc-list"
import { NPCGenerator } from "@/components/npcs/npc-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Sparkles } from "lucide-react"

export default function NPCsPage() {
  return (
    <AppShell pageTitle="NPCs">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full min-w-0">
        <Tabs defaultValue="list" className="space-y-4 sm:space-y-6">
          <div className="border-b border-border -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
            <TabsList className="bg-transparent h-12">
              <TabsTrigger 
                value="list" 
                className="data-[state=active]:bg-fey-purple/10 data-[state=active]:text-fey-purple gap-2"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">NPC List</span>
              </TabsTrigger>
              <TabsTrigger 
                value="generator" 
                className="data-[state=active]:bg-fey-purple/10 data-[state=active]:text-fey-purple gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI Generator</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="list" className="m-0">
            <NPCList />
          </TabsContent>
          
          <TabsContent value="generator" className="m-0">
            <NPCGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
