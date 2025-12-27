# FeyForge Webpage Features

This document details the structure, purpose, and intended function of each webpage in the FeyForge D&D campaign suite.

## Dashboard (/)

**Purpose**: Main landing page providing an overview of the campaign and quick access to common features.

**Features**:
- Campaign Selector: Switch between different campaigns
- Quick Stats: Display summary statistics about the active campaign
- Recent Sessions: List of recent game sessions with quick access
- Quick Actions: Shortcuts to frequently used features
- AI Assistant Widget: Quick access to AI-powered DM tools

---

## Characters (/characters)

**Purpose**: Manage all player characters in the campaign.

**Features**:
- Character List: View all characters with their basic information
- Create New Character: Button to navigate to character creation
- Filter/Search: Find specific characters
- Quick Access: Click on characters to view their full sheet

---

## Create Character (/characters/new)

**Purpose**: Step-by-step character creation interface.

**Features**:
- Step 1 - Basics: Name, race, class, level selection
- Step 2 - Abilities: Ability score assignment
- Step 3 - Skills: Skill proficiency selection
- Step 4 - Equipment: Starting equipment selection
- Step 5 - Details: Background, personality traits, and additional details
- Quick Build Wizard: Automated character creation option
- Live Preview: Real-time preview of character stats
- Spell Selector: Choose starting spells for spellcasting classes
- Equipment Wizard: Guided equipment selection
- Campaign Association: Automatically associate with active campaign
- Cancel/Complete: Navigation options to cancel or finish creation

---

## Character Sheet (/characters/[id])

**Purpose**: View and manage individual character details.

**Features**:
- Ability Scores: Display and modify ability scores with modifiers
- Combat Stats: AC, initiative, speed, and other combat-related stats
- Hit Points Panel: Current HP, max HP, temporary HP tracking
- Saving Throws Panel: Saving throw bonuses with proficiency indicators
- Skills Panel: All skills with proficiency and bonuses
- Features Panel: Class features, racial traits, and special abilities
- Spells Panel: Spell list with prepared/known spells and spell slots
- Equipment Panel: Inventory management and equipment tracking
- Resource Tracker: Track limited resources (spell slots, class features, etc.)
- Alternate Forms: Manage wildshape or other form transformations
- Quick Actions: Common character actions and shortcuts
- Play Mode: Simplified view for active gameplay
- Back Navigation: Return to character list

---

## Arcane Codex (/codex)

**Purpose**: D&D 5e SRD reference library for rules and content lookup.

**Features**:
- Tab Navigation: Switch between different reference categories
- Spells Tab: Browse and search spells
  - Filter by level, school, class, and casting time
  - View detailed spell information
- Monsters Tab: Browse and search monsters
  - Filter by CR, type, and environment
  - View stat blocks and abilities
- Conditions Tab: Reference game conditions
  - View condition effects and rules
- Equipment Tab: Browse weapons, armor, and items
  - View item properties and costs

---

## Combat Tracker (/combat)

**Purpose**: Manage initiative and track combat encounters.

**Features**:
- Initiative Tracker: Add and order combatants by initiative
- Turn Management: Track current turn and round number
- HP Tracking: Monitor combatant health during combat
- Condition Tracking: Apply and track conditions on combatants
- Add Combatants: Include PCs, NPCs, and monsters
- Remove Combatants: Remove defeated or fled combatants
- Roll Initiative: Automated initiative rolling

---

## Dice Roller (/dice)

**Purpose**: Virtual dice rolling for game mechanics.

**Features**:
- Dice Selection: Choose different die types (d4, d6, d8, d10, d12, d20, d100)
- Custom Notation: Enter custom dice notation (e.g., 2d6+3)
- Roll History: View previous rolls
- Modifiers: Add bonuses or penalties to rolls
- Advantage/Disadvantage: Support for D&D 5e advantage system
- Critical Hit Particles: Visual effects for natural 20s
- Sound Effects: Optional dice rolling sounds
- Animations: Optional rolling animations

---

## DM Assistant (/dm-assistant)

**Purpose**: AI-powered tools to help Dungeon Masters run their games.

**Features**:
- Tab Navigation: Switch between different DM tools
- AI Chat Tab: Conversational AI assistant
  - Ask questions about rules
  - Get creative suggestions
  - Generate content on the fly
- Encounter Builder Tab: Create balanced encounters
  - Select monsters
  - Calculate encounter difficulty
  - Adjust for party size and level
- Loot Generator Tab: Generate treasure
  - Random loot generation
  - Customize loot tables
  - CR-appropriate rewards

---

## NPCs (/npcs)

**Purpose**: Manage non-player characters.

**Features**:
- NPC List: View all NPCs with basic information
- Generate NPC: Button to navigate to NPC generator
- Edit NPC: Modify existing NPC details
- Delete NPC: Remove NPCs from the list
- Filter/Search: Find specific NPCs
- NPC Details: View full NPC information

---

## Generate NPC (/npcs/generate)

**Purpose**: Create memorable NPCs with AI assistance.

**Features**:
- AI Generation: Generate NPC personality, appearance, and background
- Customization: Adjust generated details
- Quick Stats: Basic stat block generation
- Save NPC: Add to NPC list
- Regenerate: Create alternative versions

---

## Sessions (/sessions)

**Purpose**: Track campaign sessions and story progression.

**Features**:
- Tab Navigation: Switch between different session views
- Sessions Tab: List of all game sessions
  - Session number and title
  - Date and status
  - Quick access to session details
  - Create new session
- Plot Threads Tab: Track ongoing storylines
  - Active plot threads
  - Resolved plots
  - Plot importance and status
- Timeline Tab: Chronological campaign history
  - Major events
  - Session milestones
  - Campaign progress

---

## New Session (/sessions/new)

**Purpose**: Plan and prepare for upcoming game sessions.

**Features**:
- Session Editor: Create new session
- Session Number: Auto-incrementing session number
- Title: Session title/name
- Date Planning: Schedule session date
- Notes: Preparation notes and planned content
- Objectives: Session goals and planned encounters
- Save Session: Add to session list

---

## Session Details (/sessions/[id])

**Purpose**: View and manage individual session details.

**Features**:
- Session Editor: Edit session information
- Live Session Mode: Start active gameplay mode
  - Real-time session tracking
  - Quick notes during play
  - Track session progress
  - XP Calculator: Award experience points
- Session Status: Mark session as planned, in-progress, or completed
- Back Navigation: Return to session list
- Session Notes: Record what happened during the session

---

## Settings (/settings)

**Purpose**: Configure application preferences and manage data.

**Features**:
- General Settings:
  - Auto-save: Toggle automatic saving
  - Confirm Deletions: Toggle deletion confirmations
  - Default Dice Notation: Set preferred dice notation
- Dice Roller Settings:
  - Dice Sounds: Toggle sound effects
  - Dice Animations: Toggle rolling animations
- AI Assistant Settings:
  - Response Style: Choose between concise, balanced, or detailed
- Data Management:
  - Export All Data: Download backup of all data
  - Import Data: Restore from backup (feature placeholder)
  - Clear All Data: Reset application (with confirmation)

---

## World Map (/world-map)

**Purpose**: Track locations and plan adventures across the campaign world.

**Features**:
- Interactive Map: Visual representation of the game world
- Location Markers: Mark important locations
- Location Details: Add notes and information to locations
- Track Adventures: See where the party has been
- Plan Routes: Visualize travel paths
