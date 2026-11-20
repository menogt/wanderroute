import { CalendarDays, Compass, Map, WalletCards } from "lucide-react";

const panels = [
  ["places", "My Places", Compass], ["route", "My Route", Map],
  ["journey", "My Journey", CalendarDays], ["budget", "My Budget", WalletCards],
] as const;
export type StudioPanel = typeof panels[number][0];

export function StudioNavigation({ panel, select }: { panel: StudioPanel; select: (panel: StudioPanel) => void }) {
  return <nav className="wr-studio__nav" aria-label="Trip Studio views">
    {panels.map(([id, label, Icon]) => <button type="button" key={id} aria-pressed={panel === id} onClick={() => select(id)}>
      <Icon size={18} aria-hidden="true" />{label}</button>)}
  </nav>;
}
