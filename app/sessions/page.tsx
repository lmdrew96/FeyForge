import { AppShell } from "@/components/layout/app-shell"
import { SessionList } from "@/components/sessions/session-list"
import { PlotThreads } from "@/components/sessions/plot-threads"
import { CampaignTimeline } from "@/components/sessions/campaign-timeline"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SessionsPage() {
  return (
    <AppShell title="Sessions" subtitle="Track your campaign's journey">
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="mb-6 bg-muted">
          <TabsTrigger value="sessions" className="data-[state=active]:bg-accent">
            Sessions
          </TabsTrigger>
          <TabsTrigger value="plots" className="data-[state=active]:bg-accent">
            Plot Threads
          </TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-accent">
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionList />
        </TabsContent>

        <TabsContent value="plots">
          <PlotThreads />
        </TabsContent>

        <TabsContent value="timeline">
          <CampaignTimeline />
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
