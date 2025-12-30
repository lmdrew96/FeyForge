"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Book,
  MapPin,
  Users,
  Scroll,
  Gem,
  Calendar,
  Layers,
  Link2,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  X,
} from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useWikiStore, type WikiEntry, type WikiEntryType } from "@/lib/wiki-store"
import { format } from "date-fns"

const entryTypeConfig: Record<
  WikiEntryType,
  { icon: typeof MapPin; label: string; color: string; bgColor: string }
> = {
  location: { icon: MapPin, label: "Location", color: "text-fey-forest", bgColor: "bg-fey-forest/10" },
  faction: { icon: Users, label: "Faction", color: "text-fey-purple", bgColor: "bg-fey-purple/10" },
  lore: { icon: Scroll, label: "Lore", color: "text-fey-gold", bgColor: "bg-fey-gold/10" },
  item: { icon: Gem, label: "Item", color: "text-fey-cyan", bgColor: "bg-fey-cyan/10" },
  event: { icon: Calendar, label: "Event", color: "text-fey-crimson", bgColor: "bg-fey-crimson/10" },
  custom: { icon: Layers, label: "Custom", color: "text-muted-foreground", bgColor: "bg-muted/50" },
}

function LinkedEntryBadge({ entry }: { entry: WikiEntry }) {
  const config = entryTypeConfig[entry.type]
  const Icon = config.icon

  return (
    <Link href={`/wiki/${entry.id}`}>
      <Badge
        variant="outline"
        className={`${config.bgColor} border-transparent hover:border-fey-cyan/30 transition-colors cursor-pointer`}
      >
        <Icon className={`h-3 w-3 mr-1 ${config.color}`} />
        {entry.title}
        <ExternalLink className="h-2.5 w-2.5 ml-1 opacity-50" />
      </Badge>
    </Link>
  )
}

