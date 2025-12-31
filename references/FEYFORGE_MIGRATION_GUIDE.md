# FeyForge to Redesign Migration Guide

**INSTRUCTIONS FOR GITHUB COPILOT**

You are GitHub Copilot assisting with migrating FeyForge functionality into the redesign repository. This guide contains step-by-step instructions for you to follow.

## Your Mission

Copy FeyForge's AI-powered D&D features into this redesign repository while preserving the redesign's clean UI and styling. You will work incrementally, one phase at a time, validating after each step.

## Key Principles

1. **Preserve the redesign's UI** - Never change existing styled components
2. **Copy functionality only** - API routes, stores, calculation logic
3. **Update styling when copying components** - Match the redesign's aesthetic
4. **Work incrementally** - Complete one phase fully before moving to the next
5. **Validate continuously** - Ensure the build succeeds after each major change

## Repository Context

- **Current repo:** The redesign repository (destination)
- **Source repo:** FeyForge repository (located at the path the user will specify)
- **Working branch:** feature/feyforge-migration (user will create this)

## Important Notes

- When asked to "copy" files, read them from the FeyForge repo path and create them in this repo
- When asked to "update styling", reference existing components in `/components/account` and `/components/settings` as examples
- When asked to "validate", check for TypeScript errors and build success
- DO NOT modify files that aren't explicitly mentioned in the instructions
- DO NOT add features that aren't in the original FeyForge repo

---

## Phase 1: Core Infrastructure

**Your objective:** Copy backend functionality without touching UI. Do not modify any existing files in this repo.

### Step 1.1 - Copy API Routes

Copy all files from the FeyForge repository's `/app/api` directory to this repository's `/app/api` directory. Preserve the exact directory structure.

**Files to copy:**
- `/app/api/character/*` (all files and subdirectories)
- `/app/api/npc/*` (all files and subdirectories)
- `/app/api/session/*` (all files and subdirectories)
- `/app/api/dm-assistant/*` (all files and subdirectories)

**Do not modify** the content of these files. Copy them exactly as they are.

After copying:
1. Check for any TypeScript errors in the copied files
2. Ensure no import paths are broken
3. Verify the build still succeeds

---

### Step 1.2 - Copy Zustand Stores

Copy these exact files from FeyForge's `/lib` directory to this repository's `/lib` directory:
- `character-store.ts`
- `campaign-store.ts`
- `session-store.ts`
- `npc-store.ts`
- `world-store.ts`
- `dice-store.ts`

**Do not modify** the content of these files. Copy them exactly as they are.

After copying:
1. Check that all 6 files are present in `/lib`
2. Verify no import errors appear
3. Ensure the build still succeeds

---

### Step 1.3 - Copy D&D Calculation Modules

Copy the entire `/lib/character` directory from FeyForge to this repository's `/lib` directory.

This directory contains D&D 5e calculation modules for:
- Ability score calculations
- Proficiency bonuses
- Spell slot tracking
- Hit points and hit dice
- Saving throws
- Skills and proficiencies

**Do not modify** any files in this directory. Copy the entire structure as-is.

After copying:
1. Verify the `/lib/character` directory exists with all subdirectories
2. Check for TypeScript errors
3. Ensure the build still succeeds

---

### Step 1.4 - Copy Open5e API Integration

Copy the file `/lib/open5e-api.ts` from FeyForge to this repository's `/lib` directory.

This file contains the integration with the Open5e API for fetching spells, monsters, and rules.

**Do not modify** this file. Copy it exactly as it is.

After copying:
1. Verify the file exists at `/lib/open5e-api.ts`
2. Check for TypeScript errors
3. Ensure the build still succeeds

---

### Step 1.5 - Copy or Merge Types

Check if a `/lib/types.ts` file exists in this repository:

**If it does NOT exist:**
- Copy `/lib/types.ts` from FeyForge to this repository's `/lib` directory exactly as-is

**If it DOES exist:**
- Read both files (FeyForge's and this repo's)
- Merge the type definitions from FeyForge into this repo's file
- Avoid any naming conflicts by keeping both sets of types
- If there are duplicate type names, prefix the FeyForge types with `FeyForge` (e.g., `FeyForgeCharacter`)

After copying/merging:
1. Verify no TypeScript conflicts exist
2. Ensure all types are properly exported
3. Ensure the build still succeeds

---

### Phase 1 Validation

Before proceeding to Phase 2, verify:
1. All infrastructure files have been copied
2. Run `pnpm build` - it must succeed
3. Run `pnpm tsc --noEmit` - no TypeScript errors
4. No existing files were modified

