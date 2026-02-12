import { create } from "zustand"
import { toast } from "sonner"
import {
  fetchDMConversations,
  createDMConversation,
  updateDMConversation,
  deleteDMConversation,
} from "@/lib/actions/dm-conversations"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  campaignId: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface DMAssistantStore {
  conversations: Conversation[]
  activeConversationId: string | null
  isLoading: boolean
  isInitialized: boolean

  // Initialization
  initialize: () => Promise<void>

  // Conversation management
  createConversation: (campaignId: string, title?: string) => Promise<Conversation>
  deleteConversation: (id: string) => Promise<void>
  setActiveConversation: (id: string | null) => void
  updateConversationTitle: (id: string, title: string) => void

  // Message management
  addMessage: (
    conversationId: string,
    message: Omit<Message, "id" | "timestamp">
  ) => Message
  updateLastMessage: (conversationId: string, content: string) => void
  clearMessages: (conversationId: string) => void

  // Sync conversation to DB (call after streaming completes)
  syncConversation: (conversationId: string) => Promise<void>

  // Getters
  getConversation: (id: string) => Conversation | undefined
  getActiveConversation: () => Conversation | undefined
  getConversationsByCampaign: (campaignId: string) => Conversation[]

  // Loading state
  setLoading: (loading: boolean) => void
}

// Generate unique IDs
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const useDMAssistantStore = create<DMAssistantStore>()(
  (set, get) => ({
    conversations: [],
    activeConversationId: null,
    isLoading: false,
    isInitialized: false,

    initialize: async () => {
      if (get().isInitialized) return
      try {
        const rows = await fetchDMConversations()
        set({
          conversations: rows.map((r) => ({
            id: r.id,
            campaignId: r.campaignId,
            title: r.title,
            messages: (r.messages ?? []) as Message[],
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          })),
          isInitialized: true,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load conversations"
        if (!message.includes("Not authenticated")) {
          toast.error(message)
        }
        set({ isInitialized: true })
      }
    },

    createConversation: async (campaignId: string, title?: string) => {
      const displayTitle = title || "New Chat"
      try {
        const row = await createDMConversation({ campaignId, title: displayTitle })
        const conversation: Conversation = {
          id: row.id,
          campaignId: row.campaignId,
          title: row.title,
          messages: [],
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: conversation.id,
        }))
        return conversation
      } catch (error) {
        // Fallback to local-only conversation if DB fails
        const conversation: Conversation = {
          id: generateId(),
          campaignId,
          title: displayTitle,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: conversation.id,
        }))
        const message = error instanceof Error ? error.message : "Failed to save conversation"
        if (!message.includes("Not authenticated")) {
          console.error("[FeyForge] Failed to persist conversation:", error)
        }
        return conversation
      }
    },

    deleteConversation: async (id: string) => {
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId:
          state.activeConversationId === id
            ? null
            : state.activeConversationId,
      }))
      try {
        await deleteDMConversation(id)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete conversation"
        if (!message.includes("Not authenticated")) {
          toast.error(message)
        }
      }
    },

    setActiveConversation: (id: string | null) =>
      set({ activeConversationId: id }),

    updateConversationTitle: (id: string, title: string) =>
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id
            ? { ...c, title, updatedAt: new Date().toISOString() }
            : c
        ),
      })),

    addMessage: (
      conversationId: string,
      message: Omit<Message, "id" | "timestamp">
    ) => {
      const newMessage: Message = {
        ...message,
        id: generateId(),
        timestamp: new Date().toISOString(),
      }
      set((state) => ({
        conversations: state.conversations.map((c) => {
          if (c.id === conversationId) {
            // Auto-update title from first user message if still default
            let title = c.title
            if (
              c.title === "New Chat" &&
              message.role === "user" &&
              c.messages.length === 0
            ) {
              title =
                message.content.slice(0, 50) +
                (message.content.length > 50 ? "..." : "")
            }
            return {
              ...c,
              title,
              messages: [...c.messages, newMessage],
              updatedAt: new Date().toISOString(),
            }
          }
          return c
        }),
      }))
      return newMessage
    },

    clearMessages: (conversationId: string) =>
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [],
                title: "New Chat",
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
      })),

    updateLastMessage: (conversationId: string, content: string) =>
      set((state) => ({
        conversations: state.conversations.map((c) => {
          if (c.id === conversationId && c.messages.length > 0) {
            const messages = [...c.messages]
            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              content,
            }
            return { ...c, messages, updatedAt: new Date().toISOString() }
          }
          return c
        }),
      })),

    syncConversation: async (conversationId: string) => {
      const conversation = get().conversations.find((c) => c.id === conversationId)
      if (!conversation) return
      try {
        await updateDMConversation(conversationId, {
          title: conversation.title,
          messages: conversation.messages,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to sync conversation"
        if (!message.includes("Not authenticated")) {
          console.error("[FeyForge] Failed to sync conversation:", message)
        }
      }
    },

    getConversation: (id: string) =>
      get().conversations.find((c) => c.id === id),

    getActiveConversation: () => {
      const state = get()
      return state.conversations.find(
        (c) => c.id === state.activeConversationId
      )
    },

    getConversationsByCampaign: (campaignId: string) =>
      get().conversations.filter((c) => c.campaignId === campaignId),

    setLoading: (loading: boolean) => set({ isLoading: loading }),
  })
)
