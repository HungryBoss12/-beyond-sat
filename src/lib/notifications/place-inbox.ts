export type InboxAnchor = { right: number; bottom: number };
export type InboxViewport = { width: number; height: number };
export type InboxPlacement = { top: number; left: number; width: number; maxHeight: number };

const MARGIN = 8;
const MAX_WIDTH = 420;

/** Keep the dropdown inside the viewport. The bell sits left of the account menu, so aligning the panel to the bell with a fixed width clips the left edge on a phone. */
export function placeNotificationInbox(anchor: InboxAnchor, viewport: InboxViewport): InboxPlacement {
  const width = Math.min(MAX_WIDTH, Math.max(0, viewport.width - MARGIN * 2));
  let left = anchor.right - width;
  const maxLeft = viewport.width - MARGIN - width;
  if (left > maxLeft) left = maxLeft;
  if (left < MARGIN) left = MARGIN;
  const top = Math.max(MARGIN, anchor.bottom + MARGIN);
  const maxHeight = Math.max(120, viewport.height - top - MARGIN);
  return { top, left, width, maxHeight };
}
