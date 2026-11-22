import { useEffect, useRef, useState } from "react";
import { Landmark, Mountain, Sun, Waves } from "lucide-react";
import type { PlacePhoto as Photo } from "../../../lib/placePhotoCatalog";
import { queuedPlacePhoto } from "../../../lib/placePhotos";
import type { Coordinates } from "../../../lib/planningTypes";

const ICONS = { beach: Waves, temple: Landmark, attraction: Mountain, free: Sun } as const;

/** A place's photo, looked up only once the card scrolls near the screen; an icon when there is none. */
export function PlacePhoto({ name, city, category, coordinates, className }: {
  name: string; city: string; category?: string; coordinates?: Coordinates; className?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [photo, setPhoto] = useState<Photo | null>();
  useEffect(() => {
    let live = true;
    const element = root.current;
    if (!element) return;
    const load = () => queuedPlacePhoto(name, city, coordinates).then(found => { if (live) setPhoto(found); });
    if (typeof IntersectionObserver === "undefined") { load(); return () => { live = false; }; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: "300px" });
    observer.observe(element);
    return () => { live = false; observer.disconnect(); };
  }, [name, city, coordinates?.latitude, coordinates?.longitude]);
  const Icon = ICONS[(category ?? "attraction") as keyof typeof ICONS] ?? Mountain;
  return <span ref={root} className={`wr-photo ${className ?? ""}${photo === null ? " is-missing" : ""}`}>
    {photo ? <img src={photo.url} alt="" loading="lazy" decoding="async" /> : <Icon size={26} aria-hidden="true" />}
    {photo && <a className="wr-photo__credit" href={photo.page} target="_blank" rel="noreferrer"
      title={`Photo: ${photo.credit}, ${photo.licence}, Wikimedia Commons`}>© {photo.credit} · {photo.licence}</a>}
  </span>;
}
