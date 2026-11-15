/** A number that settles into place: tweens from 0 to its value once (700 ms, ease-out), still under reduced motion. */
import { useEffect, useState } from "react";

export function Contador({ valor, formato, ms = 700 }: { valor: number; formato: (v: number) => string; ms?: number }) {
  const [v, setV] = useState(() => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? valor : 0));
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(valor);
      return;
    }
    const inicio = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const k = Math.min(1, (ahora - inicio) / ms);
      setV(valor * (1 - Math.pow(1 - k, 3)));
      if (k < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor, ms]);
  return <>{formato(v)}</>;
}
