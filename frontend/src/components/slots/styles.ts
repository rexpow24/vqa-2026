// Shared button looks of the labelling page, used by the text form
// (HostedLabeling.tsx) and the slot form (components/slots/). Annotators found
// the page washed out: unselected buttons were muted text on a near-invisible
// border. Every button now has a fill, a border that reads against the card,
// a hover and a keyboard focus ring.
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const BTN_BASE = `rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;
export const NEUTRAL = "border-border-strong bg-surface-2 text-foreground";
export const BTN = `${BTN_BASE} ${NEUTRAL} hover:border-muted hover:bg-surface-3
  disabled:hover:border-border-strong disabled:hover:bg-surface-2`;
