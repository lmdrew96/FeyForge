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
import type * as campaigns from "../campaigns.js";
import type * as characters from "../characters.js";
import type * as dmConversations from "../dmConversations.js";
import type * as encounters from "../encounters.js";
import type * as liveSessions from "../liveSessions.js";
import type * as npcs from "../npcs.js";
import type * as sessions from "../sessions.js";
import type * as world from "../world.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  campaigns: typeof campaigns;
  characters: typeof characters;
  dmConversations: typeof dmConversations;
  encounters: typeof encounters;
  liveSessions: typeof liveSessions;
  npcs: typeof npcs;
  sessions: typeof sessions;
  world: typeof world;
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
