---
applyTo: '**'
---
# GitHub Copilot Instructions for FeyForge

## About This Project
FeyForge is a Next.js web application for managing D&D campaigns, characters, NPCs, sessions, and combat encounters with AI-powered DM assistance.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Zustand, Vercel, Claude API

## Core Philosophy

**NO BANDAID FIXES - ONLY SOLUTIONS TO THE ROOT CAUSE!**

If something's broken, fix it properly. Don't patch over symptoms - diagnose and solve the actual problem. Quick hacks create technical debt.

**Examples:**
- BAD: "Let's add a try-catch to hide that error"
- GOOD: "That error means X is misconfigured. Let's fix the config."
- BAD: "Just copy-paste that component with slight changes"
- GOOD: "Let's extract the common logic into a reusable component."

**COMPLETE ALL ASPECTS OF EVERY PLAN!**

When given a task or plan, execute it fully. Don't stop partway through or leave loose ends. If a plan has 5 steps, complete all 5. If you're implementing a feature, finish all its components before moving on.

**Examples:**
- BAD: Implementing 3 of 5 planned functions and saying "the rest follows the same pattern"
- GOOD: Implementing all 5 functions completely
- BAD: Creating a component without its styles, types, or integration
- GOOD: Delivering the complete, working feature

## 🎯 Critical Design System Rules

### USE DESIGN TOKENS - NOT HARDCODED STYLES!

**The codebase is currently being refactored to use semantic design tokens instead of hardcoded Tailwind classes.**

**âŒ WRONG - Hardcoded responsive patterns:**
```tsx
<Crown className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
<div className="gap-2 sm:gap-4">
<div className="pb-4 sm:pb-6 mb-4 sm:mb-6">
```

**âœ… CORRECT - Semantic design tokens:**
```tsx
<Crown className="icon-xl text-primary" />
<div className="gap-fluid">
<div className="spacing-section">
```

**Design Token System (defined in `app/globals.css`):**

**Icon Sizes:**
- `.icon-sm` - Small icons (h-4 w-4 sm:h-5 sm:w-5)
- `.icon-md` - Medium icons (h-5 w-5 sm:h-6 sm:w-6)
- `.icon-lg` - Large icons (h-6 w-6 sm:h-8 sm:w-8)
- `.icon-xl` - Extra large icons (h-8 w-8 sm:h-10 sm:w-10)

**Container Sizes:**
- `.container-sm` - Small containers (h-8 w-8 sm:h-10 sm:w-10)
- `.container-md` - Medium containers (h-10 w-10 sm:h-14 sm:w-14)
- `.container-lg` - Large containers (h-12 w-12 sm:h-16 sm:w-16)

**Spacing:**
- `.gap-fluid-sm` - Small gaps (gap-1.5 sm:gap-2)
- `.gap-fluid` - Standard gaps (gap-2 sm:gap-4)
- `.gap-fluid-lg` - Large gaps (gap-3 sm:gap-6)
- `.spacing-section` - Section spacing (pb-4 sm:pb-6 mb-4 sm:mb-6)
- `.spacing-card` - Card padding (p-3 sm:p-5)
- `.spacing-compact` - Compact padding (p-2.5 sm:p-4 md:p-6)

**Border Radius:**
- `.rounded-card` - Card corners (rounded-xl sm:rounded-2xl)
- `.rounded-button` - Button corners (rounded-xl)

**Text Sizes:**
- `.text-stat` - Statistics text (text-xl sm:text-2xl md:text-3xl)
- `.text-label` - Label text (text-[10px] sm:text-xs md:text-sm)
- `.text-title` - Title text (text-base sm:text-lg)
- `.text-subtitle` - Subtitle text (text-xs sm:text-sm)
- `.text-display` - Display text (text-base sm:text-xl)

**When creating new components:**
1. Use design tokens from the list above
2. If you need a new pattern, propose adding it to the design system
3. Never hardcode responsive breakpoint patterns

**When refactoring existing components:**
1. Replace hardcoded patterns with design tokens
2. Use `cn()` utility from `@/lib/utils` for conditional classes
3. Keep visual appearance identical

## Key Features

