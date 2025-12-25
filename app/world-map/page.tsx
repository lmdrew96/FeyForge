import { AppShell } from "@/components/layout/app-shell"
import { WorldMap } from "@/components/world/world-map"

export default function WorldMapPage() {
  return (
    <AppShell title="World Map" subtitle="Track locations and plan your adventures">
      <WorldMap />
    </AppShell>
  )
}
