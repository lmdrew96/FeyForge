/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as aiUsage from "../aiUsage.js";
import type * as audio from "../audio.js";
import type * as campaignJournal from "../campaignJournal.js";
import type * as campaignMembers from "../campaignMembers.js";
import type * as campaignQuests from "../campaignQuests.js";
import type * as campaignSharedQuests from "../campaignSharedQuests.js";
import type * as campaignWeb from "../campaignWeb.js";
import type * as campaigns from "../campaigns.js";
import type * as characters from "../characters.js";
import type * as crons from "../crons.js";
import type * as diplomacy from "../diplomacy.js";
import type * as dmConversations from "../dmConversations.js";
import type * as encounters from "../encounters.js";
import type * as faiths from "../faiths.js";
import type * as friends from "../friends.js";
import type * as homebrew from "../homebrew.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_homebrewValidators from "../lib/homebrewValidators.js";
import type * as lib_notify from "../lib/notify.js";
import type * as libraryShare from "../libraryShare.js";
import type * as liveCaptions from "../liveCaptions.js";
import type * as liveCombat from "../liveCombat.js";
import type * as liveSessions from "../liveSessions.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as npcPool from "../npcPool.js";
import type * as npcs from "../npcs.js";
import type * as partyInventory from "../partyInventory.js";
import type * as premiumStatus from "../premiumStatus.js";
import type * as presence from "../presence.js";
import type * as sessionChat from "../sessionChat.js";
import type * as sessionNotes from "../sessionNotes.js";
import type * as sessionRolls from "../sessionRolls.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";
import type * as wiki from "../wiki.js";
import type * as worldMap from "../worldMap.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  aiUsage: typeof aiUsage;
  audio: typeof audio;
  campaignJournal: typeof campaignJournal;
  campaignMembers: typeof campaignMembers;
  campaignQuests: typeof campaignQuests;
  campaignSharedQuests: typeof campaignSharedQuests;
  campaignWeb: typeof campaignWeb;
  campaigns: typeof campaigns;
  characters: typeof characters;
  crons: typeof crons;
  diplomacy: typeof diplomacy;
  dmConversations: typeof dmConversations;
  encounters: typeof encounters;
  faiths: typeof faiths;
  friends: typeof friends;
  homebrew: typeof homebrew;
  "lib/auth": typeof lib_auth;
  "lib/homebrewValidators": typeof lib_homebrewValidators;
  "lib/notify": typeof lib_notify;
  libraryShare: typeof libraryShare;
  liveCaptions: typeof liveCaptions;
  liveCombat: typeof liveCombat;
  liveSessions: typeof liveSessions;
  migrations: typeof migrations;
  notifications: typeof notifications;
  npcPool: typeof npcPool;
  npcs: typeof npcs;
  partyInventory: typeof partyInventory;
  premiumStatus: typeof premiumStatus;
  presence: typeof presence;
  sessionChat: typeof sessionChat;
  sessionNotes: typeof sessionNotes;
  sessionRolls: typeof sessionRolls;
  sessions: typeof sessions;
  users: typeof users;
  wiki: typeof wiki;
  worldMap: typeof worldMap;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
