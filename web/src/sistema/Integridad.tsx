/**
 * Verification page: re-hash every published data file in the visitor's own browser and compare
 * it with manifest.json. WebCrypto SHA-256, nothing leaves the device. It is the same check as
 * `python -m motor.exportar.verificar`, so a judge can repeat it without installing anything.
 */
import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "../i18n/Language";
import { Marca } from "./Marca";

interface Entrada {
  archivo: string;
  bytes: number;
  sha256: string;
}
interface Falla {
  archivo: string;
  motivo: string;
}
interface Resultado {
  total: number;
  ok: number;
  bytes: number;
  ms: number;
  version: string;
  fallas: Falla[];
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function entradas(v: unknown): Entrada[] {
  if (typeof v !== "object" || v === null) return [];
  const lista = (v as { archivos?: unknown }).archivos;
  if (!Array.isArray(lista)) return [];
  return lista.filter(
    (a): a is Entrada =>
      typeof a === "object" && a !== null &&
      typeof (a as Entrada).archivo === "string" && /^[\w./-]+$/.test((a as Entrada).archivo) && !(a as Entrada).archivo.includes("..") &&
      typeof (a as Entrada).bytes === "number" && typeof (a as Entrada).sha256 === "string",
  );
}

export function Integridad() {
  const { t, language } = useLanguage();
  const [estado, setEstado] = useState<"quieto" | "corriendo" | "listo" | "sin-webcrypto" | "error">("quieto");
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0, archivo: "" });
  const [res, setRes] = useState<Resultado>();
  const cancelado = useRef(false);
  const num = (v: number, d = 0) => v.toLocaleString(language, { maximumFractionDigits: d });

  const correr = async () => {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      setEstado("sin-webcrypto");
      return;
    }
    cancelado.current = false;
    setEstado("corriendo");
    setRes(undefined);
    const t0 = performance.now();
    // The query string skips the offline cache and the HTTP cache: the check must read what the server holds now.
    const marca = `integridad=${Date.now()}`;
    try {
      const r = await fetch(`/data/manifest.json?${marca}`, { cache: "no-store" });
      if (!r.ok) throw new Error("manifest");
      const m: unknown = await r.json();
      const lista = entradas(m);
      const version = String((m as { version?: unknown }).version ?? "—");
      const fallas: Falla[] = [];
      let ok = 0;
      let bytes = 0;
      setProgreso({ hecho: 0, total: lista.length, archivo: "" });
      for (let i = 0; i < lista.length; i++) {
        if (cancelado.current) return;
        const e = lista[i];
        setProgreso({ hecho: i, total: lista.length, archivo: e.archivo });
        try {
          const f = await fetch(`/data/${e.archivo}?${marca}`, { cache: "no-store" });
          if (!f.ok) {
            fallas.push({ archivo: e.archivo, motivo: t(`HTTP ${f.status}`, `HTTP ${f.status}`) });
            continue;
          }
          const buf = await f.arrayBuffer();
          bytes += buf.byteLength;
          if (buf.byteLength !== e.bytes) {
            fallas.push({ archivo: e.archivo, motivo: t(`${buf.byteLength} bytes served, ${e.bytes} in the manifest`, `${buf.byteLength} bytes servidos, ${e.bytes} en el manifiesto`) });
            continue;
          }
          const h = await sha256(buf);
          if (h !== e.sha256) fallas.push({ archivo: e.archivo, motivo: t("SHA-256 differs", "El SHA-256 no coincide") });
          else ok++;
        } catch {
          fallas.push({ archivo: e.archivo, motivo: t("could not be read", "no se pudo leer") });
        }
      }
      setProgreso({ hecho: lista.length, total: lista.length, archivo: "" });
      setRes({ total: lista.length, ok, bytes, ms: Math.round(performance.now() - t0), version, fallas });
      setEstado("listo");
    } catch {
      setEstado("error");
    }
  };

  const todoBien = res && res.fallas.length === 0 && res.total > 0;
  return (
    <section className="panel integridad" aria-labelledby="integridad-titulo">
      <h2 id="integridad-titulo">{t("Verify the published files", "Verificar los archivos publicados")}</h2>
      <p>
        {t(
          "The manifest lists every data file with its size and SHA-256. This re-downloads each file and hashes it again here, in your browser: nothing is sent anywhere. It is the same check as python -m motor.exportar.verificar.",
          "El manifiesto lista cada archivo de datos con su tamaño y su SHA-256. Esto vuelve a descargar cada archivo y lo vuelve a resumir acá, en tu navegador: nada sale de tu equipo. Es la misma comprobación que python -m motor.exportar.verificar.",
        )}
      </p>
      <div className="actions">
        <button className="btn" onClick={correr} disabled={estado === "corriendo"}>
          <ShieldCheck aria-hidden="true" size={18} />
          {estado === "corriendo"
            ? t(`Checking ${progreso.hecho}/${progreso.total}…`, `Comprobando ${progreso.hecho}/${progreso.total}…`)
            : res
              ? t("Check again", "Volver a comprobar")
              : t("Check every file now", "Comprobar todos los archivos ahora")}
        </button>
        {estado === "corriendo" && (
          <button className="btn sec" onClick={() => { cancelado.current = true; setEstado("quieto"); }}>
            {t("Stop", "Detener")}
          </button>
        )}
      </div>
      {estado === "corriendo" && (
        <p className="mono muted" role="status" aria-live="polite">
          {progreso.archivo}
        </p>
      )}
      {estado === "sin-webcrypto" && (
        <p className="notice" role="alert">
          {t(
            "This browser does not expose WebCrypto on this address (it needs HTTPS or localhost). Run the Python check instead.",
            "Este navegador no ofrece WebCrypto en esta dirección (hace falta HTTPS o localhost). Corré la comprobación en Python.",
          )}
        </p>
      )}
      {estado === "error" && (
        <p className="notice" role="alert">
          {t("The manifest could not be read. Check the connection and retry.", "No se pudo leer el manifiesto. Revisá la conexión e intentá de nuevo.")}
        </p>
      )}
      {res && (
        <div role="status" aria-live="polite">
          <span className="verdict" data-tono={todoBien ? "sostenido" : "incompatible"}>
            <Marca tono={todoBien ? "pasa" : "falla"} />
            {todoBien
              ? t(`${num(res.ok)} of ${num(res.total)} files match`, `${num(res.ok)} de ${num(res.total)} archivos coinciden`)
              : t(`${num(res.fallas.length)} of ${num(res.total)} files do not match`, `${num(res.fallas.length)} de ${num(res.total)} archivos no coinciden`)}
          </span>
          <p className="muted">
            {t(
              `Dataset ${res.version} · ${num(res.bytes / 1e6, 1)} MB hashed in ${num(res.ms / 1000, 1)} s on this device.`,
              `Datos ${res.version} · ${num(res.bytes / 1e6, 1)} MB resumidos en ${num(res.ms / 1000, 1)} s en este equipo.`,
            )}
          </p>
          {res.fallas.length > 0 && (
            <ul>
              {res.fallas.map((f) => (
                <li key={f.archivo}>
                  <code>{f.archivo}</code> · {f.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
