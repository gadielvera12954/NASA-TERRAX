import { RefObject, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Motion layer of the shell (Nahum's area). Presentation only: it never touches a number,
 * it only reveals, guides and eases what the engine already exported.
 *
 * - Everything runs inside gsap.matchMedia(): with prefers-reduced-motion the callback does not
 *   run at all, so content is simply visible (same behavior as the CSS rule in mvp.css).
 * - Only transform and opacity are animated (composite-only, see animation-performance).
 * - clearProps hands the elements back to CSS when each tween ends.
 */
const REVEAL =
  ".mvp-main .two-grid > *, .mvp-main .atlas-lower > *, .mvp-main > .panel, " +
  ".mvp-main > .notice, .mvp-main .filters, .mvp-main .site-list li";

export function useMovimiento(
  root: RefObject<HTMLElement>,
  page: string,
  ready: boolean,
) {
  const introPlayed = useRef("");
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // 1. Page entrance: eyebrow, title and lead arrive in order.
      const firstTime = introPlayed.current !== page;
      introPlayed.current = page;
      const intro = firstTime ? el.querySelectorAll(
        ".page-title, .hero-copy > *, .mvp-main > .lead",
      ) : [];
      // Transform only: text never goes translucent, so contrast stays valid at every frame.
      gsap.from(intro, {
        y: 22,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.08,
        clearProps: "all",
      });

      // 2. Hero scene (3D) settles in from the right.
      const scene = el.querySelector(".atlas-hero > .reference-plate, .atlas-hero > :last-child");
      if (scene && firstTime)
        gsap.from(scene, {
          x: 36,
          duration: 0.9,
          delay: 0.2,
          ease: "power3.out",
          clearProps: "all",
        });

      // 3. Blocks reveal once, as they enter the viewport (the lab keeps its own 3D focus).
      if (page !== "lab") {
        const blocks = Array.from(el.querySelectorAll<HTMLElement>(REVEAL));
        gsap.set(blocks, { y: 36 });
        ScrollTrigger.batch(blocks, {
          start: "top 90%",
          once: true,
          interval: 0.1,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              duration: 0.6,
              ease: "power2.out",
              stagger: 0.1,
              overwrite: true,
              clearProps: "all",
            }),
        });
      }

      // 4. Meters (compatibility / evidence) fill from the exported value.
      gsap.utils.toArray<HTMLElement>(el.querySelectorAll(".medidor i")).forEach((bar) => {
        gsap.from(bar, {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.1,
          ease: "power3.out",
          delay: 0.3,
          scrollTrigger: { trigger: bar, start: "top 95%", once: true },
          clearProps: "transform",
        });
      });

      // 5. Reading progress bar tied to scroll.
      const progress = document.querySelector<HTMLElement>(".progreso-lectura i");
      if (progress)
        gsap.fromTo(
          progress,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
          },
        );
      ScrollTrigger.refresh();
    });
    return () => mm.revert();
    // `ready` re-runs the setup once the page data has rendered its blocks.
  }, [root, page, ready]);
}