**Report completion:** "Phase 1 complete. All infrastructure files copied. Build succeeds with no errors."

If any errors occurred, report them and wait for user guidance before proceeding.

---

## Phase 2: Add Missing UI Components

**Your objective:** Add FeyForge's AI-powered components that don't exist in this repository. Update their styling to match the redesign's aesthetic.

**Strategy:** Copy components ONE AT A TIME. After each component:
1. Update styling to match this repo's design system
2. Replace old UI components with shadcn/ui components
3. Keep all functionality intact
4. Verify the build succeeds

**Reference components for styling:** Look at `/components/account/account-profile.tsx` and `/components/settings/settings-tabs.tsx` for the design patterns, spacing, and UI components to use.

---

### Step 2.1 - Character Builder Component

Copy `/components/characters/character-builder.tsx` from FeyForge to this repository.

**After copying, update the component:**
1. Replace Tailwind classes to match this repo's design system (reference `/components/account/account-profile.tsx`)
2. Use shadcn/ui components from `/components/ui` (Card, Button, Input, Select, etc.)
3. Keep all AI character generation functionality intact
4. Update import paths to match this repo's structure (e.g., stores import from `/lib/*-store`)
5. Ensure the component uses the same color palette (fey-cyan, fey-gold, etc.)

**Key styling requirements:**
- Use `bg-card/50 backdrop-blur-sm` for cards
- Use `border-fey-cyan/20` for accents
- Match button styling to existing components
- Use consistent spacing (p-4, p-6, gap-4, etc.)

After updating, verify:
1. No TypeScript errors
2. Component builds successfully
3. All imports resolve correctly

---

### Step 2.2 - Character Sheet Component

Copy the entire `/components/characters/character-sheet` directory from FeyForge to this repository.

**After copying, update all files in the directory:**
1. Update Tailwind classes to match `/components/account` aesthetic
2. Use shadcn/ui components (Card, Tabs, Badge, etc.)
3. Keep all D&D stat calculations and mechanics intact
4. Update import paths for stores and calculation modules
5. Ensure proper dark mode support

**Key styling requirements:**
- Character sheet should use Card components with backdrop-blur
- Stats should have clear visual hierarchy
- Use Badge components for status indicators
- Tab styling should match existing patterns

After updating, verify:
1. No TypeScript errors
2. All sub-components build successfully
3. Character sheet can display character data

---

### Step 2.3 - DM Assistant Components

Copy these files from FeyForge's `/components/dm-assistant`:
- `dm-chat.tsx`
- `encounter-builder.tsx`
- `rules-reference.tsx`
- `session-summary-generator.tsx`

**For each file, update:**
1. Styling to match this repo's design system
2. UI components to use shadcn/ui
3. Keep all AI chat and generation functionality
4. Update imports to match this repo

**Key styling requirements:**
- Chat interface should use Card with proper message styling
- Encounter builder should use Table or Grid layouts
- Buttons and inputs should match existing components
- Loading states should use this repo's patterns

After updating, verify:
1. All 4 components build without errors
2. AI functionality imports are correct
3. Styling matches the redesign

---

### Step 2.4 - NPC Generator Components

Copy these files from FeyForge's `/components/npcs`:
- `npc-generator.tsx`
- `npc-list.tsx`
- `npc-detail.tsx`

**For each file, update:**
1. Styling to match this repo's design (reference `/components/account/active-campaigns.tsx` for list styling)
2. Use shadcn/ui components
3. Keep AI NPC generation functionality
4. Update store imports

**Key styling requirements:**
- NPC list should use Card grid or list layout
- NPC generator form should match character builder styling
- Detail view should use consistent spacing and typography

After updating, verify:
1. All NPC components build successfully
2. Can integrate with npc-store
3. Styling is consistent

---

### Step 2.5 - Session Management Components

Copy these files from FeyForge's `/components/sessions`:
- `session-editor.tsx`
- `session-list.tsx`
- `plot-threads.tsx`
- `campaign-timeline.tsx`
- `live-session-mode.tsx`

**For each file, update:**
1. Styling to match this repo's design
2. Use shadcn/ui Textarea, Input, Card, etc.
3. Keep all session planning functionality
4. Update session-store imports

**Key styling requirements:**
- Session editor should have clean, distraction-free writing area
- Timeline should use visual indicators
- Plot threads should be organized and scannable
- Lists should match existing patterns

