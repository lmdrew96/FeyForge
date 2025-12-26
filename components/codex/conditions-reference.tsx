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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-1.5 sm:gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conditions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={() => mutate()} disabled={isLoading} title="Refresh from API" className="h-9 w-9 sm:h-10 sm:w-10 min-w-[36px] min-h-[36px]">
          <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <ScrollArea className="h-[250px] sm:h-[300px] lg:h-[calc(100vh-280px)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
            <span className="ml-2 text-sm sm:text-base text-muted-foreground">Loading conditions...</span>
          </div>
        ) : error ? (
          <div className="py-6 sm:py-8 text-center text-destructive">
            <p className="text-sm sm:text-base">Failed to load conditions. Please try again.</p>
            <Button variant="outline" className="mt-2 bg-transparent h-9 sm:h-10 text-sm" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 pr-2 sm:pr-4">
            {filteredConditions.map((condition) => (
              <Card key={condition.slug} className="border-border/50 bg-card/50">
                <CardHeader className="pb-1.5 sm:pb-2 p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 shrink-0" />
                    {condition.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap break-words overflow-hidden">
                    {condition.desc}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredConditions.length === 0 && !isLoading && (
              <p className="col-span-2 py-6 sm:py-8 text-center text-sm sm:text-base text-muted-foreground">No conditions found</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
