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
import { readRanking } from "../datos/ranking";
import AsistenteSI from "../si/AsistenteSI";
import { abrirSI } from "../si/abrirSI";
import { Integridad } from "./Integridad";
import { SolProvider, useSol } from "../luz/SolContext";
import { EstadoMotor, estadoMotor } from "../datos/laboratorio";
import DosMundos from "../pantallas/operacion/DosMundos";
import Comparador from "../pantallas/operacion/Comparador";
import SombraCampo from "../pantallas/field/SombraCampo";
import ReferencePlate from "./ReferencePlate";
import HeroEspacio from "./HeroEspacio";
import ThemeToggle from "./ThemeToggle";
import {
  Goal,
  GoalPicker,
  goals,
  siteName,
  SiteList,
  Verdict,
} from "./Catalogue";
import {
  ArrowRight,
  BookOpen,
  Box,
  Compass,
  Globe2,
  Layers,
  MapPin,
  PlayCircle,
  SlidersHorizontal,
  MessageCircle,
} from "lucide-react";
import "./tokens.css";
import "./mvp.css";
import "./lab.css";
import "./movimiento.css";
import { useRevelar } from "./useRevelar";

// The 3D screens (three.js + Blender models) load only when they are opened.
const Laboratorio = lazy(() => import("../pantallas/operacion/Laboratorio"));

type Page =
  | "home"
  | "explore"
  | "card"
  | "compare"
  | "worlds"
  | "lab"
  | "checks"
  | "guide";
