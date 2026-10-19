/*
 * ClimbOS Sharp: our own icon set, drawn for ClimbOS (2026-10-19).
 *
 * Rules (keep every new icon to them):
 * - 24px grid, live area 3–21 (3px padding); stroke 1.5px, outline only.
 * - Square caps and mitred joins: no rounded ends, no rounded corners.
 * - Hard right angles; a 45° cut replaces a curve wherever a curve isn't the meaning
 *   (shoulders, bells, shackles, speech tails). Circles only for heads, clocks,
 *   lenses, coins and globes.
 * - Small marks (dots, knobs) are squares, never circles.
 * Names match the lucide/Font Awesome icons they replace, so screens import them unchanged.
 */
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Icon, IconProps } from "./index";

type Part = string | { c: [number, number, number] } | { sq: [number, number, number] };

function draw(parts: Part[]): ReactNode {
  return parts.map((p, i) => {
    if (typeof p === "string") return <path key={i} d={p} />;
    if ("c" in p) return <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />;
    const [x, y, s] = p.sq;
    return <rect key={i} x={x} y={y} width={s} height={s} fill="currentColor" stroke="none" />;
  });
}

function sharp(name: string, parts: Part[]): Icon {
  const C = forwardRef<SVGSVGElement, IconProps>(function SharpIcon({ size = 24, strokeWidth = 1.5, absoluteStrokeWidth: _a, className, ...props }, ref) {
    const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeMiterlimit={10}
        focusable="false"
        aria-hidden={labelled ? undefined : true}
        role={labelled ? "img" : undefined}
        className={cn("climb-icon", className)}
        {...props}
      >
        {draw(parts)}
      </svg>
    );
  });
  C.displayName = name;
  return C;
}

/* ---- Actions ---- */
export const Plus = sharp("Plus", ["M12 4.5v15", "M4.5 12h15"]);
export const Minus = sharp("Minus", ["M4.5 12h15"]);
export const X = sharp("X", ["M5.5 5.5l13 13", "M18.5 5.5l-13 13"]);
export const Check = sharp("Check", ["M4.5 12.5l4.5 4.5 10.5-10.5"]);
export const Search = sharp("Search", [{ c: [10.5, 10.5, 6.5] }, "M15.5 15.5l4.5 4.5"]);
export const Download = sharp("Download", ["M12 4v10.5", "M7.5 10l4.5 4.5 4.5-4.5", "M4.5 19.5h15"]);
export const Upload = sharp("Upload", ["M12 15V4.5", "M7.5 9l4.5-4.5L16.5 9", "M4.5 19.5h15"]);
export const Copy = sharp("Copy", ["M8.5 8.5h11v11h-11z", "M15.5 8.5v-4h-11v11h4"]);
export const Pencil = sharp("Pencil", ["M15 4.5l4.5 4.5-10 10H5v-4.5z", "M12.5 7l4.5 4.5"]);
export const Trash2 = sharp("Trash2", ["M4.5 6.5h15", "M9 6.5v-3h6v3", "M6.5 6.5l1 13.5h9l1-13.5", "M10.25 10.5v6", "M13.75 10.5v6"]);
export const ExternalLink = sharp("ExternalLink", ["M10.5 5H5v14h14v-5.5", "M14 4.5h5.5V10", "M19.5 4.5l-8.5 8.5"]);
export const Link2 = sharp("Link2", ["M10 7.5H4.5v9H10", "M14 7.5h5.5v9H14", "M8.5 12h7"]);
export const Send = sharp("Send", ["M20.5 3.5L3.5 10.5l7 3 3 7z", "M10.5 13.5l10-10"]);
export const LogOut = sharp("LogOut", ["M10 4.5H4.5v15H10", "M15 8l4 4-4 4", "M19 12H9.5"]);
export const RefreshCw = sharp("RefreshCw", ["M19.5 9.5L17 5.5H7L4.5 9.5", "M19.5 5.5v4h-4", "M4.5 14.5L7 18.5h10l2.5-4", "M4.5 18.5v-4h4"]);
export const Filter = sharp("Filter", ["M4 5h16l-6 7.5V19l-4 1.5v-8z"]);