export default function WikiEntryPage() {
  const params = useParams()
  const router = useRouter()
  const {
    getEntry,
    updateEntry,
    deleteEntry,
    getLinkedEntries,
    getBacklinks,
    getEntriesByCampaign,
    addLink,
    removeLink,
  } = useWikiStore()

  const [entry, setEntry] = useState<WikiEntry | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)

  // Edit form state
  const [editTitle, setEditTitle] = useState("")
  const [editType, setEditType] = useState<WikiEntryType>("lore")
  const [editSummary, setEditSummary] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editIsPlayerVisible, setEditIsPlayerVisible] = useState(true)
  const [editTags, setEditTags] = useState("")

  useEffect(() => {
    const id = params.id as string
    const found = getEntry(id)
    if (found) {
      setEntry(found)
    }
  }, [params.id, getEntry])

  const linkedEntries = useMemo(() => {
    if (!entry) return []
    return getLinkedEntries(entry.id)
  }, [entry, getLinkedEntries])

  const backlinks = useMemo(() => {
    if (!entry) return []
    return getBacklinks(entry.id)
  }, [entry, getBacklinks])

  const availableEntries = useMemo(() => {
    if (!entry) return []
    const allEntries = getEntriesByCampaign(entry.campaignId)
    // Exclude self and already linked entries
    return allEntries.filter(
      (e) => e.id !== entry.id && !entry.linkedEntryIds.includes(e.id)
    )
  }, [entry, getEntriesByCampaign])

  const handleOpenEdit = () => {
    if (!entry) return
    setEditTitle(entry.title)
    setEditType(entry.type)
    setEditSummary(entry.summary || "")
    setEditContent(entry.content)
    setEditIsPlayerVisible(entry.isPlayerVisible)
    setEditTags(entry.tags?.join(", ") || "")
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (!entry || !editTitle.trim()) return

    updateEntry(entry.id, {
      title: editTitle.trim(),
      type: editType,
      summary: editSummary.trim() || undefined,
      content: editContent.trim(),
      isPlayerVisible: editIsPlayerVisible,
      tags: editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    })

    // Refresh entry
    const updated = getEntry(entry.id)
    if (updated) setEntry(updated)
    setIsEditDialogOpen(false)
  }

  const handleDelete = () => {
    if (entry) {
      deleteEntry(entry.id)
      router.push("/wiki")
    }
  }

  const handleAddLink = (toId: string) => {
    if (!entry) return
    addLink(entry.id, toId)
    // Refresh entry
    const updated = getEntry(entry.id)
    if (updated) setEntry(updated)
    setIsLinkPopoverOpen(false)
  }

  const handleRemoveLink = (toId: string) => {
    if (!entry) return
    removeLink(entry.id, toId)
    // Refresh entry
    const updated = getEntry(entry.id)
    if (updated) setEntry(updated)
  }

  if (!entry) {
    return (
      <AppShell pageTitle="Wiki Entry">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-4">
              Entry Not Found
            </h1>
            <p className="text-foreground/70 mb-6">
              The wiki entry you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button asChild className="bg-fey-cyan hover:bg-fey-cyan/80">
              <Link href="/wiki">Return to Wiki</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const config = entryTypeConfig[entry.type]
  const Icon = config.icon

  return (
    <AppShell pageTitle={entry.title}>
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button */}
          <Link
            href="/wiki"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wiki
          </Link>

          {/* Main Card */}
          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${config.bgColor} ${config.color}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    {!entry.isPlayerVisible && (
                      <Badge variant="outline" className="border-fey-crimson/30 text-fey-crimson">
                        <EyeOff className="h-3 w-3 mr-1" />
                        DM Only
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl sm:text-3xl font-display">{entry.title}</CardTitle>
                  {entry.summary && (
                    <CardDescription className="text-sm sm:text-base">
                      {entry.summary}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{entry.title}&quot; and remove all links to it.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Content */}
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                  {entry.content || "No content yet."}
                </div>
              </div>

              {/* Tags */}
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-4 border-t border-border/50">
                <span>Created {format(new Date(entry.createdAt), "MMM d, yyyy")}</span>
                <span>·</span>
                <span>Updated {format(new Date(entry.updatedAt), "MMM d, yyyy")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Links Section */}
          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-fey-cyan" />
                  Linked Entries
                </CardTitle>
                <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      Add Link
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search entries..." />
                      <CommandList>
                        <CommandEmpty>No entries found.</CommandEmpty>
                        <CommandGroup>
                          {availableEntries.map((e) => {
                            const eConfig = entryTypeConfig[e.type]
                            const EIcon = eConfig.icon
                            return (
                              <CommandItem
                                key={e.id}
                                onSelect={() => handleAddLink(e.id)}
                                className="cursor-pointer"
                              >
                                <EIcon className={`h-4 w-4 mr-2 ${eConfig.color}`} />
                                <span>{e.title}</span>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Outgoing Links */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Links from this entry ({linkedEntries.length})
                </h4>
                {linkedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outgoing links</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {linkedEntries.map((linked) => (
                      <div key={linked.id} className="flex items-center gap-1">
                        <LinkedEntryBadge entry={linked} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveLink(linked.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Backlinks */}
              <div className="space-y-2 pt-4 border-t border-border/50">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Entries linking here ({backlinks.length})
                </h4>
                {backlinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No backlinks</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {backlinks.map((linked) => (
                      <LinkedEntryBadge key={linked.id} entry={linked} />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Entry</DialogTitle>
            <DialogDescription>Make changes to this wiki entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-title" className="text-right">
                Title
              </Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-type" className="text-right">
                Type
              </Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as WikiEntryType)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(entryTypeConfig).map(([key, cfg]) => {
                    const CfgIcon = cfg.icon
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <CfgIcon className={`h-4 w-4 ${cfg.color}`} />
                          <span>{cfg.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-summary" className="text-right">
                Summary
              </Label>
              <Input
                id="edit-summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-content" className="text-right pt-2">
                Content
              </Label>
              <Textarea
                id="edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="col-span-3 min-h-[120px]"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-tags" className="text-right">
                Tags
              </Label>
              <Input
                id="edit-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="col-span-3"
                placeholder="Comma-separated..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-visibility" className="text-right">
                Player Visible
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  id="edit-visibility"
                  checked={editIsPlayerVisible}
                  onCheckedChange={setEditIsPlayerVisible}
                />
                <span className="text-sm text-muted-foreground">
                  {editIsPlayerVisible ? (
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim()}
              className="bg-fey-cyan hover:bg-fey-cyan/80"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
