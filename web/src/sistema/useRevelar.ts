/**
 * Scroll reveal for the atlas pages: blocks below the fold fade and rise into place the first time
 * they enter the viewport. Blocks already on screen are never hidden, so nothing flashes on load.
 * Off with prefers-reduced-motion or without IntersectionObserver.
 */
import { useEffect } from "react";

const BLOQUES = [
  ".panel",
  ".reference-plate",
  ".atlas-referencia > div",
  ".atlas-lower > *",
  ".site-list li",
  ".record-columns",
  ".integridad",
  ".catalogue",
  ".filters",
  ".comparison-setup",
  ".notice",
].join(",");

export function useRevelar(clave: unknown) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.getElementById("main-content");
    if (!main) return;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          // Siblings that appear together cascade instead of popping at once.
          const hermanos = el.parentElement ? Array.from(el.parentElement.children) : [];
          const i = Math.max(0, hermanos.indexOf(el));
          el.style.setProperty("--revelar-retraso", `${Math.min(i, 8) * 55}ms`);
          el.dataset.visible = "1";
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    let pendiente = 0;
    // Blocks this run already watches. A block marked by an earlier run of the effect (React may run
    // it twice) but never shown is watched again, so nothing can stay hidden.
    const vistos = new WeakSet<Element>();
    const marcar = () => {
      pendiente = 0;
      const limite = window.innerHeight * 0.94;
      main.querySelectorAll<HTMLElement>(BLOQUES).forEach((el) => {
        if (el.dataset.visible || vistos.has(el)) return;
        vistos.add(el);
        el.dataset.revelar = "1";
        if (el.getBoundingClientRect().top < limite || el.closest("[data-revelar][data-visible] [data-revelar]")) {
          el.dataset.visible = "1";
          return;
        }
        io.observe(el);
      });
    };
    marcar();
    const mo = new MutationObserver(() => {
      if (!pendiente) pendiente = requestAnimationFrame(marcar);
    });
    mo.observe(main, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      if (pendiente) cancelAnimationFrame(pendiente);
      // Never leave a block hidden once nobody watches it.
      main.querySelectorAll<HTMLElement>("[data-revelar]:not([data-visible])").forEach((el) => (el.dataset.visible = "1"));
    };
  }, [clave]);
}