/* ---- Navigation ---- */
export const ChevronDown = sharp("ChevronDown", ["M6.5 9.5l5.5 5.5 5.5-5.5"]);
export const ChevronUp = sharp("ChevronUp", ["M6.5 14.5L12 9l5.5 5.5"]);
export const ChevronLeft = sharp("ChevronLeft", ["M14.5 6.5L9 12l5.5 5.5"]);
export const ChevronRight = sharp("ChevronRight", ["M9.5 6.5L15 12l-5.5 5.5"]);
export const ChevronsUpDown = sharp("ChevronsUpDown", ["M8 9.5l4-4 4 4", "M8 14.5l4 4 4-4"]);
export const ArrowRight = sharp("ArrowRight", ["M4.5 12h14", "M13 6.5l5.5 5.5-5.5 5.5"]);
export const ArrowLeft = sharp("ArrowLeft", ["M19.5 12h-14", "M11 6.5L5.5 12l5.5 5.5"]);
export const ArrowUp = sharp("ArrowUp", ["M12 19.5v-14", "M6.5 11L12 5.5l5.5 5.5"]);
export const ArrowDown = sharp("ArrowDown", ["M12 4.5v14", "M6.5 13l5.5 5.5 5.5-5.5"]);
export const ArrowUpDown = sharp("ArrowUpDown", ["M8 19.5V5", "M4.5 8.5L8 5l3.5 3.5", "M16 4.5V19", "M12.5 15.5L16 19l3.5-3.5"]);
export const Menu = sharp("Menu", ["M4.5 7h15", "M4.5 12h15", "M4.5 17h15"]);
export const MoreHorizontal = sharp("MoreHorizontal", [{ sq: [4.5, 11, 2] }, { sq: [11, 11, 2] }, { sq: [17.5, 11, 2] }]);
export const Ellipsis = MoreHorizontal;
export const MoreVertical = sharp("MoreVertical", [{ sq: [11, 4.5, 2] }, { sq: [11, 11, 2] }, { sq: [11, 17.5, 2] }]);
export const PanelLeft = sharp("PanelLeft", ["M3.5 4.5h17v15h-17z", "M9.5 4.5v15"]);
export const Home = sharp("Home", ["M3.5 10.5L12 4l8.5 6.5", "M5.5 9v11h13V9", "M10 20v-5.5h4V20"]);
export const LayoutGrid = sharp("LayoutGrid", ["M4.5 4.5h6v6h-6z", "M13.5 4.5h6v6h-6z", "M4.5 13.5h6v6h-6z", "M13.5 13.5h6v6h-6z"]);
export const Settings = sharp("Settings", [
  "M10.92 5.49L10.79 3.08H13.21L13.08 5.49L15.84 6.63L17.45 4.84L19.16 6.55L17.37 8.16L18.51 10.92L20.92 10.79V13.21L18.51 13.08L17.37 15.84L19.16 17.45L17.45 19.16L15.84 17.37L13.08 18.51L13.21 20.92H10.79L10.92 18.51L8.16 17.37L6.55 19.16L4.84 17.45L6.63 15.84L5.49 13.08L3.08 13.21V10.79L5.49 10.92L6.63 8.16L4.84 6.55L6.55 4.84L8.16 6.63Z",
  "M10 10h4v4h-4z",
]);
export const Cog = Settings;
export const SlidersHorizontal = sharp("SlidersHorizontal", ["M4.5 7.5h8", "M17.5 7.5h2", "M4.5 16.5h2", "M11.5 16.5h8", "M12.5 5.5h4v4h-4z", "M6.5 14.5h4v4h-4z"]);
export const Settings2 = SlidersHorizontal;

