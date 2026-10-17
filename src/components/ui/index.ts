/**
 * ClimbOS design-system primitives. Import from "@/components/ui".
 * Files marked "use client" are interactive; the rest render on the server too.
 */
export { Button, IconButton, type ButtonProps, type IconButtonProps } from "./button";
export { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";
export { Spinner, type SpinnerProps } from "./spinner";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, type CardTitleProps } from "./card";
export { Badge, StatusPill, toneClasses, type BadgeProps, type StatusPillProps, type StatusKind, type Tone } from "./badge";
export { IconTile } from "./icon-tile";
export { SocialIcon, NetworkLabel, networkOf, networkName, type SocialIconProps, type SocialNetwork } from "./social-icon";
export {
  Field,
  Label,
  Input,
  controlClasses,
  type InputProps,
  Textarea,
  useFieldControl,
  type FieldProps,
  type LabelProps,
  type TextareaProps,
} from "./field";
export { Select, type SelectOption, type SelectProps } from "./select";
export { Checkbox, Switch, type CheckboxProps, type SwitchProps } from "./toggles";
export { RadioCards, type RadioCardOption, type RadioCardsProps } from "./radio-cards";
export { ChoiceChips, FilterChip, type ChoiceChip, type ChoiceChipsProps } from "./choice-chips";
export { Segmented, type SegmentedOption } from "./segmented";
export { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "./popover";
export { FileInput, type FileInputProps } from "./file-input";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogFooter,
  ConfirmDialog,
  Sheet,
  Sheet as Drawer,
  SheetClose,
  type DialogContentProps,
  type ConfirmDialogProps,
  type SheetProps,
} from "./dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tooltip,
  type DropdownMenuItemProps,
  type TooltipProps,
} from "./menu";
export { Progress, Meter, type ProgressProps, type MeterProps } from "./progress";
export {
  Skeleton,
  EmptyState,
  Callout,
  Alert,
  Stat,
  StatGroup,
  type EmptyStateProps,
  type CalloutProps,
  type CalloutTone,
  type StatProps,
} from "./feedback";
export { DataTable, type DataTableColumn, type DataTableProps } from "./data-table";
export { TableFrame, Table, THead, TBody, Tr, Th, Td, CellStack } from "./table";
export { Avatar, BackLink, Kbd, Separator, VisuallyHidden, type AvatarProps, type SeparatorProps } from "./misc";
export { Toaster, toast, dismissToast, type ToastItem, type ToastTone } from "./toast";
export { StepList, Stepper, type StepItem, type StepStatus } from "./stepper";
export {
  ChartFrame,
  ChartLegend,
  BarChart,
  LineChart,
  type ChartFrameProps,
  type ChartTable,
  type BarChartProps,
  type BarDatum,
  type LineChartProps,
  type LinePoint,
} from "./chart";
export {
  AreaChart,
  Sparkline,
  StatTrend,
  DonutChart,
  FunnelChart,
  BarList,
  Heatmap,
  ProgressRing,
  CHART_COLORS,
  compactNumber,
  type Series,
  type Segment,
  type FunnelStep,
  type BarListItem,
  type StatTrendProps,
} from "./viz";
