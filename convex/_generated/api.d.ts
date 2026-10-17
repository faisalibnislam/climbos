/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as ai_fixtures from "../ai/fixtures.js";
import type * as ai_providers from "../ai/providers.js";
import type * as ai_research from "../ai/research.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as circuits from "../circuits.js";
import type * as connectionActions from "../connectionActions.js";
import type * as connections from "../connections.js";
import type * as engine from "../engine.js";
import type * as http from "../http.js";
import type * as jobWrites from "../jobWrites.js";
import type * as jobs from "../jobs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_jobPlans from "../lib/jobPlans.js";
import type * as lib_periods from "../lib/periods.js";
import type * as lib_tenancy from "../lib/tenancy.js";
import type * as notifications from "../notifications.js";
import type * as orgs from "../orgs.js";
import type * as preview from "../preview.js";
import type * as previewRunner from "../previewRunner.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  "ai/fixtures": typeof ai_fixtures;
  "ai/providers": typeof ai_providers;
  "ai/research": typeof ai_research;
  analytics: typeof analytics;
  auth: typeof auth;
  circuits: typeof circuits;
  connectionActions: typeof connectionActions;
  connections: typeof connections;
  engine: typeof engine;
  http: typeof http;
  jobWrites: typeof jobWrites;
  jobs: typeof jobs;
  "lib/access": typeof lib_access;
  "lib/audit": typeof lib_audit;
  "lib/crypto": typeof lib_crypto;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/jobPlans": typeof lib_jobPlans;
  "lib/periods": typeof lib_periods;
  "lib/tenancy": typeof lib_tenancy;
  notifications: typeof notifications;
  orgs: typeof orgs;
  preview: typeof preview;
  previewRunner: typeof previewRunner;
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