After updating, verify:
1. All session components build
2. Can integrate with session-store
3. Layout is responsive

---

### Step 2.6 - Codex Components

Copy these files from FeyForge's `/components/codex`:
- `spell-browser.tsx`
- `monster-browser.tsx`
- `spell-detail.tsx`
- `monster-detail.tsx`

**For each file, update:**
1. Styling to match this repo's design
2. Use shadcn/ui Table, Card, Badge components
3. Keep Open5e API integration
4. Update open5e-api imports

**Key styling requirements:**
- Browser views should have search and filter UI
- Tables should be readable and well-spaced
- Detail views should highlight important stats
- Use Badge for spell schools, creature types, etc.

After updating, verify:
1. All codex components build
2. Can fetch from Open5e API
3. Data displays correctly

---

### Step 2.7 - Dice Roller Component

Copy `/components/dice/dice-roller.tsx` from FeyForge.

**After copying, update:**
1. Styling to match this repo's design (reference UI patterns in `/components/ui`)
2. Use shadcn/ui Button components
3. Keep dice rolling mechanics and history
4. Update dice-store import

**Key styling requirements:**
- Dice buttons should be visually distinct
- Roll history should be easy to read
- Results should be prominent
- Animations (if any) should be subtle

After updating, verify:
1. Component builds
2. Can roll dice
3. History displays correctly

---

### Step 2.8 - Combat Tracker Components

Copy these files from FeyForge's `/components/combat`:
- `initiative-list.tsx`
- `combat-tracker.tsx`
- `hp-tracker.tsx`

**For each file, update:**
1. Styling to match this repo's design
2. Use shadcn/ui Table, Input, Button components
3. Keep combat turn management
4. Update any store imports

**Key styling requirements:**
- Initiative order should be clear
- HP tracking should have visual indicators
- Active combatant should be highlighted
- Controls should be accessible

After updating, verify:
1. Combat components build
2. Initiative tracking works
3. Layout is clear and usable

---

### Phase 2 Validation

Before proceeding to Phase 3, verify:
1. All components have been copied and styled
2. Run `pnpm build` - it must succeed
3. No TypeScript errors
4. All components use consistent styling matching the redesign
5. No imports are broken

**Report completion:** "Phase 2 complete. All components migrated and styled. Build succeeds with no errors."

If any errors occurred, report them and wait for user guidance before proceeding.

---

## Phase 3: Update Pages to Use New Components

**Your objective:** Update existing page files to import and use the migrated components. Match the layout style of existing pages in this repository.

**Reference pages:** Look at `/app/account/page.tsx` and `/app/settings/page.tsx` for layout patterns, spacing, and structure.

---

### Step 3.1 - Characters Page

Update `/app/characters/page.tsx` to include the character management features.