/* ---- People and messages ---- */
export const UserRound = sharp("UserRound", [{ c: [12, 8, 3.75] }, "M4.5 20.5v-2.5L7.5 15h9l3 3v2.5"]);
export const Users = sharp("Users", [{ c: [9, 8, 3.25] }, "M3 20.5v-2l2.5-2.5h7l2.5 2.5v2", "M15.5 4.9a3.25 3.25 0 0 1 0 6.2", "M17.5 16h1l2.5 2.5v2"]);
export const UsersRound = Users;
export const MessageCircle = sharp("MessageCircle", ["M4 4.5h16v11h-8.5L7 20v-4.5H4z"]);
export const MessageSquare = MessageCircle;
export const MessageSquareText = sharp("MessageSquareText", ["M4 4.5h16v11h-8.5L7 20v-4.5H4z", "M8 8.5h8", "M8 11.5h5"]);
export const Mail = sharp("Mail", ["M3.5 5.5h17v13h-17z", "M3.5 5.5l8.5 7 8.5-7"]);
export const Inbox = sharp("Inbox", ["M3.5 13L6.5 5h11l3 8v6.5h-17z", "M3.5 13h5l1 2.5h5l1-2.5h5"]);
export const Bell = sharp("Bell", ["M6 16.5v-5.5L8.5 5.5h7L18 11v5.5", "M4 16.5h16", "M10 20h4"]);
export const Megaphone = sharp("Megaphone", ["M3.5 9.5v5h3l9 5v-15l-9 5z", "M6.5 14.5l1.5 5.5h2.5l-1-4.5", "M19 9.5v5"]);

/* ---- Time and data ---- */
export const Clock = sharp("Clock", [{ c: [12, 12, 8.5] }, "M12 7v5l3.5 2"]);
export const CalendarDays = sharp("CalendarDays", ["M4 6h16v14H4z", "M4 10h16", "M8 3.5v4", "M16 3.5v4", { sq: [7.25, 13, 2] }, { sq: [11, 13, 2] }, { sq: [14.75, 13, 2] }, { sq: [7.25, 16.5, 2] }, { sq: [11, 16.5, 2] }]);
export const CalendarCheck = sharp("CalendarCheck", ["M4 6h16v14H4z", "M4 10h16", "M8 3.5v4", "M16 3.5v4", "M8.5 15l2.5 2.5 4.5-4.5"]);
export const ChartLine = sharp("ChartLine", ["M4 4v16h16", "M7.5 15l3.5-4 3 3 5-6"]);
export const BarChart3 = sharp("BarChart3", ["M4 20h16", "M7.5 17v-5", "M12 17V7", "M16.5 17v-8"]);
export const TrendingUp = sharp("TrendingUp", ["M3.5 17.5l6-6 4 4 7-7.5", "M15 8h5.5v5.5"]);
export const Activity = sharp("Activity", ["M3 12h4l3-7 4 14 3-7h4"]);
export const Target = sharp("Target", [{ c: [12, 12, 8.5] }, { c: [12, 12, 4.5] }, { sq: [11, 11, 2] }]);

/* ---- Status ---- */
export const Info = sharp("Info", [{ c: [12, 12, 8.5] }, "M12 11v5.5", { sq: [11.1, 7.1, 1.8] }]);
export const CircleAlert = sharp("CircleAlert", [{ c: [12, 12, 8.5] }, "M12 7.5v5.5", { sq: [11.1, 15.6, 1.8] }]);
export const TriangleAlert = sharp("TriangleAlert", ["M12 3.5l9 16H3z", "M12 9.5V14", { sq: [11.1, 16, 1.8] }]);
export const CircleCheck = sharp("CircleCheck", [{ c: [12, 12, 8.5] }, "M8 12.25l2.75 2.75 5.25-5.5"]);
export const CheckCircle2 = CircleCheck;
export const CircleX = sharp("CircleX", [{ c: [12, 12, 8.5] }, "M9 9l6 6", "M15 9l-6 6"]);
export const Lock = sharp("Lock", ["M5 11h14v9.5H5z", "M8 11V7l2-2.5h4L16 7v4", "M12 14.5v2.5"]);
export const Unlock = sharp("Unlock", ["M5 11h14v9.5H5z", "M8 11V7l2-2.5h4L16 7", "M12 14.5v2.5"]);
export const Eye = sharp("Eye", ["M2.5 12L7 6.5h10l4.5 5.5L17 17.5H7z", "M10 10h4v4h-4z"]);
export const EyeOff = sharp("EyeOff", ["M2.5 12L7 6.5h10l4.5 5.5L17 17.5H7z", "M10 10h4v4h-4z", "M4 4l16 16"]);
export const Flag = sharp("Flag", ["M5.5 20.5V4", "M5.5 4.5H18l-3 4 3 4H5.5"]);
export const Loader2 = sharp("Loader2", ["M20 12a8 8 0 1 1-8-8"]);
export const Circle = sharp("Circle", [{ c: [12, 12, 8.5] }]);

