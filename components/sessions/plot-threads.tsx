"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useSessionStore, type PlotThread } from "@/lib/session-store"
import { Plus, GitBranch, Check, X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export function PlotThreads() {
  const { plotThreads, addPlotThread, updatePlotThread, deletePlotThread } = useSessionStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newThread, setNewThread] = useState<Partial<PlotThread>>({
    title: "",
    description: "",
    status: "active",
    importance: "minor",
  })

  const handleAdd = () => {
    if (!newThread.title) return
    addPlotThread(newThread as Omit<PlotThread, "id" | "createdAt">)
    setNewThread({ title: "", description: "", status: "active", importance: "minor" })
    setDialogOpen(false)
  }

  const getStatusIcon = (status: PlotThread["status"]) => {
    switch (status) {
      case "active":
        return <GitBranch className="h-4 w-4 text-fey-cyan" />
      case "resolved":
        return <Check className="h-4 w-4 text-green-500" />
      case "abandoned":
        return <X className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getImportanceColor = (importance: PlotThread["importance"]) => {
    switch (importance) {
      case "major":
        return "border-destructive/50 text-destructive"
      case "minor":
        return "border-fey-cyan/50 text-fey-cyan"
      case "side":
        return "border-border text-muted-foreground"
    }
  }

  const activeThreads = plotThreads.filter((t) => t.status === "active")
  const resolvedThreads = plotThreads.filter((t) => t.status === "resolved")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Plot Threads</h2>
          <p className="text-sm text-muted-foreground">Track your campaign's storylines</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-fey-cyan hover:bg-fey-cyan/90 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Thread
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Plot Thread</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newThread.title}
                  onChange={(e) => setNewThread((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="The Missing Artifact"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newThread.description}
                  onChange={(e) => setNewThread((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this plot thread..."
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Importance</Label>
                <Select
                  value={newThread.importance}
                  onValueChange={(v) =>
                    setNewThread((prev) => ({ ...prev, importance: v as PlotThread["importance"] }))
                  }
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="side">Side Quest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full bg-fey-cyan hover:bg-fey-cyan/90 text-white" 
                onClick={handleAdd}
              >
                Add Plot Thread
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Threads */}
      {activeThreads.length > 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="h-5 w-5 text-fey-cyan" />
              Active Threads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeThreads.map((thread) => (
              <div 
                key={thread.id} 
                className="p-4 rounded-lg border border-border bg-background/30 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(thread.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{thread.title}</h3>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getImportanceColor(thread.importance))}
                        >
                          {thread.importance}
                        </Badge>
                      </div>
                      {thread.description && (
                        <p className="text-sm text-muted-foreground mt-1">{thread.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updatePlotThread(thread.id, { status: "resolved", resolvedAt: new Date() })}
                      className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updatePlotThread(thread.id, { status: "abandoned" })}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warning for forgotten threads */}
      {activeThreads.some((t) => {
        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysSinceCreated > 30
      }) && (
        <Card className="bg-yellow-500/10 border-yellow-500/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <p className="text-sm">
              Some plot threads haven't been addressed in a while. Don't forget about them!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resolved Threads */}
      {resolvedThreads.length > 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
              <Check className="h-5 w-5 text-green-500" />
              Resolved ({resolvedThreads.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resolvedThreads.map((thread) => (
              <div key={thread.id} className="p-3 rounded-lg border border-border bg-background/20">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground line-through">{thread.title}</span>
                  <Badge variant="outline" className="text-xs border-green-500/50 text-green-500">
                    resolved
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {plotThreads.length === 0 && (
        <Card className="bg-card/80 backdrop-blur-sm border-border border-dashed">
          <CardContent className="p-12 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
            <h3 className="text-lg font-bold mb-2">No Plot Threads</h3>
            <p className="text-muted-foreground">Start tracking your campaign's storylines</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
