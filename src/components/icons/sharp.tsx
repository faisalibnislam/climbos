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
import type { Icon, IconProps } from "./types";

type Part = string | { c: [number, number, number] } | { sq: [number, number, number] } | { cd: [number, number, number] };

function draw(parts: Part[]): ReactNode {
  return parts.map((p, i) => {
    if (typeof p === "string") return <path key={i} d={p} />;
    if ("c" in p) return <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />;
    if ("cd" in p) return <circle key={i} cx={p.cd[0]} cy={p.cd[1]} r={p.cd[2]} strokeDasharray="3 2.35" strokeLinecap="butt" />;
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

/* ---- Text and layout ---- */
export const AlignLeft = sharp("AlignLeft", ["M4 6h16", "M4 10h10", "M4 14h16", "M4 18h10"]);
export const AlignCenter = sharp("AlignCenter", ["M4 6h16", "M7 10h10", "M4 14h16", "M7 18h10"]);
export const AlignRight = sharp("AlignRight", ["M4 6h16", "M10 10h10", "M4 14h16", "M10 18h10"]);
export const AlignHorizontalJustifyCenter = sharp("AlignHorizontalJustifyCenter", ["M12 3v18", "M6.5 6h11v4h-11z", "M8.5 14h7v4h-7z"]);
export const AlignVerticalJustifyCenter = sharp("AlignVerticalJustifyCenter", ["M3 12h18", "M6 6.5h4v11H6z", "M14 8.5h4v7h-4z"]);
export const Bold = sharp("Bold", ["M7 4.5h6.5L16 7v3l-2 2 2.5 2.5v3L14 20H7z", "M7 12h7"]);
export const Italic = sharp("Italic", ["M10 4.5h8", "M6 19.5h8", "M14.5 4.5l-5 15"]);
export const Underline = sharp("Underline", ["M7 4v7l2 3h6l2-3V4", "M5 20h14"]);
export const Type = sharp("Type", ["M5 7.5v-3h14v3", "M12 4.5v15", "M9 19.5h6"]);
export const CaseUpper = sharp("CaseUpper", ["M3 8V6h10v2", "M8 6v12", "M13.5 12v-1.5h7.5V12", "M17.25 10.5V18"]);
export const LayoutTemplate = sharp("LayoutTemplate", ["M3.5 4h17v16h-17z", "M3.5 9h17", "M10 9v11"]);
export const PanelsTopLeft = sharp("PanelsTopLeft", ["M3.5 4.5h17v15h-17z", "M3.5 9.5h17", "M9.5 9.5v10"]);
export const PanelLeftClose = sharp("PanelLeftClose", ["M3.5 4.5h17v15h-17z", "M9.5 4.5v15", "M16 9.5L13.5 12l2.5 2.5"]);
export const PanelLeftOpen = sharp("PanelLeftOpen", ["M3.5 4.5h17v15h-17z", "M9.5 4.5v15", "M13.5 9.5L16 12l-2.5 2.5"]);
export const Table2 = sharp("Table2", ["M3.5 4.5h17v15h-17z", "M3.5 9.5h17", "M3.5 14.5h17", "M10 4.5v15"]);
export const Layers = sharp("Layers", ["M12 4L3 8.5l9 4.5 9-4.5z", "M3 12.5l9 4.5 9-4.5", "M3 16.5l9 4.5 9-4.5"]);
export const Maximize2 = sharp("Maximize2", ["M14 4h6v6", "M10 20H4v-6", "M20 4l-6.5 6.5", "M4 20l6.5-6.5"]);

/* ---- Editing (design studio) ---- */
export const BringToFront = sharp("BringToFront", ["M4 4h9v9H4z", "M15 11h5v9h-9v-5"]);
export const SendToBack = sharp("SendToBack", ["M11 11h9v9h-9z", "M4 13V4h9v5"]);
export const Group = sharp("Group", ["M3.5 7V3.5H7", "M17 3.5h3.5V7", "M20.5 17v3.5H17", "M7 20.5H3.5V17", "M7 7h6v5H7z", "M11 12h6v5h-6z"]);
export const Ungroup = sharp("Ungroup", ["M4 4h8v7H4z", "M12 13h8v7h-8z"]);
export const FlipHorizontal2 = sharp("FlipHorizontal2", ["M12 3v18", "M9 7L3.5 17H9z", "M15 7l5.5 10H15z"]);
export const Palette = sharp("Palette", ["M12 3.5L18 6l2.5 5.5-2 3h-3.5L13.5 16l1.5 2.5-3 2L6 18l-2.5-6L6 6z", { sq: [7.5, 8, 2] }, { sq: [11, 6.25, 2] }, { sq: [14.5, 8, 2] }, { sq: [6.75, 12, 2] }]);
export const PenTool = sharp("PenTool", ["M12 3.5l6 8.5-3 7H9l-3-7z", "M12 3.5v7", "M8.5 20.5h7", { sq: [11, 10.5, 2] }]);
export const Shapes = sharp("Shapes", ["M7.5 3.5L12 11H3z", { c: [16.75, 7.25, 3.75] }, "M8.5 13.5H16V21H8.5z"]);
export const Wand2 = sharp("Wand2", ["M4 20L15.5 8.5", "M13.5 6.5l4 4", "M19 3v3", "M17.5 4.5h3", "M6.5 3.5V6", "M5.25 4.75h2.5", "M19.5 14v3", "M18 15.5h3"]);
export const Undo2 = sharp("Undo2", ["M4.5 9h11L19 12.5V16l-3.5 3.5H11", "M8.5 5L4.5 9l4 4"]);
export const Redo2 = sharp("Redo2", ["M19.5 9h-11L5 12.5V16l3.5 3.5H13", "M15.5 5l4 4-4 4"]);
export const RotateCcw = sharp("RotateCcw", ["M4 4.5V9h4.5", "M4.5 9L8 5h8l4 4v6l-4 4H8l-3-3"]);
export const Repeat2 = sharp("Repeat2", ["M4 11V8l2-2h13", "M16 3l3 3-3 3", "M20 13v3l-2 2H5", "M8 21l-3-3 3-3"]);

/* ---- Files and media ---- */
export const FileText = sharp("FileText", ["M14 3.5H5.5v17h13V8z", "M14 3.5V8h4.5", "M8.5 12h7", "M8.5 15h7", "M8.5 18h4"]);
export const FileCheck2 = sharp("FileCheck2", ["M14 3.5H5.5v17h13V8z", "M14 3.5V8h4.5", "M8.5 14l2.5 2.5 4.5-4.5"]);
export const FileSpreadsheet = sharp("FileSpreadsheet", ["M14 3.5H5.5v17h13V8z", "M14 3.5V8h4.5", "M8.5 11.5h7v6h-7z", "M12 11.5v6", "M8.5 14.5h7"]);
export const ClipboardList = sharp("ClipboardList", ["M6 5h12v15.5H6z", "M9 3.5h6v3H9z", "M9.5 10.5h5", "M9.5 13.5h5", "M9.5 16.5h3"]);
export const ClipboardPen = sharp("ClipboardPen", ["M13.5 20.5H6V5h12v5", "M9 3.5h6v3H9z", "M18.5 12l2 2-5 5h-2v-2z"]);
export const Archive = sharp("Archive", ["M3.5 4.5h17v4h-17z", "M5 8.5v11h14v-11", "M10 12h4"]);
export const ArchiveRestore = sharp("ArchiveRestore", ["M3.5 4.5h17v4h-17z", "M5 8.5v11h14v-11", "M12 18v-6", "M9.5 14.5L12 12l2.5 2.5"]);
export const Image = sharp("Image", ["M3.5 5h17v14h-17z", "M3.5 16.5l5-5.5 4 4.5 2.5-2.5 5.5 5", { sq: [14.5, 7.5, 2.5] }]);
export const ImageIcon = Image;
export const ImageDown = sharp("ImageDown", ["M13.5 5h-10v14h17v-5", "M3.5 16.5l5-5.5 4 4.5 2.5-2.5 5.5 5", "M18 3.5V10", "M15.5 7.5L18 10l2.5-2.5"]);
export const ImagePlus = sharp("ImagePlus", ["M13 5H3.5v14h17v-6.5", "M3.5 16.5l5-5.5 4 4.5 2.5-2.5 5.5 5", "M18 3v6", "M15 6h6"]);
export const Images = sharp("Images", ["M7 7h13.5v12H7z", "M3.5 16V3.5H17", "M7 17l3.5-4 3 3 2-2 5 4.5"]);
export const Clapperboard = sharp("Clapperboard", ["M3.5 5.5l16-2 .5 4-16 2z", "M8.5 4.9l2 3.6", "M13.5 4.3l2 3.6", "M4 9.5h16v10H4z"]);
export const Video = sharp("Video", ["M3.5 6h12v12h-12z", "M15.5 10l5-3v10l-5-3"]);
export const Mic = sharp("Mic", ["M9 3.5h6v10H9z", "M5.5 10.5v3L8 17h8l2.5-3.5v-3", "M12 17v3.5", "M9 20.5h6"]);
export const Play = sharp("Play", ["M7 4.5l12 7.5-12 7.5z"]);
export const Pause = sharp("Pause", ["M8 5v14", "M16 5v14"]);
export const SkipForward = sharp("SkipForward", ["M5 5l10 7-10 7z", "M19 5v14"]);
export const PlayCircle = sharp("PlayCircle", [{ c: [12, 12, 8.5] }, "M10 8.5l5.5 3.5-5.5 3.5z"]);
export const PauseCircle = sharp("PauseCircle", [{ c: [12, 12, 8.5] }, "M10 9v6", "M14 9v6"]);
export const CirclePause = PauseCircle;
export const QrCode = sharp("QrCode", ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", { sq: [6, 6, 2] }, { sq: [16, 6, 2] }, { sq: [6, 16, 2] }, { sq: [14, 14, 2] }, { sq: [18, 14, 2] }, { sq: [16, 16, 2] }, { sq: [14, 18, 2] }, { sq: [18, 18, 2] }]);
export const Printer = sharp("Printer", ["M7 9V3.5h10V9", "M6.5 17h-3V9h17v8h-3", "M7 14h10v6.5H7z"]);
export const Monitor = sharp("Monitor", ["M3 4.5h18v12H3z", "M8 20.5h8", "M12 16.5v4"]);
export const Smartphone = sharp("Smartphone", ["M7 2.5h10v19H7z", "M10.5 18.5h3"]);

/* ---- Status and shapes ---- */
export const Ban = sharp("Ban", [{ c: [12, 12, 8.5] }, "M6 6l12 12"]);
export const CircleSlash = sharp("CircleSlash", [{ c: [12, 12, 8.5] }, "M9 15l6-6"]);
export const CircleMinus = sharp("CircleMinus", [{ c: [12, 12, 8.5] }, "M8 12h8"]);
export const CircleDashed = sharp("CircleDashed", [{ cd: [12, 12, 8.5] }]);
export const CircleHelp = sharp("CircleHelp", [{ c: [12, 12, 8.5] }, "M9.5 9.5V8l1-1.5h3l1 1.5v2L12 12v1.5", { sq: [11.1, 15.6, 1.8] }]);
export const CircleQuestionMark = CircleHelp;
export const ShieldCheck = sharp("ShieldCheck", ["M12 3l8 3v6l-3 5-5 4-5-4-3-5V6z", "M8.5 12l2.5 2.5 4.5-4.5"]);
export const ShieldAlert = sharp("ShieldAlert", ["M12 3l8 3v6l-3 5-5 4-5-4-3-5V6z", "M12 8v5", { sq: [11.1, 15, 1.8] }]);
export const SearchX = sharp("SearchX", [{ c: [10.5, 10.5, 6.5] }, "M15.5 15.5l4.5 4.5", "M8.5 8.5l4 4", "M12.5 8.5l-4 4"]);
export const WifiOff = sharp("WifiOff", ["M3 9l3-2.5h12L21 9", "M6 12.5l2-1.5h8l2 1.5", "M9 16l1.5-1h3L15 16", { sq: [11, 18.5, 2] }, "M4 3.5l16 17"]);
export const Unplug = sharp("Unplug", ["M9 3.5v4", "M15 3.5v4", "M6 7.5h12v4l-3 4H9l-3-4z", "M12 15.5v5", "M4 4l16 16"]);
export const PlugZap = sharp("PlugZap", ["M8 3.5v4", "M14 3.5v4", "M5 7.5h12v4l-3 4H8l-3-4z", "M11 15.5v5", "M20.5 11l-2 3h2.5l-2 3.5"]);
export const Hourglass = sharp("Hourglass", ["M6 3.5h12", "M6 20.5h12", "M7.5 3.5v3L12 12l4.5-5.5v-3", "M7.5 20.5v-3L12 12l4.5 5.5v3"]);
export const Clock3 = sharp("Clock3", [{ c: [12, 12, 8.5] }, "M12 7v5h4.5"]);
export const Gauge = sharp("Gauge", ["M3.5 17a8.5 8.5 0 1 1 17 0", "M12 17l4-5", { sq: [11, 16, 2] }]);
export const Crosshair = sharp("Crosshair", [{ c: [12, 12, 8.5] }, "M12 2.5v5", "M12 16.5v5", "M2.5 12h5", "M16.5 12h5"]);
export const Compass = sharp("Compass", [{ c: [12, 12, 8.5] }, "M15.5 8.5l-2 5-5 2 2-5z"]);
export const BellRing = sharp("BellRing", ["M6 16.5v-5.5L8.5 5.5h7L18 11v5.5", "M4 16.5h16", "M10 20h4", "M3 9l2-3", "M21 9l-2-3"]);
export const TrendingDown = sharp("TrendingDown", ["M3.5 6.5l6 6 4-4 7 7.5", "M15 16h5.5v-5.5"]);
export const ArrowDownToLine = sharp("ArrowDownToLine", ["M12 4v11", "M7.5 10.5L12 15l4.5-4.5", "M5 19.5h14"]);
export const ArrowUpToLine = sharp("ArrowUpToLine", ["M12 20V9", "M7.5 13.5L12 9l4.5 4.5", "M5 4.5h14"]);
export const ListChecks = sharp("ListChecks", ["M3.5 6.5l2 2 3.5-3.5", "M3.5 15.5l2 2 3.5-3.5", "M12 7h8.5", "M12 16h8.5"]);

/* ---- People, messages and places ---- */
export const User = UserRound;
export const UserSearch = sharp("UserSearch", [{ c: [10, 7.5, 3.5] }, "M3.5 20v-2L6 15.5h5.5", { c: [17, 16, 2.75] }, "M19 18l2 2"]);
export const Contact = sharp("Contact", ["M3.5 5h17v14h-17z", { c: [9, 10.25, 2] }, "M5.75 16l1-1.5h4.5l1 1.5", "M15 10h3", "M15 13h3"]);
export const Headset = sharp("Headset", ["M4.5 14v-3.5L7.5 5h9l3 5.5V14", "M3.5 13h3.5v6H3.5z", "M17 13h3.5v6H17z", "M20.5 19l-2 2H14"]);
export const MailOpen = sharp("MailOpen", ["M3.5 10L12 4l8.5 6v10h-17z", "M3.5 10l8.5 6 8.5-6"]);
export const MessageSquareReply = sharp("MessageSquareReply", ["M4 4.5h16v11h-8.5L7 20v-4.5H4z", "M10.5 7L8 9.5l2.5 2.5", "M8 9.5h6.5l1.5 1.5v1.5"]);
export const AtSign = sharp("AtSign", ["M9.5 9h6.5v6H9.5z", "M16 15h2.5l1.5-1.5V8l-4-4H8L4 8v8l4 4h7.5"]);
export const Languages = sharp("Languages", ["M3.5 5h9", "M8 3.5V5", "M6 5l4 7", "M10.5 5L5 12.5", "M12.5 20.5l4-9 4 9", "M14 17h5"]);
export const Bot = sharp("Bot", ["M5 8h14v11H5z", "M12 4v4", "M10.5 4h3", { sq: [8.25, 11.5, 2] }, { sq: [13.75, 11.5, 2] }, "M9.5 16h5", "M3 12v3", "M21 12v3"]);
export const Building2 = sharp("Building2", ["M5 20.5V3.5h9v17", "M14 9h5v11.5", "M3 20.5h18", { sq: [7.25, 6.25, 1.5] }, { sq: [10.75, 6.25, 1.5] }, { sq: [7.25, 9.75, 1.5] }, { sq: [10.75, 9.75, 1.5] }, { sq: [7.25, 13.25, 1.5] }, { sq: [10.75, 13.25, 1.5] }, "M8.5 20.5v-3h2.5v3"]);
export const ShoppingBag = sharp("ShoppingBag", ["M4.5 7.5h15l-1 13h-13z", "M9 10V6l1.5-2.5h3L15 6v4"]);
export const Mountain = sharp("Mountain", ["M2.5 19.5L9 8l3.5 5.5L15 10l6.5 9.5z"]);
export const Plane = sharp("Plane", ["M21 3L3 11l7 2.5L12.5 21z", "M10 13.5L21 3"]);

/* ---- Money and business ---- */
export const Calculator = sharp("Calculator", ["M5 3.5h14v17H5z", "M8 7h8v3H8z", { sq: [7.75, 12.5, 2] }, { sq: [11, 12.5, 2] }, { sq: [14.25, 12.5, 2] }, { sq: [7.75, 16, 2] }, { sq: [11, 16, 2] }, { sq: [14.25, 16, 2] }]);
export const Wallet = sharp("Wallet", ["M3.5 6.5h15v13h-15z", "M3.5 6.5l12-3v3", "M14 10.5h6.5v5H14z", { sq: [15.75, 12.25, 1.5] }]);
export const Coins = sharp("Coins", [{ c: [9, 9, 5.5] }, "M14.5 9.4a5.5 5.5 0 1 1-5.1 5.1"]);
export const HandCoins = sharp("HandCoins", ["M3 15.5h3l3-2h5v2h-4", "M6 15.5v5", "M14 15.5l5-2.5 2 1.5-6 5.5H6", { c: [15.5, 6.5, 3] }]);
export const ReceiptText = sharp("ReceiptText", ["M5 3.5h14v17l-2.5-1.5-2.5 1.5-2-1.5-2 1.5-2.5-1.5L5 20.5z", "M8.5 8h7", "M8.5 11.5h7", "M8.5 15h4"]);
export const Scale = sharp("Scale", ["M12 4v16.5", "M8 20.5h8", "M4.5 6.5h15", "M2.5 14l3-7 3 7z", "M15.5 14l3-7 3 7z"]);
export const Tag = sharp("Tag", ["M3.5 3.5H12l8.5 8.5-8.5 8.5L3.5 12z", { sq: [6.5, 6.5, 2] }]);
export const Bookmark = sharp("Bookmark", ["M6 3.5h12v17l-6-4.5-6 4.5z"]);
export const Crown = sharp("Crown", ["M4.5 18.5L3.5 7.5l5 4.5L12 5l3.5 7 5-4.5-1 11z"]);
export const Gem = sharp("Gem", ["M7 4.5h10l3.5 5L12 20 3.5 9.5z", "M3.5 9.5h17", "M9.5 4.5L8 9.5l4 10.5 4-10.5-1.5-5"]);
export const KeyRound = sharp("KeyRound", ["M3.5 12.5h7v7h-7z", "M10.5 16h10", "M17 16v3", "M19.5 16v2.5"]);
export const Lightbulb = sharp("Lightbulb", ["M9 17v-3.5L6 10V7l3-3.5h6L18 7v3l-3 3.5V17z", "M9.5 20.5h5", "M9 17h6"]);
export const FlaskConical = sharp("FlaskConical", ["M9.5 3.5v6l-5 10.5h15l-5-10.5v-6", "M8 3.5h8", "M7 15h10"]);
export const Heart = sharp("Heart", ["M12 20.5L3.5 12V7.5l3-3h3L12 7l2.5-2.5h3l3 3V12z"]);
export const HeartHandshake = sharp("HeartHandshake", ["M12 20.5L3.5 12V7.5l3-3h3L12 7l2.5-2.5h3l3 3V12z", "M12 7L8.5 10.5l2 2 3-3 3 3"]);
export const Hand = sharp("Hand", ["M8 14V6h2v5V4h2v7V5h2v6V7h2v8l-2.5 5.5h-5L5 16l1.5-1.5L8 16"]);
export const Calendar = sharp("Calendar", ["M4 6h16v14H4z", "M4 10h16", "M8 3.5v4", "M16 3.5v4"]);
export const CalendarPlus = sharp("CalendarPlus", ["M4 6h16v14H4z", "M4 10h16", "M8 3.5v4", "M16 3.5v4", "M12 12.5v5", "M9.5 15h5"]);
export const CalendarClock = sharp("CalendarClock", ["M20 9.5V6H4v14h6.5", "M4 10h6", "M8 3.5v4", "M16 3.5v4", { c: [16.5, 16.5, 4] }, "M16.5 14.5v2h1.5"]);
export const BookOpenCheck = sharp("BookOpenCheck", ["M12 6.5v13", "M12 6.5L9.5 4.5h-6v13h6l2.5 2", "M12 6.5l2.5-2h6v13h-6L12 19.5", "M14.5 11l1.5 1.5 3-3"]);
export const Share2 = sharp("Share2", ["M15 3.5h4.5V8H15z", "M4 9.75h4.5v4.5H4z", "M15 16h4.5v4.5H15z", "M8.5 11l6.5-4", "M8.5 13l6.5 4"]);
export const Webhook = sharp("Webhook", ["M10 3.5h4v4h-4z", "M3.5 15.5h4v4h-4z", "M16.5 15.5h4v4h-4z", "M11 7.5l-4.5 8", "M13 7.5l4.5 8", "M7.5 17.5h9"]);
export const Workflow = sharp("Workflow", ["M3.5 4h6v6h-6z", "M14.5 14h6v6h-6z", "M6.5 10v7h8"]);
export const MousePointerClick = sharp("MousePointerClick", ["M9 9l11 3.5-4.5 1.5 4 4-1.5 1.5-4-4L12.5 20z", "M7 3.5V6", "M3.5 7H6", "M4.5 4.5l1.75 1.75"]);

/** Every ClimbOS Sharp icon, for the design system. */
/* ---- Added for the design system (2026-10-19) ---- */
export const GripVertical = sharp("GripVertical", [{ sq: [8, 4.5, 2] }, { sq: [14, 4.5, 2] }, { sq: [8, 11, 2] }, { sq: [14, 11, 2] }, { sq: [8, 17.5, 2] }, { sq: [14, 17.5, 2] }]);
export const Folder = sharp("Folder", ["M3.5 5h6l2 2.5h9v11.5h-17z"]);
export const Columns3 = sharp("Columns3", ["M3.5 4.5h17v15h-17z", "M9.5 4.5v15", "M14.5 4.5v15"]);
export const Columns = Columns3;
export const Smile = sharp("Smile", [{ c: [12, 12, 8.5] }, "M8.5 14.5l1.5 1.5h4l1.5-1.5", { sq: [8.5, 8.5, 2] }, { sq: [13.5, 8.5, 2] }]);
export const UserPlus = sharp("UserPlus", [{ c: [9.5, 8, 3.75] }, "M3 20.5v-2.5L6 15h7l3 3v2.5", "M18.5 8.5v5", "M16 11h5"]);
export const History = sharp("History", ["M4 4.5V9h4.5", "M4.5 9L8 5h8l4 4v6l-4 4H8l-3-3", "M12 8.5v4l2.5 1.5"]);
export const Keyboard = sharp("Keyboard", ["M3 6.5h18v11H3z", { sq: [5.75, 9, 1.5] }, { sq: [9.25, 9, 1.5] }, { sq: [12.75, 9, 1.5] }, { sq: [16.25, 9, 1.5] }, { sq: [5.75, 12, 1.5] }, { sq: [16.25, 12, 1.5] }, "M8.5 14.75h7"]);

export const Moon = sharp("Moon", ["M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"]);
export const Sun = sharp("Sun", [{ c: [12, 12, 4] }, "M12 3v2", "M12 19v2", "M3 12h2", "M19 12h2", "M5.6 5.6L7 7", "M17 17l1.4 1.4", "M5.6 18.4L7 17", "M17 7l1.4-1.4"]);
export const Paperclip = sharp("Paperclip", ["M16 8v9l-2.5 2.5h-3L8 17V5.5L9.5 4h3L14 5.5V16l-1 1h-2l-1-1V8"]);
export const Square = sharp("Square", ["M5.5 5.5h13v13h-13z"]);
export const ThumbsUp = sharp("ThumbsUp", ["M3.5 10.5h4v9h-4z", "M7.5 10.5L11 4h1.5l1 1.5-1 4h7l1 1.5-2 8.5h-11"]);
export const ThumbsDown = sharp("ThumbsDown", ["M3.5 4.5h4v9h-4z", "M7.5 13.5L11 20h1.5l1-1.5-1-4h7l1-1.5-2-8.5h-11"]);
export const CornerDownLeft = sharp("CornerDownLeft", ["M19.5 4.5v9h-15", "M8.5 9.5l-4 4 4 4"]);
export const Command = sharp("Command", ["M9 9h6v6H9z", "M9 9V6H6v3h3", "M15 9V6h3v3h-3", "M9 15v3H6v-3h3", "M15 15v3h3v-3h-3"]);
export const Grid3x3 = sharp("Grid3x3", ["M3.5 3.5h17v17h-17z", "M9.5 3.5v17", "M14.5 3.5v17", "M3.5 9.5h17", "M3.5 14.5h17"]);

export const List = sharp("List", ["M8.5 6h12", "M8.5 12h12", "M8.5 18h12", { sq: [3.5, 5, 2] }, { sq: [3.5, 11, 2] }, { sq: [3.5, 17, 2] }]);
export const ListOrdered = sharp("ListOrdered", ["M10 6h10.5", "M10 12h10.5", "M10 18h10.5", "M4 3.5h1.5v5", "M3.5 10.5h3v2.5h-3v2.5h3", "M3.5 16.5h3v5h-3", "M4.5 19h2"]);
export const Code = sharp("Code", ["M8 7l-5 5 5 5", "M16 7l5 5-5 5"]);
export const Heading = sharp("Heading", ["M6 4.5v15", "M18 4.5v15", "M6 12h12"]);
export const Strikethrough = sharp("Strikethrough", ["M4 12h16", "M17 7.5V5.5H8.5L6.5 7.5v2l1.5 1.5", "M7 16.5v2h9l2-2v-2.5"]);
export const Phone = sharp("Phone", ["M5 3.5h4l1.5 4.5L8 9.5a11 11 0 0 0 6.5 6.5l1.5-2.5 4.5 1.5v4L19 20.5C11 20.5 3.5 13 3.5 5z"]);

export const ZoomIn = sharp("ZoomIn", [{ c: [10.5, 10.5, 6.5] }, "M15.5 15.5l5 5", "M10.5 8v5", "M8 10.5h5"]);
export const ZoomOut = sharp("ZoomOut", [{ c: [10.5, 10.5, 6.5] }, "M15.5 15.5l5 5", "M8 10.5h5"]);

/** AI action ("make it happen"): a pointer with two sparkles. */
export const Magic = sharp("Magic", ["M8 9.5l12.5 4.5-5.5 2-2 5.5z", "M15.5 2.75l.75 2 2 .75-2 .75-.75 2-.75-2-2-.75 2-.75z", "M5.5 6v3.5", "M3.75 7.75h3.5"]);
export const WandSparkles = Magic;

/** New conversation: a speech bubble with a plus. */
export const MessageSquarePlus = sharp("MessageSquarePlus", ["M3.5 4.5h17v12h-9l-4.5 3.5v-3.5h-3.5z", "M12 7.5v6", "M9 10.5h6"]);

export const SHARP_ICONS = {
  Plus, Minus, X, Check, Search, Download, Upload, Copy, Pencil, Trash2, ExternalLink, Link2, Send, LogOut, RefreshCw, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsUpDown, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Menu, MoreHorizontal, Ellipsis, MoreVertical, PanelLeft, Home, LayoutGrid, Settings, Cog, SlidersHorizontal, Settings2, UserRound, Users, UsersRound, MessageCircle, MessageSquare, MessageSquareText, Mail, Inbox, Bell, Megaphone, Clock, CalendarDays, CalendarCheck, ChartLine, BarChart3, TrendingUp, Activity, Target, Info, CircleAlert, TriangleAlert, CircleCheck, CheckCircle2, CircleX, Lock, Unlock, Eye, EyeOff, Flag, Loader2, Circle, Star, Sparkle, Sparkles, Zap, Plug, Store, CreditCard, CircleDollarSign, Globe, Gift, Rocket, AlignLeft, AlignCenter, AlignRight, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Bold, Italic, Underline, Type, CaseUpper, LayoutTemplate, PanelsTopLeft, PanelLeftClose, PanelLeftOpen, Table2, Layers, Maximize2, BringToFront, SendToBack, Group, Ungroup, FlipHorizontal2, Palette, PenTool, Shapes, Wand2, Undo2, Redo2, RotateCcw, Repeat2, FileText, FileCheck2, FileSpreadsheet, ClipboardList, ClipboardPen, Archive, ArchiveRestore, Image, ImageIcon, ImageDown, ImagePlus, Images, Clapperboard, Video, Mic, Play, Pause, SkipForward, PlayCircle, PauseCircle, CirclePause, QrCode, Printer, Monitor, Smartphone, Ban, CircleSlash, CircleMinus, CircleDashed, CircleHelp, CircleQuestionMark, ShieldCheck, ShieldAlert, SearchX, WifiOff, Unplug, PlugZap, Hourglass, Clock3, Gauge, Crosshair, Compass, BellRing, TrendingDown, ArrowDownToLine, ArrowUpToLine, ListChecks, User, UserSearch, Contact, Headset, MailOpen, MessageSquareReply, AtSign, Languages, Bot, Building2, ShoppingBag, Mountain, Plane, Calculator, Wallet, Coins, HandCoins, ReceiptText, Scale, Tag, Bookmark, Crown, Gem, KeyRound, Lightbulb, FlaskConical, Heart, HeartHandshake, Hand, Calendar, CalendarPlus, CalendarClock, BookOpenCheck, Share2, Webhook, Workflow, MousePointerClick, GripVertical, Folder, Columns3, Smile, UserPlus, History, Keyboard, Moon, Sun, Paperclip, Square, ThumbsUp, ThumbsDown, CornerDownLeft, Command, Grid3x3, List, ListOrdered, Code, Heading, Strikethrough, Phone, ZoomIn, ZoomOut, Magic, MessageSquarePlus,
};
