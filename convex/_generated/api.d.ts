/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as abtests from "../abtests.js";
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
import type * as airly from "../airly.js";
import type * as airlyActions from "../airlyActions.js";
import type * as analytics from "../analytics.js";
import type * as assetEdits from "../assetEdits.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as autopilot from "../autopilot.js";
import type * as billing from "../billing.js";
import type * as bio from "../bio.js";
import type * as bookings from "../bookings.js";
import type * as brand from "../brand.js";
import type * as chat from "../chat.js";
import type * as circuits from "../circuits.js";
import type * as clientReports from "../clientReports.js";
import type * as climb from "../climb.js";
import type * as competitorActions from "../competitorActions.js";
import type * as competitors from "../competitors.js";
import type * as connectionActions from "../connectionActions.js";
import type * as connections from "../connections.js";
import type * as content from "../content.js";
import type * as customAgents from "../customAgents.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as designs from "../designs.js";
import type * as emailActions from "../emailActions.js";
import type * as engine from "../engine.js";
import type * as engineFlags from "../engineFlags.js";
import type * as engineLab from "../engineLab.js";
import type * as engineLabActions from "../engineLabActions.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as jobWrites from "../jobWrites.js";
import type * as jobs from "../jobs.js";
import type * as landing from "../landing.js";
import type * as learning from "../learning.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_accounts from "../lib/accounts.js";
import type * as lib_aiMode from "../lib/aiMode.js";
import type * as lib_approvals from "../lib/approvals.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_autopilot from "../lib/autopilot.js";
import type * as lib_cards from "../lib/cards.js";
import type * as lib_climbConfig from "../lib/climbConfig.js";
import type * as lib_climbTools from "../lib/climbTools.js";
import type * as lib_config from "../lib/config.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_estimate from "../lib/estimate.js";
import type * as lib_jobPlans from "../lib/jobPlans.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_periods from "../lib/periods.js";
import type * as lib_planHash from "../lib/planHash.js";
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
import type * as planHistory from "../planHistory.js";
import type * as playResults from "../playResults.js";
import type * as preview from "../preview.js";
import type * as previewRunner from "../previewRunner.js";
import type * as publicConfig from "../publicConfig.js";
import type * as publish from "../publish.js";
import type * as push from "../push.js";
import type * as pushActions from "../pushActions.js";
import type * as reels from "../reels.js";
import type * as referrals from "../referrals.js";
import type * as reports from "../reports.js";
import type * as repurpose from "../repurpose.js";
import type * as repurposeActions from "../repurposeActions.js";
import type * as reviews from "../reviews.js";
import type * as settings from "../settings.js";
import type * as siteWatch from "../siteWatch.js";
import type * as siteWatchActions from "../siteWatchActions.js";
import type * as status from "../status.js";
import type * as targets from "../targets.js";
import type * as team from "../team.js";
import type * as translate from "../translate.js";
import type * as webhooks from "../webhooks.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abtests: typeof abtests;
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
  airly: typeof airly;
  airlyActions: typeof airlyActions;
  analytics: typeof analytics;
  assetEdits: typeof assetEdits;
  assets: typeof assets;
  auth: typeof auth;
  autopilot: typeof autopilot;
  billing: typeof billing;
  bio: typeof bio;
  bookings: typeof bookings;
  brand: typeof brand;
  chat: typeof chat;
  circuits: typeof circuits;
  clientReports: typeof clientReports;
  climb: typeof climb;
  competitorActions: typeof competitorActions;
  competitors: typeof competitors;
  connectionActions: typeof connectionActions;
  connections: typeof connections;
  content: typeof content;
  customAgents: typeof customAgents;
  crm: typeof crm;
  crons: typeof crons;
  demo: typeof demo;
  designs: typeof designs;
  emailActions: typeof emailActions;
  engine: typeof engine;
  engineFlags: typeof engineFlags;
  engineLab: typeof engineLab;
  engineLabActions: typeof engineLabActions;
  feedback: typeof feedback;
  http: typeof http;
  inbox: typeof inbox;
  jobWrites: typeof jobWrites;
  jobs: typeof jobs;
  landing: typeof landing;
  learning: typeof learning;
  "lib/access": typeof lib_access;
  "lib/accounts": typeof lib_accounts;
  "lib/aiMode": typeof lib_aiMode;
  "lib/approvals": typeof lib_approvals;
  "lib/audit": typeof lib_audit;
  "lib/autopilot": typeof lib_autopilot;
  "lib/cards": typeof lib_cards;
  "lib/climbConfig": typeof lib_climbConfig;
  "lib/climbTools": typeof lib_climbTools;
  "lib/config": typeof lib_config;
  "lib/credits": typeof lib_credits;
  "lib/crypto": typeof lib_crypto;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/estimate": typeof lib_estimate;
  "lib/jobPlans": typeof lib_jobPlans;
  "lib/media": typeof lib_media;
  "lib/notify": typeof lib_notify;
  "lib/periods": typeof lib_periods;
  "lib/planHash": typeof lib_planHash;
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
  planHistory: typeof planHistory;
  playResults: typeof playResults;
  preview: typeof preview;
  previewRunner: typeof previewRunner;
  publicConfig: typeof publicConfig;
  publish: typeof publish;
  push: typeof push;
  pushActions: typeof pushActions;
  reels: typeof reels;
  referrals: typeof referrals;
  reports: typeof reports;
  repurpose: typeof repurpose;
  repurposeActions: typeof repurposeActions;
  reviews: typeof reviews;
  settings: typeof settings;
  siteWatch: typeof siteWatch;
  siteWatchActions: typeof siteWatchActions;
  status: typeof status;
  targets: typeof targets;
  team: typeof team;
  translate: typeof translate;
  webhooks: typeof webhooks;
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
