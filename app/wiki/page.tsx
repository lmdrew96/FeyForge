"use client"

import { useState, useMemo } from "react"
import {
  Book,
  MapPin,
  Users,
  Scroll,
  Gem,
  Calendar,
  Layers,
  Plus,
  Search,
  Filter,
  Link2,
  Eye,
  EyeOff,
} from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useWikiStore, type WikiEntryType, type WikiEntry } from "@/lib/wiki-store"
import { useCampaignsStore } from "@/lib/campaigns-store"
import Link from "next/link"

const entryTypeConfig: Record<
  WikiEntryType,
  { icon: typeof MapPin; label: string; color: string }
> = {
  location: { icon: MapPin, label: "Location", color: "text-fey-forest" },
  faction: { icon: Users, label: "Faction", color: "text-fey-purple" },
  lore: { icon: Scroll, label: "Lore", color: "text-fey-gold" },
  item: { icon: Gem, label: "Item", color: "text-fey-cyan" },
  event: { icon: Calendar, label: "Event", color: "text-fey-crimson" },
  custom: { icon: Layers, label: "Custom", color: "text-muted-foreground" },
}

function WikiEntryCard({ entry }: { entry: WikiEntry }) {
  const { getLinkedEntries, getBacklinks } = useWikiStore()
  const linkedCount = getLinkedEntries(entry.id).length
  const backlinksCount = getBacklinks(entry.id).length

  const config = entryTypeConfig[entry.type]
  const Icon = config.icon

  return (
    <Link href={`/wiki/${entry.id}`}>
      <Card className="group bg-card/80 backdrop-blur-sm border-border hover:border-fey-cyan/30 hover:shadow-lg hover:shadow-fey-cyan/10 transition-all duration-200 cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 rounded-lg bg-muted/50 ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base sm:text-lg truncate">{entry.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!entry.isPlayerVisible && (
                <Badge variant="outline" className="text-[10px] border-fey-crimson/30 text-fey-crimson">
                  <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                  DM
                </Badge>
              )}
              <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                {config.label}
              </Badge>
            </div>
          </div>
          {entry.summary && (
            <CardDescription className="line-clamp-2 text-xs sm:text-sm">
              {entry.summary}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {(linkedCount > 0 || backlinksCount > 0) && (
              <div className="flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                <span>
                  {linkedCount + backlinksCount} link{linkedCount + backlinksCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {entry.tags && entry.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {entry.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
                {entry.tags.length > 3 && (
                  <span className="text-muted-foreground">+{entry.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function CreateEntryDialog({
  open,
  onOpenChange,
  campaignId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
}) {
  const { addEntry } = useWikiStore()
  const [title, setTitle] = useState("")
  const [type, setType] = useState<WikiEntryType>("lore")
  const [summary, setSummary] = useState("")
  const [content, setContent] = useState("")
  const [isPlayerVisible, setIsPlayerVisible] = useState(true)
  const [tags, setTags] = useState("")

  const handleSubmit = () => {
    if (!title.trim()) return

    addEntry({
      campaignId,
      title: title.trim(),
      type,
      content: content.trim(),
      summary: summary.trim() || undefined,
      linkedEntryIds: [],
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isPlayerVisible,
    })

    // Reset form
    setTitle("")
    setType("lore")
    setSummary("")
    setContent("")
    setIsPlayerVisible(true)
    setTags("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Create Wiki Entry</DialogTitle>
          <DialogDescription>
            Add a new entry to your campaign wiki. You can link entries together later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              placeholder="Entry title..."
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Type
            </Label>
            <Select value={type} onValueChange={(v) => setType(v as WikiEntryType)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(entryTypeConfig).map(([key, config]) => {
                  const Icon = config.icon
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="summary" className="text-right">
              Summary
            </Label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="col-span-3"
              placeholder="Brief summary (optional)..."
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right pt-2">
              Content
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="col-span-3 min-h-[120px]"
              placeholder="Full entry content..."
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tags" className="text-right">
              Tags
            </Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="col-span-3"
              placeholder="Comma-separated tags..."
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="visibility" className="text-right">
              Player Visible
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Switch
                id="visibility"
                checked={isPlayerVisible}
                onCheckedChange={setIsPlayerVisible}
              />
              <span className="text-sm text-muted-foreground">
                {isPlayerVisible ? (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Visible to players
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <EyeOff className="h-3 w-3" /> DM only
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="bg-fey-cyan hover:bg-fey-cyan/80"
          >
            Create Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function WikiPage() {
  const { activeCampaignId } = useCampaignsStore()
  const { getEntriesByCampaign, getEntriesByType, searchEntries } = useWikiStore()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<WikiEntryType | "all">("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const entries = useMemo(() => {
    if (!activeCampaignId) return []
    
    if (searchQuery.trim()) {
      return searchEntries(activeCampaignId, searchQuery)
    }
    
    if (activeTab === "all") {
      return getEntriesByCampaign(activeCampaignId)
    }
    
    return getEntriesByType(activeCampaignId, activeTab)
  }, [activeCampaignId, searchQuery, activeTab, getEntriesByCampaign, getEntriesByType, searchEntries])

  // Sort by updated date, most recent first
  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [entries])

  if (!activeCampaignId) {
    return (
      <AppShell pageTitle="Campaign Wiki">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-4">
              No Campaign Selected
            </h1>
            <p className="text-foreground/70 mb-6">
              Select a campaign from the dashboard to view its wiki.
            </p>
            <Button asChild className="bg-fey-cyan hover:bg-fey-cyan/80">
              <Link href="/">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell pageTitle="Campaign Wiki">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-2">
                <Book className="h-7 w-7 text-fey-cyan" />
                Campaign Wiki
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Document your world&apos;s lore, locations, factions, and more
              </p>
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-fey-cyan hover:bg-fey-cyan/80 gap-2"
            >
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search wiki entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WikiEntryType | "all")}>
            <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                <Layers className="h-3.5 w-3.5 mr-1" />
                All
              </TabsTrigger>
              {Object.entries(entryTypeConfig).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                    <Icon className={`h-3.5 w-3.5 mr-1 ${config.color}`} />
                    {config.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {sortedEntries.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-border">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Book className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No entries yet</h3>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      {searchQuery
                        ? "No entries match your search."
                        : "Start building your campaign wiki by creating your first entry."}
                    </p>
                    {!searchQuery && (
                      <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                        variant="outline"
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create Entry
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedEntries.map((entry) => (
                    <WikiEntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Create Dialog */}
      <CreateEntryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        campaignId={activeCampaignId}
      />
    </AppShell>
  )
}