**Required changes:**
1. Import `CharacterBuilder` from `/components/characters/character-builder`
2. Import `CharacterList` component (if it doesn't exist, create a simple list view using character-store)
3. Add a "New Character" button that toggles the CharacterBuilder (use a Dialog or Sheet from shadcn/ui)
4. Display the character list in a grid layout matching `/app/account/page.tsx` style
5. Use the same AppShell, Card, and spacing patterns as other pages

**Layout structure:**
```tsx
<AppShell pageTitle="Characters">
  <div className="container mx-auto p-6">
    // New Character button
    // Character list/grid
  </div>
</AppShell>
```

After updating, verify:
1. Page builds without errors
2. Can navigate to /characters
3. Layout matches other pages

---

### Step 3.2 - Individual Character Page

Update `/app/characters/[id]/page.tsx` to display a full character sheet.

**Required changes:**
1. Import `CharacterSheet` from `/components/characters/character-sheet`
2. Use `useParams()` to get the character ID
3. Load character data from character-store using the ID
4. Display the full CharacterSheet component
5. Match the layout style of detail pages (full-width or constrained as appropriate)

**Handle edge cases:**
- If character ID not found, show "Character not found" message
- If loading, show loading state

After updating, verify:
1. Page builds without errors
2. Can view character details at /characters/[id]
3. Character data displays correctly

---

### Step 3.3 - DM Assistant Page

Update `/app/dm-assistant/page.tsx` to include DM tools.

**Required changes:**
1. Import `DmChat` from `/components/dm-assistant/dm-chat`
2. Import `EncounterBuilder` from `/components/dm-assistant/encounter-builder`
3. Use Tabs from shadcn/ui to switch between:
   - DM Chat tab
   - Encounter Builder tab
   - Rules Reference tab (if component exists)
4. Match the tab layout style of `/app/codex/page.tsx` if it exists

After updating, verify:
1. Page builds without errors
2. Can navigate to /dm-assistant
3. Tabs switch correctly
4. AI chat interface loads

---

### Step 3.4 - NPCs Page

Update `/app/npcs/page.tsx` to show NPC management.

**Required changes:**
1. Import `NPCList` from `/components/npcs/npc-list`
2. Import `NPCGenerator` from `/components/npcs/npc-generator`
3. Add a "Generate NPC" button that opens NPCGenerator in a Dialog or Sheet
4. Display NPCList in the main area
5. Match the layout style of characters page

After updating, verify:
1. Page builds without errors
2. Can navigate to /npcs
3. NPC list displays
4. Generator modal opens

---

### Step 3.5 - Sessions Page

Update `/app/sessions/page.tsx` to show session management.

**Required changes:**
1. Import `SessionList` from `/components/sessions/session-list`
2. Import `PlotThreads` from `/components/sessions/plot-threads`
3. Import `CampaignTimeline` from `/components/sessions/campaign-timeline`
4. Use Tabs or an organized layout to display:
   - Sessions list
   - Plot threads
   - Campaign timeline
5. Match layout patterns from other pages

After updating, verify:
1. Page builds without errors
2. Can navigate to /sessions
3. All sections display correctly

---

### Step 3.6 - Codex Page

Update `/app/codex/page.tsx` to include spell and monster browsers.

**This page may already exist** with some functionality. If so:

**Required changes:**
1. Import `SpellBrowser` from `/components/codex/spell-browser`
2. Import `MonsterBrowser` from `/components/codex/monster-browser`
3. Use Tabs to switch between:
   - Spells tab
   - Monsters tab
4. Keep any existing UI structure if it matches the redesign

If the page doesn't exist, create it matching the tab pattern from dm-assistant.

After updating, verify:
1. Page builds without errors
2. Can navigate to /codex
3. Can browse spells
4. Can browse monsters

---

### Step 3.7 - Combat Page

Update `/app/combat/page.tsx` to show combat tracker.

**Required changes:**
1. Import `InitiativeList` from `/components/combat/initiative-list`
2. Import `CombatTracker` from `/components/combat/combat-tracker` (if it exists)
3. Display initiative tracker prominently
4. Include controls for managing combat
5. Use Card components for organization

After updating, verify:
1. Page builds without errors
2. Can navigate to /combat
3. Initiative tracker displays
4. Combat management works

---

### Step 3.8 - Dice Page

Update `/app/dice/page.tsx` to show dice roller.

**Required changes:**
1. Import `DiceRoller` from `/components/dice/dice-roller`
2. Display the dice roller in a centered Card
3. Keep the layout simple - this is a utility page
4. Match the general aesthetic of other pages

After updating, verify:
1. Page builds without errors
2. Can navigate to /dice
3. Dice roller displays and functions

---

### Phase 3 Validation

Before proceeding to Phase 4, verify:
1. All pages have been updated
2. Can navigate to each page without errors
3. Each page displays its components correctly
4. Run `pnpm build` - it must succeed
5. No TypeScript errors
6. All pages use consistent layout patterns

**Report completion:** "Phase 3 complete. All pages updated to use migrated components. Build succeeds with no errors."

If any errors occurred, report them and wait for user guidance before proceeding.

---

## Phase 4: Data Storage - No Action Required

**Note to Copilot:** The migrated stores already use localStorage for persistence. This phase requires no action from you. The stores will continue to work as-is.

**User note:** If the user wants to migrate to Postgres/Drizzle in the future, that will be a separate migration task handled outside this guide.

**Report completion:** "Phase 4: Data storage verified. Stores use localStorage and require no changes."

---

## Phase 5: Testing and Validation

**Your objective:** Verify that all migrated features work correctly and identify any issues.

### Step 5.1 - Build Verification

Run these commands and report the results:
1. `pnpm build` - Must succeed with no errors
2. `pnpm tsc --noEmit` - Must have no TypeScript errors

If either command fails, report the specific errors and wait for user guidance.

---

### Step 5.2 - Component Import Verification

Check that all newly added components can be imported without errors:

1. Scan all page files in `/app` for import statements
2. Verify each imported component exists at the specified path
3. Report any missing or incorrectly imported components

---

### Step 5.3 - Styling Consistency Check

Review all migrated components for styling consistency:

**Check each component for:**
1. Uses Tailwind classes matching the design system (fey-cyan, fey-gold, etc.)
2. Uses shadcn/ui components (Card, Button, Input, etc.) not custom alternatives
3. Has consistent spacing (p-4, p-6, gap-4 matching existing pages)
4. Uses backdrop-blur patterns matching `/components/account`
5. Has proper dark mode support (no hard-coded colors)

**Report any components that need styling updates.**

---

### Step 5.4 - Store Integration Check

Verify that components correctly integrate with stores:

**For each component category:**
1. Characters components → character-store
2. Sessions components → session-store
3. NPCs components → npc-store
4. World Map components → world-store
5. Combat components → appropriate stores
6. Dice roller → dice-store

**Check that:**
- Import statements are correct
- Store hooks are used properly (e.g., `useCharacterStore()`)
- No errors from missing store methods

Report any integration issues.

---

### Step 5.5 - API Integration Check

Verify that AI features can connect to API routes:

**Check that these paths exist:**
1. `/app/api/character/*` - Character generation endpoints
2. `/app/api/npc/*` - NPC generation endpoints
3. `/app/api/session/*` - Session tools endpoints
4. `/app/api/dm-assistant/*` - DM chat endpoints

**Check that components:**
1. Import correct API paths
2. Use proper HTTP methods (POST for generation, GET for retrieval)
3. Handle loading and error states

Report any missing API routes or integration issues.

---

### Step 5.6 - Mobile Responsiveness

Review migrated components for mobile compatibility:

**Check that components:**
1. Stack properly on small screens (use Tailwind responsive classes)
2. Don't overflow horizontally
3. Have touch-friendly button sizes
4. Hide/collapse appropriately on mobile

Reference `/components/account` for responsive patterns to follow.

Report any mobile responsiveness issues.

---

### Phase 5 Validation

**Report overall status:**
- Total errors found: [number]
- Build status: [success/failure]
- TypeScript errors: [count]
- Styling issues: [list]
- Integration issues: [list]
- Mobile issues: [list]

Wait for user review before proceeding to Phase 6.

---

## Phase 6: Cleanup and Finalization

**Your objective:** Clean up the codebase and ensure production-ready code quality.

### Step 6.1 - Remove Debug Code

Scan all migrated files for:
1. `console.log()` statements
2. `console.warn()` statements
3. `console.error()` statements (keep only those in try/catch blocks)
4. `// TODO` comments
5. `// FIXME` comments
6. Commented-out code blocks

**Action:** Remove all debug console statements and commented-out code. Keep TODO/FIXME comments but create a list of them for the user.

---

### Step 6.2 - Remove Unused Imports

Scan all migrated files for unused imports.

**Action:** Remove any import statements for variables, functions, or components that aren't used in the file.

---

### Step 6.3 - Verify Export Statements

Check that all components have proper export statements:

1. Components should use `export function ComponentName()` or `export default`
2. No missing exports
3. No duplicate exports

Report any export issues.

---

### Step 6.4 - Update Type Definitions

Check that all components have proper TypeScript types:

1. Props interfaces are defined
2. Function return types are clear
3. No `any` types used (unless absolutely necessary)
4. Event handlers have proper types

Report any typing issues that should be addressed.

---

### Step 6.5 - Final Build Verification

Run final checks:
1. `pnpm build` - Must succeed
2. `pnpm tsc --noEmit` - No errors
3. No console warnings during build
4. All pages accessible without errors

**Report completion:** "Phase 6 complete. Code cleanup finished. Final build succeeds with no errors."

---

---

## Migration Complete

**Report final summary:**
```
FEYFORGE MIGRATION COMPLETED

Phase 1: ✓ Core infrastructure copied
Phase 2: ✓ UI components migrated and styled
Phase 3: ✓ Pages updated
Phase 4: ✓ Data storage verified
Phase 5: ✓ Testing completed
Phase 6: ✓ Cleanup finished

Build Status: [success/failure]
TypeScript Errors: [count]
Total Files Migrated: [count]
Outstanding Issues: [list or "None"]

Ready for user review and testing.
```

---

## If Errors Occur

**When you encounter errors:**
1. Report the specific error message
2. Report which file/step caused the error
3. Wait for user guidance before proceeding
4. Do not attempt to fix errors without explicit instructions


**Error report format:**
```
ERROR in [Phase X, Step X.X]
File: [filepath]
Error: [error message]
Context: [what you were doing when error occurred]

Waiting for user guidance.
```
