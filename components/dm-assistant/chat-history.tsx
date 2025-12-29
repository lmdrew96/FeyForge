"use client"

import { MessageSquare, Trash2, X, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
import { useDMAssistantStore } from "@/lib/dm-assistant-store"
import { useCampaignsStore } from "@/lib/campaigns-store"
import { cn } from "@/lib/utils"

interface ChatHistoryProps {
  onClose?: () => void
  onSelectConversation: (id: string) => void
  mobile?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ChatHistory({
  onClose,
  onSelectConversation,
  mobile = false,
  open,
  onOpenChange,
}: ChatHistoryProps) {
  const { activeCampaignId } = useCampaignsStore()
  const {
    activeConversationId,
    getConversationsByCampaign,
    deleteConversation,
  } = useDMAssistantStore()

  const conversations = activeCampaignId
    ? getConversationsByCampaign(activeCampaignId)
    : []

  const historyContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Chat History</h3>
        </div>
        {onClose && !mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No conversations yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start chatting to create a conversation
              </p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                id={conversation.id}
                title={conversation.title}
                messageCount={conversation.messages.length}
                updatedAt={conversation.updatedAt}
                isActive={conversation.id === activeConversationId}
                onSelect={() => onSelectConversation(conversation.id)}
                onDelete={() => deleteConversation(conversation.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )

  // Mobile: Use Sheet component (controlled by open prop)
  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Chat History</SheetTitle>
          </SheetHeader>
          {historyContent}
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Render inline
  return historyContent
}

interface ConversationItemProps {
  id: string
  title: string
  messageCount: number
  updatedAt: string
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

function ConversationItem({
  title,
  messageCount,
  updatedAt,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (diffDays === 1) {
      return "Yesterday"
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }
  }

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
        isActive
          ? "bg-fey-cyan/10 border border-fey-cyan/30"
          : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {messageCount} messages · {formatDate(updatedAt)}
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
              "text-muted-foreground hover:text-destructive"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{title}" and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
