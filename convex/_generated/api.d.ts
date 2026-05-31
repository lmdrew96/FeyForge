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
import type * as audio from "../audio.js";
import type * as campaignMembers from "../campaignMembers.js";
import type * as campaignScenes from "../campaignScenes.js";
import type * as campaignWeb from "../campaignWeb.js";
import type * as campaigns from "../campaigns.js";
import type * as characters from "../characters.js";
import type * as crons from "../crons.js";
import type * as dmConversations from "../dmConversations.js";
import type * as encounters from "../encounters.js";
import type * as lib_auth from "../lib/auth.js";
import type * as libraryShare from "../libraryShare.js";
import type * as liveCombat from "../liveCombat.js";
import type * as liveSessions from "../liveSessions.js";
import type * as migrations from "../migrations.js";
import type * as npcs from "../npcs.js";
import type * as partyInventory from "../partyInventory.js";
import type * as sessionNotes from "../sessionNotes.js";
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
  audio: typeof audio;
  campaignMembers: typeof campaignMembers;
  campaignScenes: typeof campaignScenes;
  campaignWeb: typeof campaignWeb;
  campaigns: typeof campaigns;
  characters: typeof characters;
  crons: typeof crons;
  dmConversations: typeof dmConversations;
  encounters: typeof encounters;
  "lib/auth": typeof lib_auth;
  libraryShare: typeof libraryShare;
  liveCombat: typeof liveCombat;
  liveSessions: typeof liveSessions;
  migrations: typeof migrations;
  npcs: typeof npcs;
  partyInventory: typeof partyInventory;
  sessionNotes: typeof sessionNotes;
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