### Core Features
- **Campaign Management** - Multi-campaign support with role-based views (DM/Player)
- **Character Sheets** - Full D&D 5e character management with stats, inventory, spells
- **NPC Database** - Searchable NPC library with relationships and notes
- **Session Tracking** - Session planning, notes, and history
- **Combat Tracker** - Initiative tracking, HP management, conditions
- **Dice Roller** - Visual dice rolling with modifiers and advantage/disadvantage
- **Codex** - Spells, items, and rules reference
- **World Map** - Interactive campaign world mapping

### AI Integration (Claude Sonnet 4.5)
- **DM Assistant** - Session prep suggestions, encounter balancing
- **NPC Generation** - AI-powered NPC creation with personality and backstory
- **Adventure Ideas** - Campaign hooks and plot suggestions
- **Rules Assistance** - Quick rule lookups and interpretations

### Theme System
- **Deepwood Twilight (Dark)** - Deep forest green (#0d1f1a) with emerald accents (#00e676)
- **Silverwood Dawn (Light)** - Crisp white (#fafffe) with vibrant green accents (#00c853)
- **Dual-mode Support** - Every component adapts to light/dark mode
- **Custom CSS Variables** - Theme colors via CSS custom properties

### UI Design
- **Magical Aesthetic** - Floating particles, ethereal glows, gentle animations
- **ADHD-Friendly** - Silver headers for easy scanning, clear visual hierarchy
- **Responsive** - Mobile-first design with tablet/desktop optimizations
- **Accessibility** - WCAG AA contrast ratios throughout

## Project Structure
```
app/
├── (routes)/           # App Router pages
│   ├── page.tsx        # Dashboard
│   ├── characters/     # Character management
│   ├── npcs/           # NPC database
│   ├── sessions/       # Session tracking
│   ├── combat/         # Combat tracker
│   ├── dice/           # Dice roller
│   ├── codex/          # Reference library
│   ├── world-map/      # World mapping
│   ├── dm-assistant/   # AI DM tools
│   └── settings/       # App settings
├── api/                # API routes (AI, data)
├── layout.tsx          # Root layout
└── globals.css         # Theme & design tokens

components/
├── dashboard/          # Dashboard widgets
├── characters/         # Character components
├── npcs/               # NPC components
├── sessions/           # Session components
├── combat/             # Combat components
├── dice/               # Dice roller components
├── codex/              # Reference components
├── world/              # World map components
├── dm-assistant/       # AI assistant components
├── layout/             # Layout components (AppShell, Sidebar)
├── providers/          # Context providers
└── ui/                 # Shadcn UI components

lib/
├── campaign-store.ts   # Zustand campaign state
├── hooks/              # Custom React hooks
│   └── use-campaign-data.ts
└── utils.ts            # Utilities (cn, etc.)

styles/                 # Additional styles if needed

public/                 # Static assets
```

## Architecture Patterns

### State Management - Zustand

**Campaign Store (`lib/campaign-store.ts`):**
```typescript
interface CampaignStore {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  
  // Actions
  setActiveCampaign: (id: string) => void;
  createCampaign: (data: CampaignData) => void;
  deleteCampaign: (id: string) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
}
```

**Usage in components:**
```typescript
const { campaigns, activeCampaignId, setActiveCampaign } = useCampaignStore();
```

**Rules:**
- Keep stores focused and single-purpose
- Use selectors to prevent unnecessary re-renders
- Actions should be synchronous (async logic in hooks)

### Server vs Client Components

**Server Components (default in App Router):**
- Pages without interactive state
- Layout components
- Data fetching at request time

**Client Components (`"use client"`):**
- Interactive UI (buttons, forms, state)
- Hooks (useState, useEffect, Zustand)
- Browser APIs (localStorage, audio, etc.)

**Pattern:**
```tsx
// Server Component (no directive)
export default function CharactersPage() {
  return <CharactersClient />; // Pass to client component
}

// Client Component
"use client"
export function CharactersClient() {
  const [characters] = useCharacters(); // Hooks allowed here
  // ...
}
```

### Custom Hooks for Campaign Data

**Use campaign-scoped hooks (`lib/hooks/use-campaign-data.ts`):**
```typescript
// Automatically filters data by active campaign
const characters = useCampaignCharacters();
const sessions = useCampaignSessions();
const npcs = useCampaignNPCs();
const encounters = useCampaignEncounters();
```

**Don't** manually filter by campaign ID everywhere - let hooks handle it.

### Component Organization

**File naming:**
- `ComponentName.tsx` for components
- `use-feature-name.ts` for hooks
- `feature-store.ts` for Zustand stores
- `kebab-case` for folders and routes

**Component structure:**
```tsx
"use client" // If needed

import { ... } from "..."
import { cn } from "@/lib/utils"

interface ComponentProps {
  // Props with JSDoc
}

export function Component({ prop }: ComponentProps) {
  // Hooks first
  // Event handlers
  // Render logic
  
  return (
    <div className={cn("design-token-class", conditionalClass)}>
      {/* Content */}
    </div>
  );
}
```

## Styling Guidelines

### Use Tailwind Design Tokens

**Always prefer design tokens over hardcoded classes:**
```tsx
// âœ… Good
<Button className="rounded-button">Save</Button>
<div className="gap-fluid spacing-card">

// âŒ Bad
<Button className="rounded-xl">Save</Button>
<div className="gap-2 sm:gap-4 p-3 sm:p-5">
```

### Theme Colors

**Use CSS variables for colors:**
- `bg-primary` / `text-primary` - Emerald green
- `bg-accent` / `text-accent` - Violet purple
- `bg-card` / `text-card-foreground` - Card backgrounds
- `bg-muted` / `text-muted-foreground` - Subtle elements
- `bg-destructive` / `text-destructive-foreground` - Errors/warnings

**Don't** use arbitrary color values like `#00e676` directly in components.

### Conditional Classes

**Always use `cn()` utility:**
```tsx
import { cn } from "@/lib/utils"

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "primary" && "primary-classes"
)} />
```

### Animation Classes

**Predefined animations in globals.css:**
- `.animate-twinkle` - Twinkling effect
- `.animate-gentle-pulse` - Subtle pulsing
- `.animate-float-gentle` - Floating motion
- `.animate-glow-pulse` - Glowing effect
- `.animate-dice-tumble` - Dice rolling
- `.animate-result-pop` - Result pop-in

**Apply sparingly for magical feel without overwhelming.**

## AI Integration (Claude API)

### API Route Pattern

**Create API routes in `app/api/`:**
```typescript
// app/api/dm-assistant/route.ts
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  const { prompt, context } = await request.json();
  
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  
  return Response.json({ result: response.content[0].text });
}
```

### Client-Side Consumption
```typescript
"use client"

const [loading, setLoading] = useState(false);

async function generateContent() {
  setLoading(true);
  try {
    const res = await fetch('/api/dm-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context }),
    });
    const data = await res.json();
    // Handle data
  } finally {
    setLoading(false);
  }
}
```

**Rules:**
- API keys stay server-side (environment variables)
- Handle loading/error states
- Provide user feedback during generation

## Data Persistence

### LocalStorage Pattern

**Campaign data persists in localStorage via Zustand middleware:**
```typescript
const useCampaignStore = create<CampaignStore>()(
  persist(
    (set) => ({ /* store */ }),
    { name: 'feyforge-campaigns' }
  )
);
```

**Keep localStorage usage minimal:**
- Campaign metadata
- User preferences
- UI state (sidebar collapsed, etc.)

**Don't** store large blobs (images, audio) in localStorage.

### Future: Supabase Integration

**When adding backend:**
- Use Supabase for cloud sync
- Row-Level Security for multi-user
- Real-time subscriptions for collaborative features
- Local-first with sync, not cloud-dependent

## Development Workflow

### Starting Development
```bash
npm install              # Install dependencies
npm run dev              # Start dev server (localhost:3000)
```

**Verify after code changes:**
1. Check browser console for errors
2. Test responsive breakpoints (mobile, tablet, desktop)
3. Verify both light and dark modes
4. Check component in context of full page

### Building for Production
```bash
npm run build            # Production build
npm run start            # Preview production build
```

**Before deployment:**
1. Test production build locally
2. Check bundle size (`npm run build` output)
3. Verify no TypeScript errors
4. Ensure environment variables configured

### Deployment (Vercel)

**Automatic deployment:**
- Push to `main` branch triggers production deploy
- Pull requests get preview deployments

**Environment variables:**
- `ANTHROPIC_API_KEY` - Claude API key
- Add in Vercel dashboard under Settings > Environment Variables

## How to Communicate with Nae âš¡

**Lead with ACTION, then explain WHY:**
âœ… "Add `className="icon-md"` to replace the hardcoded h-5 w-5 pattern"  
âŒ "You might want to consider using a design token here"

**No Decision Paralysis:**
- Max 2-3 options with pros/cons
- **Always recommend ONE** with clear reasoning
- Example: "Use Option A because X matches your existing pattern"

**Keep it Simple:**
- Break big tasks into 3-5 concrete steps
- Use code examples
- Show before/after comparisons

**Never:**
- Dump 5+ options without a recommendation
- Use vague suggestions like "you could try..."
- Suggest bandaid fixes that don't address root causes
- Leave tasks partially completed

**Example (Good):**
```
1. Replace `h-8 w-8 sm:h-10 sm:w-10` with `icon-xl`
2. Replace `gap-2 sm:gap-4` with `gap-fluid`
3. Test in browser - appearance should be identical

This makes future size changes easier - just modify the design token once.
```

## Code Standards

**Rules:**
- TypeScript strict mode - avoid `any`
- Use design tokens, not hardcoded responsive patterns
- Keep components under 300 lines (extract sub-components)
- Prefer composition over inheritance
- Use semantic HTML
- Add JSDoc comments to exported functions

**Component checklist:**
- [ ] Uses design tokens (no hardcoded `sm:`, `md:` patterns)
- [ ] TypeScript types defined
- [ ] Handles loading and error states
- [ ] Works in light and dark mode
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Accessible (semantic HTML, ARIA when needed)

## Common Patterns

### Creating a New Feature Page
```typescript
// app/new-feature/page.tsx
import { AppShell } from "@/components/layout/app-shell";
import { FeatureContent } from "@/components/new-feature/feature-content";

export default function NewFeaturePage() {
  return (
    <AppShell title="Feature Name" subtitle="Feature description">
      <div className="space-y-fluid-lg">
        <FeatureContent />
      </div>
    </AppShell>
  );
}
```

### Creating a Dashboard Widget
```typescript
// components/dashboard/widget-name.tsx
"use client"

import { Icon } from "lucide-react";
import { useCampaignData } from "@/lib/hooks/use-campaign-data";

export function WidgetName() {
  const data = useCampaignData();
  
  return (
    <div className="glass-card spacing-card">
      <div className="flex items-center gap-fluid-sm">
        <Icon className="icon-md text-primary" />
        <h3>Widget Title</h3>
      </div>
      {/* Content */}
    </div>
  );
}
```

### Adding a New Zustand Store
```typescript
// lib/feature-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeatureState {
  items: Item[];
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const useFeatureStore = create<FeatureState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({ 
        items: [...state.items, item] 
      })),
      removeItem: (id) => set((state) => ({ 
        items: state.items.filter(i => i.id !== id) 
      })),
    }),
    { name: 'feyforge-feature' }
  )
);
```

## Security & Best Practices

**API Keys:**
- Store in `.env.local` (gitignored)
- Access via `process.env.VARIABLE_NAME`
- Never commit to git
- Use Vercel environment variables for production

**Input Validation:**
- Validate all user input
- Sanitize before rendering (React does this by default)
- Use TypeScript types to catch errors early

**Performance:**
- Use React.memo() for expensive components
- Lazy load heavy features with dynamic imports
- Optimize images (next/image component)
- Monitor bundle size

## Debugging Tips

**Common Issues:**

**1. Component not updating:**
- Check if store is updating (use React DevTools)
- Verify hook dependencies array
- Ensure client component has `"use client"`

**2. Styles not applying:**
- Check class name spelling
- Verify design token exists in globals.css
- Use browser DevTools to inspect computed styles
- Check for conflicting Tailwind classes

**3. TypeScript errors:**
- Run `npm run build` to see all errors
- Check type imports are from correct path
- Verify interface matches actual data shape

**4. Dark mode issues:**
- Test with both `.dark` class present and absent
- Verify CSS variables defined for both `:root` and `.dark`
- Check component uses theme-aware classes

## Testing (Future)

**When adding tests:**
- Unit tests for utilities and hooks
- Component tests with React Testing Library
- Integration tests for user flows
- Aim for >70% coverage
```bash
npm run test             # Run tests (when implemented)
```

## Remember

You're helping Nae build a magical D&D campaign manager while juggling school, work, and life. Be supportive, clear, and actionable. Small wins matter. Fix things properly the first time - and finish what you start!

**When in doubt:**
1. Check existing patterns first
2. Use design tokens, not hardcoded styles
3. Keep it simple and ADHD-friendly
4. Ask questions if unclear
5. **Complete the entire task before moving on**