/* ---- Product ---- */
export const Star = sharp("Star", ["M12 3.4L14.29 9.44L20.75 9.76L15.71 13.81L17.41 20.04L12 16.5L6.59 20.04L8.29 13.81L3.25 9.76L9.71 9.44Z"]);
export const Sparkle = sharp("Sparkle", ["M12 3.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z"]);
export const Sparkles = sharp("Sparkles", ["M10.5 5l1.75 5.25L17.5 12l-5.25 1.75L10.5 19l-1.75-5.25L3.5 12l5.25-1.75z", "M18 3v4.5", "M15.75 5.25h4.5"]);
export const Zap = sharp("Zap", ["M13.5 3L5.5 13.5h6L10.5 21l8-10.5h-6z"]);
export const Plug = sharp("Plug", ["M9 3.5v4.5", "M15 3.5v4.5", "M6 8h12v4l-3 4H9l-3-4z", "M12 16v4.5"]);
export const Store = sharp("Store", ["M3.5 9l1.5-4.5h14L20.5 9z", "M5 9v11h14V9", "M10 20v-5h4v5"]);
export const CreditCard = sharp("CreditCard", ["M3.5 5.5h17v13h-17z", "M3.5 9.5h17", "M6.5 15h4"]);
export const CircleDollarSign = sharp("CircleDollarSign", [{ c: [12, 12, 8.5] }, "M14.75 8.5h-5v3.5h4.5v3.5H9.25", "M12 6.5v2", "M12 15.5v2"]);
export const Globe = sharp("Globe", [{ c: [12, 12, 8.5] }, "M3.5 12h17", "M12 3.5L8 12l4 8.5 4-8.5z"]);
export const Gift = sharp("Gift", ["M4 9h16v4H4z", "M5.5 13v7h13v-7", "M12 9v11", "M12 9L9 5.5H6.5V9", "M12 9l3-3.5h2.5V9"]);
export const Rocket = sharp("Rocket", ["M12 3l4 5v8H8V8z", "M8 12l-3 3v4l3-2", "M16 12l3 3v4l-3-2", "M10.5 19.5h3", { sq: [11, 8.5, 2] }]);

/** Every ClimbOS Sharp icon, for the design system. */
export const SHARP_ICONS = {
  Plus, Minus, X, Check, Search, Download, Upload, Copy, Pencil, Trash2, ExternalLink, Link2, Send, LogOut, RefreshCw, Filter,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsUpDown, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Menu, MoreHorizontal, MoreVertical, PanelLeft, Home, LayoutGrid, Settings, SlidersHorizontal,
  UserRound, Users, MessageCircle, MessageSquareText, Mail, Inbox, Bell, Megaphone,
  Clock, CalendarDays, CalendarCheck, ChartLine, BarChart3, TrendingUp, Activity, Target,
  Info, CircleAlert, TriangleAlert, CircleCheck, CircleX, Lock, Unlock, Eye, EyeOff, Flag, Loader2, Circle,
  Star, Sparkle, Sparkles, Zap, Plug, Store, CreditCard, CircleDollarSign, Globe, Gift, Rocket,
};
