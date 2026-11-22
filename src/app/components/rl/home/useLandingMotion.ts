import { useEffect, type RefObject } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll-linked motion for the landing page, in one rAF loop:
 * - [data-parallax="0.12"]: sets --py (px) so the element drifts against the scroll.
 * - [data-progress]: sets --progress (0..1) as the element passes the middle of the screen,
 *   and marks its [data-stop] children "is-reached" once the progress passes them.
 * - [data-hero]: sets --hero (0..1) over the first screen of scrolling.
 * With reduced motion nothing moves; progress lines are drawn in full.
 */
export function useLandingMotion(root: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = prefersReducedMotion();
    const progressItems = [...element.querySelectorAll<HTMLElement>("[data-progress]")];
    if (reduced) {
      progressItems.forEach(item => {
        item.style.setProperty("--progress", "1");
        item.querySelectorAll("[data-stop]").forEach(stop => stop.classList.add("is-reached"));
      });
      return;
    }
    const parallaxItems = [...element.querySelectorAll<HTMLElement>("[data-parallax]")];
    const hero = element.querySelector<HTMLElement>("[data-hero]");
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 800;
      for (const item of parallaxItems) {
        const rect = item.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) continue;
        const speed = Number(item.dataset.parallax) || 0.1;
        item.style.setProperty("--py", `${((rect.top + rect.height / 2 - vh / 2) * -speed).toFixed(1)}px`);
      }
      for (const item of progressItems) {
        const rect = item.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (vh * 0.55 - rect.top) / rect.height));
        item.style.setProperty("--progress", progress.toFixed(4));
        item.querySelectorAll<HTMLElement>("[data-stop]").forEach(stop => {
          const at = (stop.getBoundingClientRect().top - rect.top) / rect.height;
          stop.classList.toggle("is-reached", progress >= at);
        });
      }
      if (hero) hero.style.setProperty("--hero", Math.min(1, Math.max(0, window.scrollY / vh)).toFixed(4));
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [root]);
}
