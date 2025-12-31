"use client"

import { AppShell } from "@/components/app-shell"
import { SessionList } from "@/components/sessions/session-list"
import { PlotThreads } from "@/components/sessions/plot-threads"
import { XPCalculator } from "@/components/sessions/xp-calculator"
import { CampaignTimeline } from "@/components/sessions/campaign-timeline"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollText, GitBranch, Trophy, Calendar } from "lucide-react"

export default function SessionsPage() {
  return (
    <AppShell pageTitle="Sessions">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full min-w-0">
        <Tabs defaultValue="list" className="space-y-4 sm:space-y-6">
          <div className="border-b border-border -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
            <TabsList className="bg-transparent h-12">
              <TabsTrigger 
                value="list" 
                className="data-[state=active]:bg-fey-gold/10 data-[state=active]:text-fey-gold gap-2"
              >
                <ScrollText className="h-4 w-4" />
                <span className="hidden sm:inline">Sessions</span>
              </TabsTrigger>
              <TabsTrigger 
                value="timeline" 
                className="data-[state=active]:bg-fey-gold/10 data-[state=active]:text-fey-gold gap-2"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plot" 
                className="data-[state=active]:bg-fey-gold/10 data-[state=active]:text-fey-gold gap-2"
              >
                <GitBranch className="h-4 w-4" />
                <span className="hidden sm:inline">Plot Threads</span>
              </TabsTrigger>
              <TabsTrigger 
                value="xp" 
                className="data-[state=active]:bg-fey-gold/10 data-[state=active]:text-fey-gold gap-2"
              >
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">XP Calculator</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="list" className="m-0">
            <SessionList />
          </TabsContent>
          
          <TabsContent value="timeline" className="m-0">
            <CampaignTimeline />
          </TabsContent>
          
          <TabsContent value="plot" className="m-0">
            <PlotThreads />
          </TabsContent>
          
          <TabsContent value="xp" className="m-0">
            <XPCalculator />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
