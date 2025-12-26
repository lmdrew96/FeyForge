"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Search, AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { open5eApi } from "@/lib/open5e-api"
import useSWR from "swr"

export function ConditionsReference() {
  const [search, setSearch] = useState("")

  const {
    data: conditions,
    error,
    isLoading,
    mutate,
  } = useSWR("conditions", () => open5eApi.getConditions(), { revalidateOnFocus: false })

  const filteredConditions = (conditions || []).filter((condition) =>
    condition.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conditions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={() => mutate()} disabled={isLoading} title="Refresh from API">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading conditions from Open5e...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            <p>Failed to load conditions. Please try again.</p>
            <Button variant="outline" className="mt-2 bg-transparent" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 pr-4">
            {filteredConditions.map((condition) => (
              <Card key={condition.slug} className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    {condition.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words overflow-hidden">
                    {condition.desc}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredConditions.length === 0 && !isLoading && (
              <p className="col-span-2 py-8 text-center text-muted-foreground">No conditions found</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
