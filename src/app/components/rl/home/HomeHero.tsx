import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { prefersReducedMotion } from "./useLandingMotion";

/** The hero film is four Pexels clips cut together (see docs in CLAUDE.md); captions follow the cuts. */
const CLIPS = [
  { until: 5.2, place: "Nine Arches Bridge, Ella" },
  { until: 9.4, place: "Sigiriya Rock Fortress" },
  { until: 13.6, place: "Mirissa Beach" },
  { until: Infinity, place: "A railway through the forest" },
];

function useFilm() {
  const [phone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 767px), (max-aspect-ratio: 4/5)").matches);
  // Respect reduced motion and data saver: show the still frame until the visitor presses play.
  const [autoplay] = useState(() => {
    if (typeof window === "undefined" || prefersReducedMotion()) return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return !connection?.saveData;
  });
  return { phone, autoplay };
}

export function HomeHero({ children }: { children: ReactNode }) {
  const { phone, autoplay } = useFilm();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(autoplay);
  const [clip, setClip] = useState(0);

  useEffect(() => {
    const element = video.current;
    if (!element || !autoplay) return;
    element.play().catch(() => setPlaying(false));
  }, [autoplay]);

  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) { element.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
    else { element.pause(); setPlaying(false); }
  };

  return <header className="wr-landing-hero" data-hero>
    <div className="wr-landing-hero__film" aria-hidden="true">
      <video ref={video} className="wr-landing-hero__video" muted loop playsInline autoPlay={autoplay} preload={autoplay ? "auto" : "none"}
        poster={phone ? "/home/hero-poster-phone.webp" : "/home/hero-poster.webp"}
        src={phone ? "/home/hero-phone.mp4" : "/home/hero-1080.mp4"}
        onTimeUpdate={event => {
          const time = event.currentTarget.currentTime;
          const next = CLIPS.findIndex(entry => time < entry.until);
          if (next !== clip) setClip(next);
        }} />
    </div>
    <div className="wr-landing-hero__shade" aria-hidden="true" />
    {children}
    <div className="wr-landing-hero__film-bar">
      <p className="wr-landing-hero__caption" aria-live="off">
        <span className="wr-landing-hero__ticks" aria-hidden="true">{CLIPS.map((entry, index) => <i key={entry.place} className={index === clip ? "is-on" : ""} />)}</span>
        {CLIPS[clip].place}
      </p>
      <button type="button" className="wr-landing-hero__toggle" onClick={toggle} aria-label={playing ? "Pause the film" : "Play the film"}>
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
    </div>
  </header>;
}
