import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LanguageProvider, useLanguage } from "../i18n/Language";
import { Ficha, Manifest } from "../datos/contract";
import {
  readManifest,
  readFicha,
  readIndex,
  IndexEntry,
} from "../datos/integration";
import { ScientificData } from "./ScientificData";
import { SolProvider, useSol } from "../luz/SolContext";
import { EstadoMotor, estadoMotor } from "../datos/laboratorio";
import DosMundos from "../pantallas/operacion/DosMundos";
import Comparador from "../pantallas/operacion/Comparador";
import SombraCampo from "../pantallas/field/SombraCampo";
import "./mvp.css";
import "./lab.css";

// The 3D screens (three.js + Blender models) load only when they are opened.
const Laboratorio = lazy(() => import("../pantallas/operacion/Laboratorio"));
const HeroTerreno = lazy(() => import("../pantallas/operacion/HeroTerreno"));

type Page =
  | "home"
  | "explore"
  | "card"
  | "compare"
  | "lab"
  | "checks"
  | "guide";
const pages: Page[] = [
  "home",
  "explore",
  "card",
  "compare",
  "lab",
  "checks",
  "guide",
];
const tourPages: Page[] = [
  "home",
  "explore",
  "card",
  "compare",
  "checks",
  "guide",
];
function currentPage(): Page {
  const p = location.hash.slice(1) as Page;
  return pages.includes(p) ? p : "home";
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AppContent() {
  const { language, setLanguage, t } = useLanguage();
  const [page, setPage] = useState<Page>(currentPage);
  const [manifest, setManifest] = useState<Manifest>();
  const [ficha, setFicha] = useState<Ficha>();
  const [candidateId, setCandidateId] = useState(
    () => new URLSearchParams(location.search).get("candidate") || "P-07",
  );
  const [candidateIndex, setCandidateIndex] = useState<IndexEntry[]>([]);
  useEffect(() => {
    let active = true;
    readIndex()
      .then((v) => {
        if (active) setCandidateIndex(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  // Live physics engine (servidor/). null = not reachable: the app uses the exported files.
  const [motor, setMotor] = useState<EstadoMotor | null>(null);
  useEffect(() => {
    let active = true;
    const check = () =>
      estadoMotor().then((e) => {
        if (active) setMotor(e);
      });
    check();
    const timer = window.setInterval(check, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  const [query, setQuery] = useState("");
  const [operation, setOperation] = useState("shadow");
  const [tour, setTour] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(15);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstPage = useRef(true);
  useEffect(() => {
    const change = () => {
      const next = currentPage();
      setPage(next);
      setTour((step) =>
        step !== null && tourPages[step] !== next ? null : step,
      );
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    Promise.all([readManifest(), readFicha(candidateId)])
      .then(([m, f]) => {
        if (active) {
          setManifest(m);
          setFicha(f);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [attempt, candidateId]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const message = (event: MessageEvent) => {
      if (event.data === "OFFLINE_READY") setOfflineReady(true);
    };
    navigator.serviceWorker?.addEventListener("message", message);
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          reg.active?.postMessage("CHECK_READY");
        })
        .catch(() => setOfflineReady(false));
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, []);
  const go = (next: Page) => {
    setTour(null);
    location.hash = next;
  };
  const tourNotes = [
    t(
      "The goal: find useful practice conditions on Earth, while acknowledging the differences.",
      "El objetivo: encontrar condiciones útiles para practicar en la Tierra y reconocer sus diferencias.",
    ),
    t(
      "Choose a practice goal and discover the available example candidate.",
      "Elige un objetivo de ensayo y descubre la candidata de ejemplo disponible.",
    ),
    t(
      "Read compatibility and evidence separately, then check the limits.",
      "Lee compatibilidad y evidencia por separado; después revisa los límites.",
    ),
    t(
      "Compare the two environments. Move the Sun to see how panel shadows change.",
      "Compara los dos entornos. Mueve el Sol para ver cómo cambian las sombras de los paneles.",
    ),
    t(
      "Verify what supports each claim. Missing results are explicitly marked.",
      "Comprueba qué respalda cada afirmación. Los resultados faltantes se indican expresamente.",
    ),
    t(
      "Review the guide and explore at your own pace. The demonstration is complete.",
      "Revisa la guía y explora a tu ritmo. La demostración está completa.",
    ),
  ];
  useEffect(() => {
    if (tour === null || paused) return;
    const timer = window.setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, [tour, paused]);
  useEffect(() => {
    if (remaining > 0 || tour === null) return;
    if (tour === tourPages.length - 1) {
      setTour(null);
      return;
    }
    const next = tour + 1;
    setTour(next);
    setRemaining(15);
    location.hash = tourPages[next];
  }, [remaining, tour]);
  const titles = {
    home: t(
      "Practice on Earth. Prepare for the Moon.",
      "Ensaya en la Tierra. Prepárate para la Luna.",
    ),
    explore: t("Find a place to practice.", "Encuentra un lugar para ensayar."),
    card:
      ficha?.etiqueta === "incompatible"
        ? t(
            "This candidate does not meet the requirements.",
            "Esta candidata no cumple los requisitos.",
          )
        : t(
            "A promising place, with limits.",
            "Un lugar prometedor, con límites.",
          ),
    compare: t(
      "Two worlds. Different limits.",
      "Dos mundos. Diferentes límites.",
    ),
    lab: t(
      "Park the rover. Survive the night.",
      "Estaciona el rover. Sobrevive la noche.",
    ),
    checks: t("See what is verified.", "Conoce qué está verificado."),
    guide: t(
      "Start here. No expertise needed.",
      "Empieza aquí. No necesitas ser especialista.",
    ),
  };
  const nav = [
    { page: "home" as Page, label: t("Home", "Inicio") },
    { page: "explore" as Page, label: t("Explore", "Explorar") },
    { page: "lab" as Page, label: t("3D lab", "Laboratorio 3D") },
    { page: "checks" as Page, label: t("Verification", "Verificación") },
    { page: "guide" as Page, label: t("Guide", "Guía") },
  ];
  const mock = manifest?.maqueta || ficha?.maqueta;
  // Minutes of the Earth rehearsal window (Sun from 7° to 1.5°), from the open card.
  const earthWindowMinutes = (() => {
    const w = ficha?.horario[0];
    if (!w) return null;
    const [h1, m1] = w.desde.split(":").map(Number);
    const [h2, m2] = w.hasta.split(":").map(Number);
    const minutes = h2 * 60 + m2 - (h1 * 60 + m1);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  })();
  const matches =
    ficha &&
    `${ficha.id} ${ficha.lugar.region} ${ficha.lugar.nombre}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  const number = (value: number | null) =>
    value === null
      ? t("Unknown", "Desconocido")
      : new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(
          value,
        );
  const dimensionNames: Record<string, string> = {
    relieve: t("Terrain", "Relieve"),
    iluminacion: t("Light and shadows", "Luz y sombras"),
    materiales: t("Materials", "Materiales"),
    temperatura: t("Temperature", "Temperatura"),
    agua_hielo: t("Water and ice", "Agua y hielo"),
    polvo_viento: t("Dust and wind", "Polvo y viento"),
    biologia: t("Biology", "Biología"),
    operaciones_roboticas: t("Robotic operations", "Operaciones robóticas"),
  };
  const stateNames: Record<string, string> = {
    Strong: t("Strong", "Fuerte"),
    Weak: t("Weak", "Débil"),
    Unknown: t("Unknown", "Desconocido"),
    "Not comparable": t("Not comparable", "No comparable"),
  };
  const verdicts: Record<string, string> = {
    con_huecos: t("◐ With gaps", "◐ Con vacíos de información"),
    sostenido: t("● Supported", "● Respaldado"),
    no_alcanza: t("○ Insufficient", "○ Insuficiente"),
    no_puede: t("? Unknown", "? Desconocido"),
    incompatible: t("× Incompatible", "× Incompatible"),
  };
  const translations: Record<string, string> = {
    "Shadow contrast": "Contraste de sombras",
    Gravity: "Gravedad",
    Vacuum: "Vacío",
    Radiation: "Radiación",
    Dust: "Polvo",
    "Time scales": "Escalas de tiempo",
    "Surface material composition; Fine-scale traversability":
      "Composición del material superficial; transitabilidad a pequeña escala",
    "This candidate does not meet the requirements.":
      "Esta candidata no cumple los requisitos.",
    "The available evidence supports this candidate within the model limits.":
      "La evidencia disponible respalda esta candidata dentro de los límites del modelo.",
    "Read the evidence and remaining uncertainties before choosing this candidate.":
      "Revisa la evidencia y las incertidumbres pendientes antes de elegir esta candidata.",
    "Solar power profile": "Perfil de generación solar",
    "Vacuum & sharp shadow contrast": "Vacío y contraste de sombras",
    "Lunar gravity (1/6 g)": "Gravedad lunar (1/6 g)",
    "Electrostatic regolith dust": "Polvo de regolito electrostático",
    "Surface material composition, then rock distribution.":
      "Composición del material superficial y luego distribución de las rocas.",
    "Fits what we know. Measuring the surface material could change first place.":
      "Encaja con lo que sabemos. Medir el material superficial podría cambiar su posición en la selección.",
  };
  const dataText = (text: string) =>
    language === "es" ? (translations[text] ?? text) : text;
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          heading.current?.focus();
        }}
      >
        {t("Skip to content", "Saltar al contenido")}
      </a>
      <header className="mvp-header">
        <a
          className="brand"
          href="#home"
          onClick={() => setTour(null)}
          aria-label={t("TERRA-X home", "Inicio de TERRA-X")}
        >
          <span className="brand-mark" aria-hidden="true" />
          TERRA-X
        </a>
        <nav aria-label={t("Main navigation", "Navegación principal")}>
          {nav.map((n) => (
            <a
              key={n.page}
              href={`#${n.page}`}
              onClick={() => setTour(null)}
              aria-current={
                page === n.page ||
                ((page === "card" || page === "compare") &&
                  n.page === "explore")
                  ? "page"
                  : undefined
              }
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div
          className="language"
          role="group"
          aria-label={t("Language", "Idioma")}
        >
          <button
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
            lang="en"
          >
            English
          </button>
          <button
            aria-pressed={language === "es"}
            onClick={() => setLanguage("es")}
            lang="es"
          >
            Español
          </button>
        </div>
      </header>
      <div className="connection" role="status">
        {online ? t("Online", "Con conexión") : t("Offline", "Sin conexión")} ·{" "}
        {offlineReady
          ? t("Saved for offline use", "Guardado para usar sin conexión")
          : t(
              "Offline copy not ready yet",
              "Copia sin conexión aún no preparada",
            )}
        <span className={motor ? "luz vivo" : "luz"} aria-hidden="true" />
        {motor
          ? t("Live engine connected", "Motor en vivo conectado")
          : t(
              "Live engine off · using exported data",
              "Motor en vivo apagado · se usan los datos exportados",
            )}
      </div>
      {mock && (
        <aside className="mock-notice">
          <strong>
            {t("MOCK DATA · Demonstration", "DATOS DE MAQUETA · Demostración")}
          </strong>
          <span>
            {t(
              "Example values, not validated scientific results. Do not use for mission planning.",
              "Valores de ejemplo, no resultados científicos validados. No usar para planificar misiones.",
            )}
          </span>
        </aside>
      )}
      {tour !== null && (
        <aside
          className="tour-bar"
          aria-label={t("Guided tour", "Recorrido guiado")}
        >
          <p>
            <strong>
              {t("Step", "Paso")} {tour + 1}/6 · {remaining}s
            </strong>{" "}
            · <span role="status">{tourNotes[tour]}</span>
          </p>
          <div className="actions">
            <button className="btn sec" onClick={() => setPaused((p) => !p)}>
              {paused ? t("Resume", "Continuar") : t("Pause", "Pausar")}
            </button>
            <button
              className="btn sec"
              onClick={() => {
                if (tour === 5) setTour(null);
                else {
                  setTour(tour + 1);
                  setRemaining(15);
                  location.hash = tourPages[tour + 1];
                }
              }}
            >
              {tour === 5
                ? t("Finish", "Terminar")
                : t("Next step", "Siguiente paso")}
            </button>
            <button className="btn sec" onClick={() => setTour(null)}>
              {t("Exit tour", "Salir del recorrido")}
            </button>
          </div>
        </aside>
      )}
      <main id="main-content" className="mvp-main">
        <div className="eyebrow">
          {t(
            "EARTH / MOON · OPEN ANALOG EXPLORER",
            "TIERRA / LUNA · EXPLORADOR DE ANÁLOGOS",
          )}
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {titles[page]}
        </h1>
        {status === "loading" && (
          <p role="status">
            {t("Loading project data…", "Cargando datos del proyecto…")}
          </p>
        )}
        {status === "error" && (
          <div className="notice" role="alert">
            <h2>
              {t("We could not load the data.", "No pudimos cargar los datos.")}
            </h2>
            <p>
              {t(
                "Check your connection and retry. An offline copy requires one successful online visit.",
                "Revisa tu conexión e intenta de nuevo. El modo sin conexión requiere una primera visita completa con internet.",
              )}
            </p>
            <button className="btn" onClick={() => setAttempt((a) => a + 1)}>
              {t("Retry", "Reintentar")}
            </button>
          </div>
        )}
        {page === "home" && (
          <button
            className="btn sec tour-start"
            onClick={() => {
              setQuery("");
              setTour(0);
              setPaused(
                window.matchMedia("(prefers-reduced-motion: reduce)").matches,
              );
              setRemaining(15);
              location.hash = "home";
            }}
          >
            {t(
              "Optional: take the 90-second tour",
              "Opcional: recorrido de 90 segundos",
            )}
          </button>
        )}
        {(page === "card" || page === "explore") && status === "ready" && (
          <div className="compare-link">
            <a href="#compare">
              {t("Compare Earth and Moon →", "Comparar Tierra y Luna →")}
            </a>
          </div>
        )}
        {page === "compare" && (
          <>
            <DosMundos minutosTierra={earthWindowMinutes} />
            <div className="two-grid">
              <section className="panel">
                <h2>
                  {t(
                    "What a rehearsal can teach",
                    "Qué permite aprender un ensayo",
                  )}
                </h2>
                <p>
                  {t(
                    "How to move through uneven terrain, place instruments and work with low-angle light.",
                    "Cómo desplazarse en terreno irregular, colocar instrumentos y trabajar con luz rasante.",
                  )}
                </p>
              </section>
              <section className="panel">
                <h2>
                  {t("What remains different", "Qué sigue siendo diferente")}
                </h2>
                <p>
                  {t(
                    "Atmosphere, gravity, dust and energy conditions. A successful Earth test does not certify a lunar operation.",
                    "Atmósfera, gravedad, polvo y condiciones energéticas. Una prueba exitosa en la Tierra no certifica una operación lunar.",
                  )}
                </p>
              </section>
            </div>
            <Comparador indice={candidateIndex} actual={candidateId} />
          </>
        )}
        {page === "lab" && (
          <Suspense
            fallback={
              <p role="status">
                {t("Loading the 3D lab…", "Cargando el laboratorio 3D…")}
              </p>
            }
          >
            <Laboratorio motor={motor} onMotorCaido={() => setMotor(null)} />
          </Suspense>
        )}
        {page === "home" && (
          <>
            <div className="hero-grid">
              <div>
                <p className="lead">
                  {t(
                    "Where on Earth could we rehearse work at the lunar south pole? Explore a candidate, understand its limits, and find out what to measure next.",
                    "¿Dónde podríamos practicar en la Tierra el trabajo en el polo sur lunar? Explora una candidata, entiende sus límites y descubre qué medir después.",
                  )}
                </p>
                <div className="actions">
                  <button className="btn" onClick={() => go("explore")}>
                    {t("Explore a candidate →", "Explorar una candidata →")}
                  </button>
                  <button className="btn sec" onClick={() => go("guide")}>
                    {t("How it works", "Cómo funciona")}
                  </button>
                </div>
                <p className="muted">
                  {t(
                    "A terrestrial analog is a practice site. It never reproduces every condition on the Moon.",
                    "Un análogo terrestre es un lugar de ensayo. Nunca reproduce todas las condiciones de la Luna.",
                  )}
                </p>
              </div>
              <Suspense
                fallback={
                  <div className="escena cargando">
                    {t("Loading the 3D terrain…", "Cargando el terreno 3D…")}
                  </div>
                }
              >
                <HeroTerreno motor={motor} onAbrir={() => go("lab")} />
              </Suspense>
            </div>
            <nav
              className="puertas"
              aria-label={t("What you can do here", "Qué puedes hacer aquí")}
            >
              {[
                [
                  "lab",
                  t("Park a rover", "Estaciona un rover"),
                  t(
                    "Click the real lunar relief, pick a season and watch the battery through the night.",
                    "Haz clic en el relieve lunar real, elige una estación y mira la batería durante la noche.",
                  ),
                  t("3D lab →", "Laboratorio 3D →"),
                ],
                [
                  "compare",
                  t("Compare two worlds", "Compara dos mundos"),
                  t(
                    "The same rover under the same Sun on the Moon and on Earth: shadows, power, gravity, time.",
                    "El mismo rover bajo el mismo Sol en la Luna y en la Tierra: sombras, energía, gravedad, tiempo.",
                  ),
                  t("Earth / Moon in 3D →", "Tierra / Luna en 3D →"),
                ],
                [
                  "explore",
                  t("Choose a rehearsal site", "Elige un sitio de ensayo"),
                  t(
                    "Open a candidate, read compatibility and evidence separately, then put candidates side by side.",
                    "Abre una candidata, lee compatibilidad y evidencia por separado y pon candidatas lado a lado.",
                  ),
                  t("Candidates →", "Candidatas →"),
                ],
                [
                  "guide",
                  t("Measure a real shadow", "Mide una sombra real"),
                  t(
                    "A 0.50 m board at sunset is enough to test the Sun model on real ground.",
                    "Una tablita de 0,50 m al atardecer alcanza para probar el modelo del Sol en terreno real.",
                  ),
                  t("Field kit →", "Kit de campo →"),
                ],
              ].map(([to, h, p, cta]) => (
                <a
                  className="puerta"
                  key={to}
                  href={`#${to}`}
                  onClick={() => setTour(null)}
                >
                  <strong>{h}</strong>
                  <span>{p}</span>
                  <em>{cta}</em>
                </a>
              ))}
            </nav>
          </>
        )}
        {page === "explore" && (
          <>
            <p className="lead">
              {t(
                "Choose what you want to rehearse and explore the exported candidates. This interface does not calculate a new ranking.",
                "Elige qué quieres ensayar y explora las candidatas exportadas. Esta interfaz no calcula una clasificación nueva.",
              )}
            </p>
            <div className="filters">
              <label>
                {t("Practice goal", "Objetivo del ensayo")}
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                >
                  <option value="shadow">
                    {t("Observe light and shadows", "Observar luz y sombras")}
                  </option>
                  <option value="robot">
                    {t(
                      "Practice robotic operations",
                      "Practicar operaciones robóticas",
                    )}
                  </option>
                  <option value="materials">
                    {t(
                      "Study surface materials",
                      "Estudiar materiales superficiales",
                    )}
                  </option>
                </select>
              </label>
              <label>
                {t("Search by place or ID", "Buscar por lugar o identificador")}
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Payunia / P-07"
                />
              </label>
            </div>
            {candidateIndex.length > 1 && (
              <label>
                {t(
                  "Available candidates and controls",
                  "Candidatas y controles disponibles",
                )}
                <select
                  value={candidateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCandidateId(id);
                    const url = new URL(location.href);
                    url.searchParams.set("candidate", id);
                    history.replaceState(null, "", url);
                  }}
                >
                  {candidateIndex.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} ·{" "}
                      {c.nombre.replace(
                        " (maqueta)",
                        t(" (mock)", " (maqueta)"),
                      )}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="notice">
              {operation === "materials"
                ? t(
                    "Materials are marked as not comparable. This candidate cannot establish material similarity.",
                    "Los materiales figuran como no comparables. Esta candidata no permite afirmar similitud de materiales.",
                  )
                : t(
                    "Terrain and illumination can support a rehearsal. Earth’s atmosphere and gravity remain different.",
                    "El relieve y la iluminación pueden servir para un ensayo. La atmósfera y la gravedad terrestres siguen siendo diferentes.",
                  )}
            </p>
            {status === "ready" &&
              (matches && ficha ? (
                <div className="two-grid">
                  <figure className="terrain-preview">
                    <img
                      src="/img/ui_tierra_top.png"
                      alt={t(
                        "Illustrative terrain preview of the candidate region",
                        "Vista ilustrativa del relieve de la región candidata",
                      )}
                    />
                    <figcaption>
                      {t(
                        "Synthetic illustration · Location is listed on the card, not plotted on this image",
                        "Ilustración sintética · La ubicación está en la ficha; no está trazada sobre esta imagen",
                      )}
                    </figcaption>
                  </figure>
                  <section className="panel">
                    <span className="eyebrow">
                      {t("Selected candidate", "Candidata seleccionada")}
                    </span>
                    <h2>
                      {ficha.id} · {ficha.lugar.nombre}
                    </h2>
                    <p>{ficha.lugar.region}</p>
                    <p className="mono">
                      {ficha.lugar.lat}, {ficha.lugar.lon}
                    </p>
                    <span className="verdict">
                      {verdicts[ficha.etiqueta] ?? ficha.etiqueta}
                    </span>
                    <p>
                      {t(
                        "Review the verdict and evidence before choosing a rehearsal site.",
                        "Revisa el veredicto y la evidencia antes de elegir un lugar de ensayo.",
                      )}
                    </p>
                    <button className="btn" onClick={() => go("card")}>
                      {t(
                        "Open candidate card →",
                        "Abrir ficha de la candidata →",
                      )}
                    </button>
                  </section>
                </div>
              ) : (
                <div role="status" className="notice">
                  <p>
                    {t(
                      "No matching candidates.",
                      "No hay candidatas que coincidan.",
                    )}
                  </p>
                  <button className="btn sec" onClick={() => setQuery("")}>
                    {t("Clear search", "Limpiar búsqueda")}
                  </button>
                </div>
              ))}
          </>
        )}
        {page === "card" && ficha && status === "ready" && (
          <>
            <a href="#explore">
              ← {t("Back to candidates", "Volver a candidatas")}
            </a>
            <div className="card-heading">
              <h2>
                {ficha.id} · {ficha.lugar.nombre}
              </h2>
              <span className="verdict">
                {verdicts[ficha.etiqueta] ?? ficha.etiqueta}
              </span>
              <p>
                {ficha.lugar.region} ·{" "}
                <span className="mono">
                  {ficha.lugar.lat}, {ficha.lugar.lon}
                </span>
              </p>
              <p className="lead">{dataText(ficha.resumen)}</p>
            </div>
            <div className="two-grid">
              <section className="panel">
                <h2>{t("How well does it fit?", "¿Qué tan bien encaja?")}</h2>
                <div className="metrics">
                  <div>
                    <strong>{number(ficha.C)}</strong>
                    <span>{t("Compatibility (C)", "Compatibilidad (C)")}</span>
                  </div>
                  <div>
                    <strong>{number(ficha.E)}</strong>
                    <span>{t("Evidence (E)", "Evidencia (E)")}</span>
                  </div>
                </div>
                <p>
                  {t(
                    "Compatibility describes the fit to the selected conditions. Evidence describes how much supports that assessment. Neither is a percentage of similarity to the Moon.",
                    "La compatibilidad describe el ajuste a las condiciones elegidas. La evidencia describe cuánto respaldo tiene esa evaluación. Ninguna es un porcentaje de similitud con la Luna.",
                  )}
                </p>
                <p className="muted">
                  {t("Model bounds (L–U)", "Límites del modelo (L–U)")}:{" "}
                  {number(ficha.L)}–{number(ficha.U)} ·{" "}
                  {t(
                    "Example values from the candidate file.",
                    "Valores de ejemplo del archivo de la candidata.",
                  )}
                </p>
              </section>
              <section className="panel">
                <h2>{t("What can we compare?", "¿Qué podemos comparar?")}</h2>
                <dl className="dimensions">
                  {Object.entries(ficha.dimensiones).map(([key, value]) => (
                    <div
                      key={key}
                      className={value === "Unknown" ? "unknown" : ""}
                    >
                      <dt>{dimensionNames[key] ?? key}</dt>
                      <dd>{stateNames[value] ?? value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="panel">
                <h2>{t("What does not transfer?", "¿Qué no se reproduce?")}</h2>
                <ul>
                  {ficha.no_transfiere.map((s) => (
                    <li key={s}>{dataText(s)}</li>
                  ))}
                </ul>
                <h3>{t("Measure first", "Qué medir primero")}</h3>
                <p>{dataText(ficha.medir_primero)}</p>
              </section>
              <section className="panel">
                <h2>
                  {t(
                    "Example rehearsal window",
                    "Ventana de ensayo de ejemplo",
                  )}
                </h2>
                {ficha.horario.map((h, i) => (
                  <p key={i}>
                    <time>{h.fecha}</time> · {h.desde}–{h.hasta} (UTC−3)
                  </p>
                ))}
                <p className="muted">
                  {t(
                    "Historical mock schedule. It is not a forecast or a recommendation for today.",
                    "Horario histórico de maqueta. No es un pronóstico ni una recomendación para hoy.",
                  )}
                </p>
                <div className="actions">
                  <button
                    className="btn sec"
                    onClick={() =>
                      download(
                        `${ficha.id}.json`,
                        JSON.stringify(ficha.source ?? ficha, null, 2),
                      )
                    }
                  >
                    {t(
                      "Download source card (JSON)",
                      "Descargar ficha fuente (JSON)",
                    )}
                  </button>
                  <button className="btn sec" onClick={() => window.print()}>
                    {t("Print / save PDF", "Imprimir / guardar PDF")}
                  </button>
                </div>
              </section>
            </div>
            <div className="notice">
              {t("Source", "Fuente")}:{" "}
              <a
                href={`/data/fichas/${candidateId}.json`}
                target="_blank"
                rel="noreferrer"
              >
                /data/fichas/{candidateId}.json
              </a>{" "}
              ·{" "}
              {t(
                "No scientific validation is claimed by this MVP.",
                "Este MVP no afirma validación científica.",
              )}
            </div>
          </>
        )}
        {page === "checks" && (
          <>
            <p className="lead">
              {t(
                "A working interface is not proof that the science has been validated. Here is what the available files actually support.",
                "Que la interfaz funcione no demuestra que la ciencia esté validada. Esto es lo que respaldan los archivos disponibles.",
              )}
            </p>
            <div className="two-grid">
              <section className="panel">
                <h2>{t("Data loading", "Carga de datos")}</h2>
                <span className="verdict">
                  {status === "ready"
                    ? t(
                        "✓ File structure checked",
                        "✓ Estructura de archivos comprobada",
                      )
                    : t("? Not checked", "? Sin comprobar")}
                </span>
                <p>
                  {t(
                    "The manifest and candidate are checked for required fields, coordinates and score ranges when loaded. This does not verify their scientific accuracy.",
                    "Al cargar, se comprueban los campos obligatorios, las coordenadas y los rangos de puntajes del manifiesto y de la ficha. Esto no verifica su exactitud científica.",
                  )}
                </p>
              </section>
              <ScientificData />
            </div>
            <section className="panel sources">
              <h2>
                {t(
                  "Sources declared in the manifest",
                  "Fuentes declaradas en el manifiesto",
                )}
              </h2>
              <p>
                {t(
                  "These are declarations in mock data. Source files and their hashes have not been independently verified.",
                  "Son declaraciones en datos de maqueta. Los archivos fuente y sus hashes no fueron verificados de forma independiente.",
                )}
              </p>
              {manifest?.fuentes.map((f) => (
                <details key={f.id}>
                  <summary>{f.nombre}</summary>
                  <p>{f.licencia}</p>
                  <p>
                    SHA-256:{" "}
                    <code>
                      {f.sha256 || t("Not supplied", "No suministrado")}
                    </code>
                  </p>
                  <p className="muted">
                    {t("Declared, not verified", "Declarado, sin verificar")}
                  </p>
                </details>
              ))}
              <p>
                {t("Dataset version", "Versión de datos")}:{" "}
                {manifest?.version ?? "—"}
              </p>
              <a href="/data/manifest.json" target="_blank" rel="noreferrer">
                {t("Open manifest (JSON)", "Abrir manifiesto (JSON)")}
              </a>
            </section>
          </>
        )}
        {page === "guide" && (
          <>
            <p className="lead">
              {t(
                "TERRA-X helps explain what an Earth rehearsal can teach us, and what it cannot.",
                "TERRA-X ayuda a entender qué podemos aprender de un ensayo terrestre y qué queda fuera de su alcance.",
              )}
            </p>
            <div className="two-grid">
              {[
                [
                  t("What is an analog?", "¿Qué es un análogo?"),
                  t(
                    "A place that shares selected conditions with another environment. A volcanic landscape might help rehearse movement, without reproducing lunar gravity.",
                    "Un lugar que comparte ciertas condiciones con otro entorno. Un paisaje volcánico puede servir para ensayar desplazamientos sin reproducir la gravedad lunar.",
                  ),
                ],
                [
                  t("How do I read a card?", "¿Cómo leo una ficha?"),
                  t(
                    "Read the verdict first. Then compare compatibility with evidence. Finally, read what does not transfer and what should be measured.",
                    "Lee primero el veredicto. Después compara compatibilidad y evidencia. Por último, revisa qué no se reproduce y qué falta medir.",
                  ),
                ],
                [
                  t(
                    "Can I trust the example numbers?",
                    "¿Puedo confiar en las cifras de ejemplo?",
                  ),
                  t(
                    "They demonstrate the interface, not a scientific conclusion. The mock banner stays visible until the source files declare real data.",
                    "Sirven para demostrar la interfaz, no una conclusión científica. El aviso de maqueta permanece mientras los archivos declaren datos de ejemplo.",
                  ),
                ],
                [
                  t("How do I use it offline?", "¿Cómo lo uso sin internet?"),
                  t(
                    "Open the production app online and wait for “Saved for offline use”. Then return to this same address. External pages are not saved.",
                    "Abre la app de producción con internet y espera “Guardado para usar sin conexión”. Luego vuelve a la misma dirección. Las páginas externas no se guardan.",
                  ),
                ],
              ].map(([h, p]) => (
                <section className="panel" key={h}>
                  <h2>{h}</h2>
                  <p>{p}</p>
                </section>
              ))}
            </div>
            <SunLab />
            <SombraCampo motor={motor} />
            <details className="notice">
              <summary>
                {t(
                  "Team scientific workspace (English)",
                  "Espacio científico del equipo (inglés)",
                )}
              </summary>
              <p>
                {t(
                  "The original team interface is preserved separately, including Destination and its lunar maps. Some specialist views still use mock data.",
                  "La interfaz original del equipo se conserva por separado, incluidos Destination y sus mapas lunares. Algunas vistas especializadas aún usan datos de maqueta.",
                )}
              </p>
              <a href="/team.html" target="_blank" rel="noreferrer">
                {t(
                  "Open team workspace in a new tab",
                  "Abrir el espacio del equipo en otra pestaña",
                )}
              </a>
            </details>
            <button className="btn" onClick={() => go("explore")}>
              {t(
                "Ready: explore a candidate →",
                "Listo: explorar una candidata →",
              )}
            </button>
          </>
        )}
      </main>
      <footer className="mvp-footer">
        <span>
          TERRA-X ·{" "}
          {t("Open rehearsal explorer", "Explorador abierto de ensayos")}
        </span>
        <a href="#checks">
          {t("Data and limitations", "Datos y limitaciones")}
        </a>
      </footer>
      <Horizon />
    </>
  );
}
function SunLab() {
  const { t, language } = useLanguage();
  const sol = useSol();
  return (
    <section className="panel sun-lab">
      <h2>
        {t(
          "Why are low-Sun shadows long?",
          "¿Por qué el Sol bajo produce sombras largas?",
        )}
      </h2>
      <p>
        {t(
          "Move the slider. This ideal geometric example uses a vertical 0.5 m post on flat ground; it does not model real terrain.",
          "Mueve el control. Este ejemplo geométrico ideal usa un poste vertical de 0,5 m sobre suelo plano; no modela un terreno real.",
        )}
      </p>
      <label htmlFor="sun-angle">
        {t("Sun elevation", "Elevación del Sol")}:{" "}
        {sol.elevacion.toLocaleString(language)}°
      </label>
      <input
        id="sun-angle"
        type="range"
        min="1.5"
        max="10"
        step="0.5"
        value={sol.elevacion}
        onChange={(e) => sol.setElevacion(Number(e.target.value))}
      />
      <p>
        <strong>
          {t("Shadow length", "Longitud de sombra")}:{" "}
          {(0.5 / Math.tan((sol.elevacion * Math.PI) / 180)).toLocaleString(
            language,
            { maximumFractionDigits: 2 },
          )}{" "}
          m
        </strong>
      </p>
      <p className="mono">
        {t(
          "Formula: height / tan(sun elevation)",
          "Fórmula: altura / tan(elevación solar)",
        )}
      </p>
    </section>
  );
}
function Horizon() {
  const { t, language } = useLanguage();
  const sol = useSol();
  return (
    <div className="mvp-horizon">
      <label htmlFor="global-sun">
        {t("Sun · visual example", "Sol · ejemplo visual")}{" "}
        <strong>{sol.elevacion.toLocaleString(language)}°</strong>
      </label>
      <input
        id="global-sun"
        type="range"
        min="1.5"
        max="10"
        step="0.5"
        value={sol.elevacion}
        onChange={(e) => sol.setElevacion(Number(e.target.value))}
      />
      <span>
        {t("Move to change panel shadows", "Mueve para cambiar las sombras")}
      </span>
    </div>
  );
}
export default function MvpApp() {
  return (
    <LanguageProvider>
      <SolProvider>
        <AppContent />
      </SolProvider>
    </LanguageProvider>
  );
}
