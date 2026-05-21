/** Layout system — see docs/UI_LAYOUT_PLAN.md */

export type ContentTier = "catalog" | "reading" | "wide" | "full";

/** Max-width class per content tier (maps to @theme --width-*). */
export const tierMaxWidth: Record<ContentTier, string> = {
  catalog: "max-w-catalog",
  reading: "max-w-reading",
  wide: "max-w-wide",
  full: "",
};

/** Horizontal padding for app main column (header, toolbar, body). */
export const gutterPx = "px-gutter-app";

/** Vertical padding for scrollable page body. */
export const pagePy = "py-page";

/** Gap between major sections on a page. */
export const sectionGap = "gap-section";

/** Gap between list rows. */
export const listGap = "gap-list";

/** Section heading (catalog lists). */
export const sectionLabel = "section-label";

/** Reserved height for Topics create-panel slot (prevents list jump). */
export const createPanelSlot = "min-h-create-slot";
