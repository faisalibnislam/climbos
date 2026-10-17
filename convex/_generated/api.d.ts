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
import type * as ads from "../ads.js";
import type * as ai_fixtures from "../ai/fixtures.js";
import type * as ai_providers from "../ai/providers.js";
import type * as ai_research from "../ai/research.js";
import type * as analytics from "../analytics.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as autopilot from "../autopilot.js";
import type * as billing from "../billing.js";
import type * as circuits from "../circuits.js";
import type * as connectionActions from "../connectionActions.js";
import type * as connections from "../connections.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as emailActions from "../emailActions.js";
import type * as engine from "../engine.js";
import type * as http from "../http.js";
import type * as jobWrites from "../jobWrites.js";
import type * as jobs from "../jobs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_approvals from "../lib/approvals.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_autopilot from "../lib/autopilot.js";
import type * as lib_cards from "../lib/cards.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_jobPlans from "../lib/jobPlans.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_periods from "../lib/periods.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as lib_tenancy from "../lib/tenancy.js";
import type * as maintenance from "../maintenance.js";
import type * as marketing from "../marketing.js";
import type * as notifications from "../notifications.js";
import type * as ops from "../ops.js";
import type * as orgs from "../orgs.js";
import type * as preview from "../preview.js";
import type * as previewRunner from "../previewRunner.js";
import type * as publicConfig from "../publicConfig.js";
import type * as publish from "../publish.js";
import type * as settings from "../settings.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  ads: typeof ads;
  "ai/fixtures": typeof ai_fixtures;
  "ai/providers": typeof ai_providers;
  "ai/research": typeof ai_research;
  analytics: typeof analytics;
  assets: typeof assets;
  auth: typeof auth;
  autopilot: typeof autopilot;
  billing: typeof billing;
  circuits: typeof circuits;
  connectionActions: typeof connectionActions;
  connections: typeof connections;
  content: typeof content;
  crons: typeof crons;
  demo: typeof demo;
  emailActions: typeof emailActions;
  engine: typeof engine;
  http: typeof http;
  jobWrites: typeof jobWrites;
  jobs: typeof jobs;
  "lib/access": typeof lib_access;
  "lib/approvals": typeof lib_approvals;
  "lib/audit": typeof lib_audit;
  "lib/autopilot": typeof lib_autopilot;
  "lib/cards": typeof lib_cards;
  "lib/crypto": typeof lib_crypto;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/jobPlans": typeof lib_jobPlans;
  "lib/media": typeof lib_media;
  "lib/periods": typeof lib_periods;
  "lib/r2": typeof lib_r2;
  "lib/tenancy": typeof lib_tenancy;
  maintenance: typeof maintenance;
  marketing: typeof marketing;
  notifications: typeof notifications;
  ops: typeof ops;
  orgs: typeof orgs;
  preview: typeof preview;
  previewRunner: typeof previewRunner;
  publicConfig: typeof publicConfig;
  publish: typeof publish;
  settings: typeof settings;
  workspace: typeof workspace;
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
