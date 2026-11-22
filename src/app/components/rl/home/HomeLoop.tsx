import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";

export type LoopStop = {
  id: string;
  region: string;
  town: string;
  text: string;
  stay: string;
  /** Landmarks from MUST_SEE (name and town), added to the planner with one tap. */
  landmarks: { name: string; town: string }[];
  media: { kind: "video"; src: string; poster: string; label: string } | { kind: "photo"; base: string; alt: string };
  credit: { text: string; href?: string; license?: { name: string; href: string } };
};

const FAL = { name: "Free Art License", href: "https://artlibre.org/licence/lal/en/" };

/** The classic loop operators sell, in order. Facts match the planner's own stay rules and place data. */
export const LOOP_STOPS: LoopStop[] = [
  {
    id: "sigiriya", region: "The Cultural Triangle", town: "Sigiriya",
    text: "A fifth-century palace on top of a 180-metre rock, reached through the paws of a giant stone lion. Climb it early, then watch the sunset from Pidurangala next door.",
    stay: "1–2 nights", landmarks: [{ name: "Sigiriya Rock Fortress", town: "Sigiriya" }, { name: "Pidurangala Rock", town: "Sigiriya" }],
    media: { kind: "video", src: "/home/sigiriya.mp4", poster: "/home/sigiriya-poster.webp", label: "Visitors climbing past the lion's paws at Sigiriya in evening light" },
    credit: { text: "Film: Pexels", href: "https://www.pexels.com/video/aerial-view-of-sigiriya-rock-fortress-in-sri-lanka-36373731/" },
  },
  {
    id: "kandy", region: "The last royal capital", town: "Kandy",
    text: "A lake town in the hills, built around the Temple of the Sacred Tooth Relic. Come for the evening ceremony, stay for the botanical gardens at Peradeniya.",
    stay: "2 nights", landmarks: [{ name: "Temple of the Sacred Tooth Relic", town: "Kandy" }, { name: "Royal Botanical Gardens Peradeniya", town: "Kandy" }],
    media: { kind: "photo", base: "/home/kandy", alt: "The white walls and octagon of the Temple of the Sacred Tooth Relic above its moat in Kandy" },
    credit: { text: "Photo: A.Savin", href: "https://commons.wikimedia.org/wiki/File:SL_Kandy_asv2020-01_img34_Sacred_Tooth_Temple.jpg", license: FAL },
  },
  {
    id: "ella", region: "Tea country", town: "Ella",
    text: "Cool air, tea estates and the famous blue train from Kandy. Watch it cross the Nine Arches Bridge, then climb Little Adam's Peak for the view down the valley.",
    stay: "1–2 nights", landmarks: [{ name: "Nine Arches Bridge", town: "Ella" }, { name: "Little Adam's Peak", town: "Ella" }],
    media: { kind: "photo", base: "/home/demodara", alt: "A blue train curving through forest and tea towards a stone viaduct near Demodara, Ella" },
    credit: { text: "Photo: A.Savin", href: "https://commons.wikimedia.org/wiki/File:SL_Demodara_near_Ella_asv2020-01_img02.jpg", license: FAL },
  },
  {
    id: "mirissa", region: "The south coast", town: "Mirissa",
    text: "Palm-lined bays and blue whales offshore from about November to April. Galle's Dutch-era fort is about an hour along the coast.",
    stay: "2–3 nights", landmarks: [{ name: "Mirissa Beach", town: "Mirissa" }, { name: "Whale Watching Mirissa", town: "Mirissa" }, { name: "Galle Fort", town: "Galle" }],
    media: { kind: "video", src: "/home/mirissa.mp4", poster: "/home/mirissa-poster.webp", label: "Waves rolling onto the palm-lined sand of Mirissa Beach, seen from above" },
    credit: { text: "Film: Pexels", href: "https://www.pexels.com/video/aerial-view-of-mirissa-beach-in-sri-lanka-34100516/" },
  },
];

/** A muted loop that only plays while on screen (saves battery and data). */
function LoopVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setLoad(true); if (!still) element.play().catch(() => undefined); }
      else element.pause();
    }, { rootMargin: "200px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <video ref={ref} muted loop playsInline preload="none" poster={poster} src={load ? src : undefined} aria-label={label} />;
}

export function HomeLoop({ isAdded, onAdd }: { isAdded: (town: string, name: string) => boolean; onAdd: (stop: LoopStop) => void }) {
  return <section id="the-loop" className="wr-loop" aria-labelledby="wr-loop-title">
    <div className="wr-loop__intro">
      <h2 id="wr-loop-title">The classic loop, in four stops</h2>
      <p>Most first trips follow the same circle: ancient cities, the hill capital, tea country, then the beach. It's the route Sri Lankan operators sell, and the one WanderRoute plans first.</p>
    </div>
    <div className="wr-loop__track" data-progress>
    <div className="wr-loop__line" aria-hidden="true"><span /></div>
    <ol className="wr-loop__stops">
      {LOOP_STOPS.map((stop, index) => {
        const added = stop.landmarks.filter(place => isAdded(place.town, place.name)).length;
        const all = added === stop.landmarks.length;
        return <li key={stop.id} className={`wr-stop${index % 2 ? " is-flipped" : ""}`} data-stop aria-labelledby={`wr-stop-${stop.id}`}>
          <span className="wr-stop__pin" aria-hidden="true">{index + 1}</span>
          <figure className="wr-stop__media">
            <div className="wr-stop__frame" data-parallax="0.08">
              {stop.media.kind === "video"
                ? <LoopVideo src={stop.media.src} poster={stop.media.poster} label={stop.media.label} />
                : <img src={`${stop.media.base}-1000.webp`} srcSet={`${stop.media.base}-1000.webp 1000w, ${stop.media.base}-2000.webp 2000w`}
                  sizes="(min-width: 1024px) 58vw, 100vw" alt={stop.media.alt} loading="lazy" decoding="async" />}
            </div>
            <figcaption>{stop.credit.href ? <a href={stop.credit.href} target="_blank" rel="noopener noreferrer">{stop.credit.text}</a> : stop.credit.text}
              {stop.credit.license && <>, <a href={stop.credit.license.href} target="_blank" rel="noopener noreferrer">{stop.credit.license.name}</a></>}</figcaption>
          </figure>
          <div className="wr-stop__text">
            <p className="wr-stop__region">Stop {index + 1}: {stop.region}</p>
            <h3 id={`wr-stop-${stop.id}`}>{stop.town}</h3>
            <p>{stop.text}</p>
            <dl className="wr-stop__facts">
              <div><dt>Typical stay</dt><dd>{stop.stay}</dd></div>
              <div><dt>Don't miss</dt><dd>{stop.landmarks.map(place => place.name).join(", ")}</dd></div>
            </dl>
            <button type="button" className={`wr-stop__add${all ? " is-added" : ""}`} onClick={() => onAdd(stop)} aria-pressed={all}>
              {all ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
              {all ? `${stop.town} is in your trip` : `Add ${stop.town} to my trip`}
            </button>
          </div>
        </li>;
      })}
    </ol>
    </div>
  </section>;
}
