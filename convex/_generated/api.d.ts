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
import type * as acquisition from "../acquisition.js";
import type * as admin from "../admin.js";
import type * as ads from "../ads.js";
import type * as agentTokens from "../agentTokens.js";
import type * as ai_fixtures from "../ai/fixtures.js";
import type * as ai_prospectCheck from "../ai/prospectCheck.js";
import type * as ai_providers from "../ai/providers.js";
import type * as ai_research from "../ai/research.js";
import type * as ai_veo from "../ai/veo.js";
import type * as analytics from "../analytics.js";
import type * as assetEdits from "../assetEdits.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as autopilot from "../autopilot.js";
import type * as billing from "../billing.js";
import type * as circuits from "../circuits.js";
import type * as climb from "../climb.js";
import type * as connectionActions from "../connectionActions.js";
import type * as connections from "../connections.js";
import type * as content from "../content.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as emailActions from "../emailActions.js";
import type * as engine from "../engine.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as jobWrites from "../jobWrites.js";
import type * as jobs from "../jobs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_accounts from "../lib/accounts.js";
import type * as lib_aiMode from "../lib/aiMode.js";
import type * as lib_approvals from "../lib/approvals.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_autopilot from "../lib/autopilot.js";
import type * as lib_cards from "../lib/cards.js";
import type * as lib_climbTools from "../lib/climbTools.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_jobPlans from "../lib/jobPlans.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_periods from "../lib/periods.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as lib_staff from "../lib/staff.js";
import type * as lib_tenancy from "../lib/tenancy.js";
import type * as lib_usage from "../lib/usage.js";
import type * as links from "../links.js";
import type * as mailbox from "../mailbox.js";
import type * as maintenance from "../maintenance.js";
import type * as marketing from "../marketing.js";
import type * as mcp from "../mcp.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as ops from "../ops.js";
import type * as orgs from "../orgs.js";
import type * as outbound from "../outbound.js";
import type * as outboundSending from "../outboundSending.js";
import type * as preview from "../preview.js";
import type * as previewRunner from "../previewRunner.js";
import type * as publicConfig from "../publicConfig.js";
import type * as publish from "../publish.js";
import type * as reels from "../reels.js";
import type * as referrals from "../referrals.js";
import type * as reports from "../reports.js";
import type * as settings from "../settings.js";
import type * as team from "../team.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  acquisition: typeof acquisition;
  admin: typeof admin;
  ads: typeof ads;
  agentTokens: typeof agentTokens;
  "ai/fixtures": typeof ai_fixtures;
  "ai/prospectCheck": typeof ai_prospectCheck;
  "ai/providers": typeof ai_providers;
  "ai/research": typeof ai_research;
  "ai/veo": typeof ai_veo;
  analytics: typeof analytics;
  assetEdits: typeof assetEdits;
  assets: typeof assets;
  auth: typeof auth;
  autopilot: typeof autopilot;
  billing: typeof billing;
  circuits: typeof circuits;
  climb: typeof climb;
  connectionActions: typeof connectionActions;
  connections: typeof connections;
  content: typeof content;
  crm: typeof crm;
  crons: typeof crons;
  demo: typeof demo;
  emailActions: typeof emailActions;
  engine: typeof engine;
  http: typeof http;
  inbox: typeof inbox;
  jobWrites: typeof jobWrites;
  jobs: typeof jobs;
  "lib/access": typeof lib_access;
  "lib/accounts": typeof lib_accounts;
  "lib/aiMode": typeof lib_aiMode;
  "lib/approvals": typeof lib_approvals;
  "lib/audit": typeof lib_audit;
  "lib/autopilot": typeof lib_autopilot;
  "lib/cards": typeof lib_cards;
  "lib/climbTools": typeof lib_climbTools;
  "lib/config": typeof lib_config;
  "lib/credits": typeof lib_credits;
  "lib/crypto": typeof lib_crypto;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/jobPlans": typeof lib_jobPlans;
  "lib/media": typeof lib_media;
  "lib/periods": typeof lib_periods;
  "lib/r2": typeof lib_r2;
  "lib/staff": typeof lib_staff;
  "lib/tenancy": typeof lib_tenancy;
  "lib/usage": typeof lib_usage;
  links: typeof links;
  mailbox: typeof mailbox;
  maintenance: typeof maintenance;
  marketing: typeof marketing;
  mcp: typeof mcp;
  migrations: typeof migrations;
  notifications: typeof notifications;
  ops: typeof ops;
  orgs: typeof orgs;
  outbound: typeof outbound;
  outboundSending: typeof outboundSending;
  preview: typeof preview;
  previewRunner: typeof previewRunner;
  publicConfig: typeof publicConfig;
  publish: typeof publish;
  reels: typeof reels;
  referrals: typeof referrals;
  reports: typeof reports;
  settings: typeof settings;
  team: typeof team;
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