const pages: Page[] = [
  "home",
  "explore",
  "card",
  "compare",
  "worlds",
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
function readGoal(): Goal {
  const value = new URLSearchParams(location.search).get("goal");
  return value === "materials" || value === "robot" ? value : "shadow";
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
  const sol = useSol();
  const [page, setPage] = useState<Page>(currentPage);
  const [manifest, setManifest] = useState<Manifest>();
  const [ficha, setFicha] = useState<Ficha>();
  const [candidateId, setCandidateId] = useState(
    () => new URLSearchParams(location.search).get("candidate") || "P-07",
  );
  useEffect(() => {
    let active = true;
    readRanking()
      .then((r) => {
        const best = r.entradas.find(
          (entry) => !entry.control && entry.etiqueta !== "incompatible",
        );
        if (
          !active ||
          !best ||
          new URLSearchParams(location.search).has("candidate")
        )
          return;
        const url = new URL(location.href);
        url.searchParams.set("candidate", best.id);
        history.replaceState(null, "", url);
        setCandidateId(best.id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [candidateIndex, setCandidateIndex] = useState<IndexEntry[]>([]);
  const [indexAttempt, setIndexAttempt] = useState(0);
  const [indexStatus, setIndexStatus] = useState("loading");
  useEffect(() => {
    setIndexStatus("loading");
    let active = true;
    readIndex()
      .then((v) => {
        if (active) {
          setCandidateIndex(v);
          setIndexStatus("ready");
        }
      })
      .catch(() => {
        if (active) setIndexStatus("error");
      });
    return () => {
      active = false;
    };
  }, [indexAttempt]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [manifestFailed, setManifestFailed] = useState(false);
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
  useRevelar(page);
  const [query, setQuery] = useState("");
  const [operation, setOperation] = useState<Goal>(readGoal);
  const changeGoal = (goal: Goal) => {
    setOperation(goal);
    const url = new URL(location.href);
    url.searchParams.set("goal", goal);
    history.replaceState(null, "", url);
  };
  const [tour, setTour] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(15);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstPage = useRef(true);
  useEffect(() => {
    const change = () => {
      const next = currentPage();
      setPage(next);
      setCandidateId(
        new URLSearchParams(location.search).get("candidate") || "P-07",
      );
      setOperation(readGoal());
      setTour((step) =>
        step !== null && tourPages[step] !== next ? null : step,
      );
    };
    window.addEventListener("hashchange", change);
    window.addEventListener("popstate", change);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("popstate", change);
    };
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
    readFicha(candidateId)
      .then((f) => {
        if (active) {
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
    let active = true;
    setManifestFailed(false);
    readManifest()
      .then((m) => {
        if (active) setManifest(m);
      })
      .catch(() => {
        if (active) setManifestFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const message = (event: MessageEvent) => {
      if (event.data === "OFFLINE_READY") setOfflineReady(true);
    };
    navigator.serviceWorker?.addEventListener("message", message);
    // A new deploy installs a new service worker, which takes over this page (skipWaiting + claim).
    // When that replaces an older one, reload once so the visitor sees the new version right away.
    const habiaVersion = Boolean(navigator.serviceWorker?.controller);
    let recargada = false;
    const nuevaVersion = () => {
      if (!habiaVersion || recargada) return;
      recargada = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", nuevaVersion);
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          reg.update().catch(() => undefined);
          return navigator.serviceWorker.ready;
        })
        .then((reg) => {
          reg.active?.postMessage("CHECK_READY");
        })
        .catch(() => setOfflineReady(false));
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      navigator.serviceWorker?.removeEventListener("message", message);
      navigator.serviceWorker?.removeEventListener("controllerchange", nuevaVersion);
    };
  }, []);
  const go = (next: Page) => {
    setTour(null);
    location.hash = next;
  };
  const openSite = (id: string) => {
    const url = new URL(location.href);
    url.searchParams.set("candidate", id);
    url.hash = "card";
    history.pushState(null, "", url);
    setTour(null);
    setPage("card");
    setCandidateId(id);
  };
  const compareWithSite = () => {
    const url = new URL(location.href);
    if (url.searchParams.has("sites")) {
      const ids = (url.searchParams.get("sites") || "")
        .split(",")
        .filter(Boolean);
      if (!ids.includes(candidateId))
        url.searchParams.set(
          "sites",
          [candidateId, ...ids].slice(0, 3).join(","),
        );
    }
    url.hash = "compare";
    history.pushState(null, "", url);
    setTour(null);
    setPage("compare");
  };
  const tourNotes = [
    t(
      "The goal: find useful practice conditions on Earth, while acknowledging the differences.",
      "El objetivo: encontrar condiciones útiles para practicar en la Tierra y reconocer sus diferencias.",
    ),
    t(
      "Search the catalogue and open a site record.",
      "Busca en el catálogo y abre la ficha de un sitio.",
    ),
    t(
      "Read compatibility and evidence separately, then check the limits.",
      "Lee compatibilidad y evidencia por separado; después revisa los límites.",
    ),
    t(
      "Read the site verdicts together and check which measurements are missing.",
      "Lee juntos los veredictos de los sitios y revisa qué mediciones faltan.",
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
  const titles: Record<Page, string> = {
    home: t(
      "Earth sites for lunar rehearsals",
      "Sitios terrestres para ensayos lunares",
    ),
    explore: t("Explore sites", "Explorar sitios"),
    card:
      ficha && status === "ready"
        ? siteName(ficha.lugar.nombre, t)
        : t("Site record", "Ficha del sitio"),
    compare: t("Compare sites", "Comparar sitios"),
    worlds: t("Earth and Moon", "Tierra y Luna"),
    lab: t("Lunar terrain laboratory", "Laboratorio de terreno lunar"),
    checks: t("Sources and verification", "Fuentes y verificaciones"),
    guide: t("How it works", "Cómo funciona"),
  };
  useEffect(() => {
    document.title = titles[page] + " | TERRA-X";
  }, [page, titles[page]]);
  const nav = [
    { page: "home", label: t("Home", "Inicio") },
    { page: "explore", label: titles.explore },
    { page: "compare", label: t("Compare", "Comparar") },
    { page: "lab", label: t("3D lab", "Laboratorio 3D") },
    { page: "guide", label: titles.guide },
  ];
  const entries: IndexEntry[] =
    candidateIndex.length ||
    indexStatus !== "error" ||
    status !== "ready" ||
    !ficha
      ? candidateIndex
      : [
          {
            id: ficha.id,
            nombre: ficha.lugar.nombre,
            etiqueta: ficha.etiqueta,
            lugar: ficha.lugar,
            maqueta: ficha.maqueta,
            control: ficha.control,
          },
        ];
  const sites = entries.filter((c) => !c.control);
  const references = entries.filter((c) => c.control);
  const matches = (c: IndexEntry) =>
    (siteName(c.nombre, t) + " " + c.id)
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  const goalNote =
    operation === "materials"
      ? t(
          "Read the materials dimension and check which surface samples are missing.",
          "Consulta la dimensión de materiales y comprueba qué muestras de superficie faltan.",
        )
      : operation === "robot"
        ? t(
            "Review terrain and robotic operations before planning a traverse.",
            "Revisa el relieve y las operaciones robóticas antes de planificar un recorrido.",
          )
        : t(
            "Review illumination and the exported windows for low-angle sunlight.",
            "Revisa la iluminación y las ventanas exportadas de luz rasante.",
          );
  const indexMessage =
    indexStatus === "loading" ? (
      <p role="status">
        {t("Loading site catalogue…", "Cargando el catálogo…")}
      </p>
    ) : indexStatus === "error" ? (
      <div className="notice" role="status">
        {t(
          "The catalogue could not be loaded. Available records can still be opened.",
          "No se pudo cargar el catálogo. Puedes abrir las fichas disponibles.",
        )}{" "}
        <button
          className="text-btn"
          onClick={() => setIndexAttempt((a) => a + 1)}
        >
          {t("Retry catalogue", "Reintentar catálogo")}
        </button>
      </div>
    ) : null;
  // Minutes of the Earth rehearsal window (Sun from 7° to 1.5°), from the open card.
  const earthWindowMinutes = (() => {
    const w = ficha?.horario[0];
    if (!w || ficha?.control) return null;
    if (
      typeof w.duracion_min === "number" &&
      Number.isFinite(w.duracion_min) &&
      w.duracion_min > 0
    )
      return w.duracion_min;
    const [h1, m1] = w.desde.split(":").map(Number);
    const [h2, m2] = w.hasta.split(":").map(Number);
    const minutes = h2 * 60 + m2 - (h1 * 60 + m1);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  })();
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
  const translations: Record<string, string> = {
    "Surface material composition": "Composición del material superficial",
    "Fine-scale traversability": "Transitabilidad a pequeña escala",
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
          <img src="/terra-x.svg" width="36" height="36" alt="" />
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
                (page === "card" && n.page === "explore") ||
                (page === "worlds" && n.page === "compare")
                  ? "page"
                  : undefined
              }
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="header-preferences">
          <ThemeToggle language={language} />
          <div
            className="language"
            role="group"
            aria-label={t("Language", "Idioma")}
          >
            <Globe2 size={17} aria-hidden="true" />
            <button
              aria-label="English"
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
              lang="en"
            >
              EN
            </button>
            <button
              aria-label="Español"
              aria-pressed={language === "es"}
              onClick={() => setLanguage("es")}
              lang="es"
            >
              ES
            </button>
          </div>
        </div>
      </header>
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
      <main
        key={page}
        id="main-content"
        className={page === "home" ? "mvp-main inicio" : "mvp-main"}
      >
        {page !== "home" && (
          <div className="page-title">
            <a href="#home">{t("Field atlas", "Atlas de campo")}</a>
            <span aria-hidden="true"> / </span>
            <span>
              {page === "card"
                ? t("Site record", "Ficha del sitio")
                : titles[page]}
            </span>
            <h1 ref={heading} tabIndex={-1}>
              {titles[page]}
            </h1>
          </div>
        )}
        {page === "card" && status === "loading" && (
          <p role="status">
            {t("Loading project data…", "Cargando datos del proyecto…")}
          </p>
        )}
        {["card", "checks", "explore"].includes(page) && status === "error" && (
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
            </button>{" "}
            <a href="#explore">{titles.explore}</a>
          </div>
        )}
        {(page === "compare" || page === "worlds") && (
          <nav
            className="view-switch"
            aria-label={t("Comparison views", "Vistas de comparación")}
          >
            <a
              href="#compare"
              aria-current={page === "compare" ? "page" : undefined}
            >
              <MapPin size={17} />
              {titles.compare}
            </a>
            <a
              href="#worlds"
              aria-current={page === "worlds" ? "page" : undefined}
            >
              <Globe2 size={17} />
              {titles.worlds}
            </a>
          </nav>
        )}
        {page === "compare" && (
          <>
            {indexMessage}
            {!!entries.length && (
              <Comparador
                indice={entries}
                actual={candidateId}
                goal={operation}
                changeGoal={changeGoal}
                openSite={openSite}
              />
            )}
          </>
        )}
        {page === "worlds" && (
          <DosMundos
            minutosTierra={
              status === "ready" &&
              !references.some((c) => c.id === candidateId)
                ? earthWindowMinutes
                : null
            }
            site={
              status === "ready" && ficha
                ? siteName(ficha.lugar.nombre, t)
                : candidateId
            }
            mock={!!ficha?.maqueta}
          />
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
            <HeroEspacio>
              <div className="hero-copy">
                <div className="atlas-label">
                  <Compass size={18} />
                  {t(
                    "Terrestrial analog atlas",
                    "Atlas de análogos terrestres",
                  )}
                </div>
                <h1 ref={heading} tabIndex={-1}>
                  {titles.home}
                </h1>
                <p className="lead">
                  {t(
                    "Find places to practice lunar operations on Earth. Explore the terrain, see which conditions match and decide what to measure in the field.",
                    "Encuentra dónde ensayar operaciones lunares en la Tierra. Explora el terreno, identifica qué condiciones coinciden y decide qué medir en campo.",
                  )}
                </p>
                <div className="actions">
                  <a className="btn" href="#explore">
                    {t("Explore rehearsal sites", "Explorar sitios de ensayo")}{" "}
                    <ArrowRight size={18} />
                  </a>
                  <button
                    className="text-btn"
                    onClick={() => {
                      setQuery("");
                      setTour(0);
                      setPaused(
                        matchMedia("(prefers-reduced-motion: reduce)").matches,
                      );
                      setRemaining(15);
                      location.hash = "home";
                    }}
                  >
                    <PlayCircle size={19} />
                    {t("90-second tour", "Recorrido de 90 segundos")}
                  </button>
                  <button className="text-btn" type="button" onClick={() => abrirSI(
                    t("How can the SI help me choose a rehearsal site?", "¿Cómo me ayuda la SI a elegir un sitio de ensayo?"),
                    { pagina: "home" },
                  )}>
                    <MessageCircle size={19} aria-hidden="true" />
                    {t("Ask the SI about a site", "Preguntale a la SI sobre un sitio")}
                  </button>
                </div>
                <p className="audience">
                  <BookOpen size={16} />
                  {t(
                    "For students, educators and field teams",
                    "Para estudiantes, docentes y equipos de campo",
                  )}
                </p>
              </div>
            </HeroEspacio>
            <div className="inicio-cuerpo">
            <section
              className="atlas-referencia"
              aria-labelledby="referencia-lunar"
            >
              <div>
                <h2 id="referencia-lunar">
                  {t(
                    "The lunar terrain every site is compared with",
                    "El terreno lunar con el que se compara cada sitio",
                  )}
                </h2>
                <p className="lead">
                  {t(
                    "Mons Mouton, near the lunar south pole, from NASA LOLA relief. Every Earth site is read on the same 60 m grid and with the same code.",
                    "Mons Mouton, cerca del polo sur lunar, con el relieve NASA LOLA. Cada sitio terrestre se lee en la misma grilla de 60 m y con el mismo código.",
                  )}
                </p>
                <a className="text-btn" href="#lab">
                  {t(
                    "Test a rover on Mons Mouton",
                    "Prueba un rover en Mons Mouton",
                  )}{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
              <ReferencePlate motor={motor} openLab={() => go("lab")} />
            </section>
            <div className="atlas-lower">
              <section>
                <div className="section-heading">
                  <h2>{t("Rehearsal sites", "Sitios de ensayo")}</h2>
                  <a href="#explore">
                    {t("View catalogue", "Ver catálogo")}{" "}
                    <ArrowRight size={15} />
                  </a>
                </div>
                <p className="muted">
                  {t(
                    "Open a site record to inspect its evidence.",
                    "Abre una ficha para revisar su evidencia.",
                  )}{" "}
                  {sites.some((c) => c.maqueta) &&
                    t(
                      "The catalogue includes demonstration records.",
                      "El catálogo incluye fichas de demostración.",
                    )}
                </p>
                {indexMessage}
                <SiteList entries={sites.slice(0, 3)} openSite={openSite} />
              </section>
              <aside className="field-tools">
                <h2>{t("Field tools", "Herramientas de campo")}</h2>
                <a href="#lab">
                  <Box />
                  <span>
                    <strong>{titles.lab}</strong>
                    <small>
                      {t(
                        "Test a rover on Mons Mouton",
                        "Prueba un rover en Mons Mouton",
                      )}
                    </small>
                  </span>
                  <ArrowRight />
                </a>
                <a href="#worlds">
                  <Layers />
                  <span>
                    <strong>{titles.worlds}</strong>
                    <small>
                      {t(
                        "Explore what transfers",
                        "Explora qué se puede reproducir",
                      )}
                    </small>
                  </span>
                  <ArrowRight />
                </a>
                <a href="#terrax-guia" aria-controls="terrax-guia" onClick={e => {
                  e.preventDefault();
                  abrirSI(t("How does the SI explain results with engine data?", "¿Cómo explica la SI los resultados con datos del motor?"), { pagina: "home" });
                }}>
                  <MessageCircle aria-hidden="true" />
                  <span>
                    <strong>{t("SI assistant", "Asistente SI")}</strong>
                    <small>{t("Explains results with engine data", "Explica resultados con datos del motor")}</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </a>
              </aside>
            </div>
            </div>
          </>
        )}
        {page === "explore" && (
          <>
            <p className="lead">
              {t(
                "Find a record by place or identifier. Each one documents the conditions a site can reproduce and what still needs measuring.",
                "Busca por lugar o identificador. Cada ficha explica qué condiciones se pueden reproducir y qué falta medir.",
              )}
            </p>
            <div className="filters">
              <label>
                {t("Search by place or ID", "Buscar por lugar o identificador")}
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Payunia / P-07"
                />
              </label>
              <GoalPicker goal={operation} change={changeGoal} />
            </div>
            <p className="goal-note">
              <SlidersHorizontal size={17} />
              {goalNote}{" "}
              {t(
                "Changing the goal only changes the reading guidance.",
                "Cambiar el objetivo solo cambia la guía de lectura.",
              )}
            </p>
            {indexMessage}
            <section className="catalogue">
              <h2>
                {t("Terrestrial sites", "Sitios terrestres")}{" "}
                <small>{sites.filter(matches).length}</small>
              </h2>
              <SiteList entries={sites.filter(matches)} openSite={openSite} />
              {sites.some((c) => matches(c) && c.maqueta) && (
                <p className="muted">
                  {t(
                    "The catalogue includes demonstration records. Open each record to check its source.",
                    "El catálogo incluye fichas de demostración. Abre cada ficha para comprobar su fuente.",
                  )}
                </p>
              )}
            </section>
            {!!references.filter(matches).length && (
              <details
                className="panel control-records"
                open={query.trim() ? true : undefined}
              >
                <summary>
                  {t(
                    "Scientific reference controls",
                    "Controles científicos de referencia",
                  )}{" "}
                  ({references.filter(matches).length})
                </summary>
                <p>
                  {t(
                    "These records test how the method behaves. Use the terrestrial catalogue above to choose a rehearsal site.",
                    "Estas fichas comprueban cómo se comporta el método. Elige un lugar de ensayo en el catálogo terrestre.",
                  )}
                </p>
                <SiteList
                  entries={references.filter(matches)}
                  openSite={openSite}
                />
              </details>
            )}
            {indexStatus !== "loading" && !entries.some(matches) && (
              <div className="notice" role="status">
                <p>
                  {t(
                    "No matching candidates.",
                    "No hay candidatas que coincidan.",
                  )}
                </p>
                {query && (
                  <button className="btn sec" onClick={() => setQuery("")}>
                    {t("Clear search", "Limpiar búsqueda")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {page === "card" && ficha && status === "ready" && (
          <>
            <a href="#explore">
              ← {t("Back to candidates", "Volver a candidatas")}
            </a>
            <div className="card-heading">
              <div className="record-meta">
                <MapPin size={17} />
                <span>{ficha.id}</span> /{" "}
                <span>
                  {ficha.lugar.lat}°, {ficha.lugar.lon}°
                </span>
              </div>
              <Verdict value={ficha.etiqueta} />{" "}
              {ficha.maqueta && (
                <span className="demo-tag">
                  {t("Demonstration record", "Ficha de demostración")}
                </span>
              )}
              {ficha.control && (
                <p>
                  {t(
                    "Scientific reference control for checking the method.",
                    "Control científico de referencia para comprobar el método.",
                  )}
                </p>
              )}
              <p className="lead">{dataText(ficha.resumen)}</p>
              <p>
                <strong>{t("Practice goal", "Objetivo del ensayo")}</strong> ·{" "}
                {t(goals[operation][0], goals[operation][1])}. {goalNote}
              </p>
              <button className="btn" onClick={compareWithSite}>
                {t("Compare this record", "Comparar esta ficha")}{" "}
                <ArrowRight size={17} />
              </button>
              <button className="text-btn" type="button" onClick={() => abrirSI(
                t(`What supports the result for ${ficha.id}, and what evidence is missing?`, `¿Qué respalda el resultado de ${ficha.id} y qué evidencia falta?`),
                { pagina: "card", candidataId: ficha.id },
              )}>
                <MessageCircle size={18} aria-hidden="true" />
                {t("Explain with SI", "Explicar con SI")}
              </button>
            </div>
            <div className="two-grid record-body">
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
                    "C describes the fit of measured properties. It is not a similarity percentage. E is the share of property weights covered by evidence, not a probability.",
                    "C describe el ajuste de las propiedades medidas. No es un porcentaje de parecido. E indica qué parte del peso tiene evidencia, no una probabilidad.",
                  )}
                </p>
                <p className="muted">
                  {t("Model bounds (L–U)", "Límites del modelo (L–U)")}:{" "}
                  {number(ficha.L)}–{number(ficha.U)} ·{" "}
                  {t(
                    "Bounds under the model assumptions, not a confidence interval.",
                    "Límites bajo los supuestos del modelo, no un intervalo de confianza.",
                  )}
                </p>
              </section>
              <section className="panel">
                <h2>{t("What does not transfer?", "¿Qué no se reproduce?")}</h2>
                <ul>
                  {ficha.no_transfiere.map((s) => (
                    <li key={s}>{dataText(s)}</li>
                  ))}
                </ul>
                <h3>{t("Measure first", "Qué medir primero")}</h3>
                <p>
                  {ficha.medir_primero
                    ? ficha.medir_primero.split("; ").map(dataText).join(" · ")
                    : t(
                        "No priority measurement listed.",
                        "La ficha no indica una medición prioritaria.",
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
                <h2>
                  {t(
                    "Recorded rehearsal windows",
                    "Ventanas de ensayo registradas",
                  )}
                </h2>
                {!ficha.horario.length && (
                  <p>
                    {t(
                      "No rehearsal window supplied.",
                      "La ficha no incluye una ventana de ensayo.",
                    )}
                  </p>
                )}
                {!!ficha.horario.length && (
                  <table className="window-table">
                    <thead>
                      <tr>
                        <th>{t("Date", "Fecha")}</th>
                        <th>{t("Local time", "Hora local")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ficha.horario.map((h, i) => (
                        <tr key={i}>
                          <td>
                            <time>{h.fecha}</time>
                          </td>
                          <td>
                            {h.desde}–{h.hasta}
                            {h.zona && <small> UTC{h.zona}</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="muted">
                  {t(
                    "Use the date and local time on the source record. These windows describe the recorded day.",
                    "Consulta la fecha y hora local de la ficha fuente. Estas ventanas describen el día indicado.",
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
              · <a href="#checks">{titles.checks}</a>
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
                  {status === "ready" && manifest
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
            <Integridad />
            <section className="panel sources">
              <h2>
                {t(
                  "Sources declared in the manifest",
                  "Fuentes declaradas en el manifiesto",
                )}
              </h2>
              <p>
                {t(
                  "The manifest lists source datasets and the hashes supplied by their publishers or the project. A missing hash is shown explicitly.",
                  "El manifiesto enumera las fuentes y las huellas declaradas por sus proveedores o por el proyecto. Las huellas ausentes se indican en cada entrada.",
                )}
              </p>
              {manifestFailed && (
                <div className="notice" role="alert">
                  {t(
                    "The source manifest is unavailable.",
                    "El manifiesto de fuentes no está disponible.",
                  )}{" "}
                  <button
                    className="text-btn"
                    onClick={() => setAttempt((n) => n + 1)}
                  >
                    {t("Retry manifest", "Reintentar manifiesto")}
                  </button>
                </div>
              )}
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
                    "Check the demonstration label on each record. The current terrestrial export uses Copernicus and Sentinel-2, and the lunar reference uses LOLA and JPL ephemerides.",
                    "Revisa la etiqueta de demostración en cada ficha. La exportación terrestre actual usa Copernicus y Sentinel-2, y la referencia lunar usa LOLA y efemérides JPL.",
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
            <div className="actions">
              <a className="btn sec" href="#worlds">
                {titles.worlds}
              </a>
              <a className="btn sec" href="#lab">
                {titles.lab}
              </a>
              <a className="btn sec" href="#checks">
                {titles.checks}
              </a>
            </div>
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
        <div>
          <strong>TERRA-X</strong>
          <span>{t("Field atlas", "Atlas de campo")}</span>
        </div>
        <a href="#checks">{titles.checks}</a>
        <div className="connection" role="status">
          {online ? t("Online", "Con conexión") : t("Offline", "Sin conexión")}{" "}
          ·{" "}
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
      </footer>
      <AsistenteSI
        pagina={page}
        ficha={status === "ready" ? ficha : undefined}
        manifest={manifest}
        indice={candidateIndex}
        elevacionSolDeg={sol.elevacion}
        motorEnVivo={Boolean(motor)}
        idioma={language}
        onNavegar={(dest) => {
          if (pages.includes(dest as Page)) go(dest as Page);
        }}
        onSeleccionarCandidata={openSite}
        onAjustarSol={sol.setElevacion}
      />
    </>
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
