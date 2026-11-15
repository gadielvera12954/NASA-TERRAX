import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Box, Compass, Earth, House, LogIn, MapPin, Moon, ShieldCheck, Sun, Sunset, Users } from "lucide-react";
import { Logotipo } from "./Logo";
import { Usuario, cuentas } from "../datos/cuentas";
import Comunidad from "../pantallas/comunidad/Comunidad";
import Cuenta from "../pantallas/comunidad/Cuenta";
import Admin from "../pantallas/comunidad/Admin";
import "../pantallas/comunidad/comunidad.css";
import { LanguageProvider, useLanguage } from "../i18n/Language";
import { Ficha, Manifest } from "../datos/contract";
import {
  readManifest,
  readFicha,
  readIndex,
  IndexEntry,
} from "../datos/integration";
import { ScientificData } from "./ScientificData";
import { Marca } from "./Marca";
import { Integridad } from "./Integridad";
import { Contador } from "./Contador";
import { EntradaRanking, readRanking } from "../datos/ranking";
import { SolProvider, useSol } from "../luz/SolContext";
import { EstadoMotor, estadoMotor } from "../datos/laboratorio";
import DosMundos from "../pantallas/operacion/DosMundos";
import Comparador from "../pantallas/operacion/Comparador";
import SombraCampo from "../pantallas/field/SombraCampo";
import AsistenteSI from "../si/AsistenteSI";
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
  | "guide"
  | "community"
  | "account"
  | "admin";
const pages: Page[] = [
  "home",
  "explore",
  "card",
  "compare",
  "lab",
  "checks",
  "guide",
  "community",
  "account",
  "admin",
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
  const sol = useSol();
  // Shadow length on the wall: 2 px / tan(elevation), always falling to the lower right.
  useEffect(() => {
    const largo = 2 / Math.tan((sol.elevacion * Math.PI) / 180);
    document.documentElement.style.setProperty("--sombra-l", `${largo.toFixed(1)}px`);
  }, [sol.elevacion]);
  const [page, setPage] = useState<Page>(currentPage);
  const [manifest, setManifest] = useState<Manifest>();
  const [ficha, setFicha] = useState<Ficha>();
  const [candidateId, setCandidateId] = useState(
    () => new URLSearchParams(location.search).get("candidate") || "P-07",
  );
  const [candidateIndex, setCandidateIndex] = useState<IndexEntry[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [ranking, setRanking] = useState<EntradaRanking[]>([]);
  const [umbral, setUmbral] = useState(0.7);
  const [mostrarControles, setMostrarControles] = useState(true);
  useEffect(() => {
    let active = true;
    readRanking()
      .then((r) => {
        if (active) {
          setRanking(r.entradas);
          setUmbral(r.umbral);
          // Without an explicit ?candidate=, open on the best-ranked parcel rather than a fixed id.
          const mejor = r.entradas.find((e) => !e.control && e.etiqueta !== "incompatible");
          if (mejor && !new URLSearchParams(location.search).get("candidate")) setCandidateId(mejor.id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const elegirCandidata = (id: string) => {
    setCandidateId(id);
    const url = new URL(location.href);
    url.searchParams.set("candidate", id);
    history.replaceState(null, "", url);
  };
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
  // Accounts live in the TERRA-X server: ask who is signed in once it answers.
  const servidor = motor !== null;
  useEffect(() => {
    if (!servidor) {
      setUsuario(null);
      return;
    }
    cuentas.yo().then((r) => setUsuario(r.usuario)).catch(() => setUsuario(null));
  }, [servidor]);
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
      "Choose a practice goal and open a candidate.",
      "Elige un objetivo de ensayo y abre una candidata.",
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
    community: t("Science, explained by verified people.", "Ciencia, explicada por personas verificadas."),
    account: usuario ? t("Your account.", "Tu cuenta.") : t("Sign in to write.", "Entrá para escribir."),
    admin: t("Admin panel.", "Panel admin."),
  };
  const nav = [
    { page: "home" as Page, label: t("Home", "Inicio"), Icono: House },
    { page: "explore" as Page, label: t("Explore", "Explorar"), Icono: Compass },
    { page: "lab" as Page, label: t("3D lab", "Laboratorio 3D"), Icono: Box },
    { page: "community" as Page, label: t("Community", "Comunidad"), Icono: Users },
    { page: "checks" as Page, label: t("Verification", "Verificación"), Icono: ShieldCheck },
    { page: "guide" as Page, label: t("Guide", "Guía"), Icono: BookOpen },
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
    con_huecos: t("With gaps", "Con vacíos de información"),
    sostenido: t("Supported", "Respaldado"),
    no_alcanza: t("Insufficient", "Insuficiente"),
    no_puede: t("Unknown", "Desconocido"),
    incompatible: t("Incompatible", "Incompatible"),
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
          <Logotipo claro />
          <span className="brand-sub">{t("Lunar analog finder", "Buscador de análogos lunares")}</span>
        </a>
        <nav aria-label={t("Main navigation", "Navegación principal")}>
          {nav.map(({ page: destino, label, Icono }) => (
            <a
              key={destino}
              href={`#${destino}`}
              onClick={() => setTour(null)}
              aria-current={
                page === destino ||
                ((page === "card" || page === "compare") && destino === "explore") ||
                ((page === "account" || page === "admin") && destino === "community")
                  ? "page"
                  : undefined
              }
            >
              <Icono aria-hidden="true" size={16} strokeWidth={2} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="cabeza-derecha">
          <span className="chip chip-sol" title={t("Sun elevation used for the shadows on screen", "Elevación del Sol usada para las sombras en pantalla")}>
            <Sun aria-hidden="true" size={14} />
            {sol.elevacion.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°
          </span>
          <span className="chip chip-motor" title={motor ? t("Live engine connected", "Motor en vivo conectado") : t("Using the exported data", "Usando los datos exportados")}>
            <span className={motor ? "luz vivo" : "luz"} aria-hidden="true" />
            {motor ? t("Live", "En vivo") : t("Offline data", "Datos exportados")}
          </span>
          <div
            className="language"
            role="group"
            aria-label={t("Language", "Idioma")}
          >
            <button aria-pressed={language === "en"} onClick={() => setLanguage("en")} lang="en" aria-label="English">
              EN
            </button>
            <button aria-pressed={language === "es"} onClick={() => setLanguage("es")} lang="es" aria-label="Español">
              ES
            </button>
          </div>
          {usuario ? (
            <a className="boton-cuenta" href={usuario.rol === "admin" ? "#admin" : "#account"} title={usuario.nombre}>
              <span className="avatar" aria-hidden="true">{usuario.nombre.trim().charAt(0).toUpperCase()}</span>
              <span className="nombre-cuenta">{usuario.nombre.split(" ")[0]}</span>
              {usuario.rol === "admin" && <span className="insignia">ADMIN</span>}
            </a>
          ) : (
            <a className="boton-cuenta sin-sesion" href="#account">
              <LogIn aria-hidden="true" size={16} />
              <span className="nombre-cuenta">{t("Sign in", "Entrar")}</span>
            </a>
          )}
        </div>
      </header>
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
      <main id="main-content" className="mvp-main" key={page}>
        {page !== "home" && (
          <h1 ref={heading} tabIndex={-1}>
            {titles[page]}
          </h1>
        )}
        {page === "home" && (
          <>
            <section className="dial-inicio" aria-labelledby="titulo-inicio">
              <div className="dial-texto">
                <h1 ref={heading} tabIndex={-1} id="titulo-inicio">
                  {titles.home}
                </h1>
                <div className="dial-lado">
                  <p className="lead">
                    {t(
                      "Where on Earth could we rehearse work at the lunar south pole? Explore a candidate, understand its limits, and find out what to measure next.",
                      "¿Dónde podríamos practicar en la Tierra el trabajo en el polo sur lunar? Explora una candidata, entiende sus límites y descubre qué medir después.",
                    )}
                  </p>
                  <div className="actions">
                    <button className="btn" onClick={() => go("explore")}>
                      {t("Explore a candidate", "Explorar una candidata")}
                      <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
                    </button>
                    <button className="btn sec" onClick={() => go("guide")}>
                      {t("How it works", "Cómo funciona")}
                    </button>
                  </div>
                  <button
                    className="texto-boton"
                    onClick={() => {
                      setQuery("");
                      setTour(0);
                      setPaused(
                        window.matchMedia("(prefers-reduced-motion: reduce)")
                          .matches,
                      );
                      setRemaining(15);
                      location.hash = "home";
                    }}
                  >
                    {t("Take the 90-second tour", "Recorrido de 90 segundos")}
                  </button>
                </div>
              </div>
              <Nomograma />
            </section>
            <section className="noche-lunar" aria-labelledby="titulo-noche">
              <div className="noche-cabeza">
                <h2 id="titulo-noche">
                  {t(
                    "At Mons Mouton the Sun never climbs above 7°.",
                    "En Mons Mouton el Sol nunca sube más de 7°.",
                  )}
                </h2>
                <p>
                  {t(
                    "So every hill throws a shadow kilometres long. Below is the real relief (LOLA, 60 m) under the Sun of the 2027 summer lunation.",
                    "Por eso cada colina proyecta una sombra de kilómetros. Abajo está el relieve real (LOLA, 60 m) bajo el Sol de la lunación de verano de 2027.",
                  )}
                </p>
              </div>
              <Suspense
                fallback={
                  <div className="escena cargando" style={{ height: 480 }}>
                    {t("Loading the 3D terrain…", "Cargando el terreno 3D…")}
                  </div>
                }
              >
                <HeroTerreno motor={motor} onAbrir={() => go("lab")} />
              </Suspense>
              <nav
                className="puertas"
                aria-label={t("What you can do here", "Qué puedes hacer aquí")}
              >
                {(
                  [
                    [
                      "lab",
                      Moon,
                      t("Park a rover", "Estaciona un rover"),
                      t(
                        "Click the real lunar relief, pick a season and watch the battery through the night.",
                        "Haz clic en el relieve lunar real, elige una estación y mira la batería durante la noche.",
                      ),
                      t("3D lab", "Laboratorio 3D"),
                    ],
                    [
                      "compare",
                      Earth,
                      t("Compare two worlds", "Compara dos mundos"),
                      t(
                        "The same rover under the same Sun on the Moon and on Earth: shadows, power, gravity, time.",
                        "El mismo rover bajo el mismo Sol en la Luna y en la Tierra: sombras, energía, gravedad, tiempo.",
                      ),
                      t("Earth / Moon in 3D", "Tierra / Luna en 3D"),
                    ],
                    [
                      "explore",
                      MapPin,
                      t("Choose a rehearsal site", "Elige un sitio de ensayo"),
                      t(
                        "Open a candidate, read compatibility and evidence separately, then put candidates side by side.",
                        "Abre una candidata, lee compatibilidad y evidencia por separado y pon candidatas lado a lado.",
                      ),
                      t("Candidates", "Candidatas"),
                    ],
                    [
                      "guide",
                      Sunset,
                      t("Measure a real shadow", "Mide una sombra real"),
                      t(
                        "A 0.50 m board at sunset is enough to test the Sun model on real ground.",
                        "Una tablita de 0,50 m al atardecer alcanza para probar el modelo del Sol en terreno real.",
                      ),
                      t("Field kit", "Kit de campo"),
                    ],
                  ] as const
                ).map(([to, Icono, h, p, cta]) => (
                  <a
                    className="puerta"
                    key={to}
                    href={`#${to}`}
                    onClick={() => setTour(null)}
                  >
                    <Icono aria-hidden="true" />
                    <strong>{h}</strong>
                    <span>{p}</span>
                    <em>
                      {cta}
                      <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
                    </em>
                  </a>
                ))}
              </nav>
              <p className="nota-analogo">
                {t(
                  "A terrestrial analog is a practice site. It never reproduces every condition on the Moon.",
                  "Un análogo terrestre es un lugar de ensayo. Nunca reproduce todas las condiciones de la Luna.",
                )}
              </p>
            </section>
          </>
        )}
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
        {page === "explore" && (
          <>
            <p className="lead">
              {t(
                "Forty parcels of 3 × 3 km in Payunia, plus the controls, ranked by the scoring engine. Pick one to read its card. This page shows the published ranking; it does not compute a new one.",
                "Cuarenta parcelas de 3 × 3 km en Payunia, más los controles, ordenadas por el motor de puntaje. Elegí una para leer su ficha. Esta página muestra el ranking publicado; no calcula uno nuevo.",
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
                  placeholder="Payunia / P-27"
                />
              </label>
            </div>
            <p className="notice">
              {operation === "materials"
                ? t(
                    "Materials are marked as not comparable: no candidate can establish material similarity until it is measured on the ground.",
                    "Los materiales figuran como no comparables: ninguna candidata permite afirmar similitud de materiales hasta medirlos en el terreno.",
                  )
                : t(
                    "Terrain and illumination can support a rehearsal. Earth’s atmosphere and gravity remain different.",
                    "El relieve y la iluminación pueden servir para un ensayo. La atmósfera y la gravedad terrestres siguen siendo diferentes.",
                  )}
            </p>
            {(() => {
              const normal = (e: string) =>
                e === "analogo_sostenido" ? "sostenido" : e === "no_podemos_concluir" ? "no_puede" : e;
              const q = query.trim().toLocaleLowerCase();
              const lista = ranking.filter(
                (e) =>
                  (mostrarControles || !e.control) &&
                  (!q || `${e.id} ${e.nombre}`.toLocaleLowerCase().includes(q)),
              );
              const controlNombre = (e: EntradaRanking) =>
                e.control === "positivo"
                  ? t("Mons Mouton itself · positive control", "Mons Mouton mismo · control positivo")
                  : e.control === "positivo_ruido"
                    ? t("Mons Mouton with noise · control", "Mons Mouton con ruido · control")
                    : e.control
                      ? t("Médanos del Chaco · negative control", "Médanos del Chaco · control negativo")
                      : e.nombre.replace(/^Payunia /, "Payunia · ");
              return (
                <div className="explorar">
                  <div className="ranking-caja">
                    <div className="ranking-cabeza">
                      <span>
                        {t(`${lista.length} of ${ranking.length}`, `${lista.length} de ${ranking.length}`)} ·{" "}
                        {t("compatibility C, threshold", "compatibilidad C, umbral")} {umbral.toLocaleString(language)}
                      </span>
                      <label className="casilla">
                        <input
                          type="checkbox"
                          checked={mostrarControles}
                          onChange={(e) => setMostrarControles(e.target.checked)}
                        />
                        {t("Show controls", "Mostrar controles")}
                      </label>
                    </div>
                    {ranking.length === 0 ? (
                      <p className="muted" role="status">
                        {t("Loading the ranking…", "Cargando el ranking…")}
                      </p>
                    ) : lista.length === 0 ? (
                      <div role="status" className="notice">
                        <p>{t("No matching candidates.", "No hay candidatas que coincidan.")}</p>
                        <button className="btn sec" onClick={() => setQuery("")}>
                          {t("Clear search", "Limpiar búsqueda")}
                        </button>
                      </div>
                    ) : (
                      <ol className="ranking" aria-label={t("Ranked candidates and controls", "Candidatas y controles ordenados")}>
                        {lista.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              className={e.id === candidateId ? "fila-rank activa" : "fila-rank"}
                              aria-current={e.id === candidateId ? "true" : undefined}
                              onClick={() => elegirCandidata(e.id)}
                            >
                              <span className="rank-pos mono">{e.orden ?? "—"}</span>
                              <span className="rank-nombre">
                                <strong>{e.id}</strong>
                                <span>{controlNombre(e)}</span>
                              </span>
                              <span className="rank-barra" aria-hidden="true">
                                <i style={{ width: `${100 * Math.max(0, Math.min(1, e.C ?? 0))}%` }} />
                                <b style={{ left: `${100 * umbral}%` }} />
                              </span>
                              <span className="rank-c mono">{e.C === null ? "—" : e.C.toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className="rank-etq" data-tono={normal(e.etiqueta)}>
                                <Marca tono={normal(e.etiqueta)} size={14} />
                                <span>{verdicts[normal(e.etiqueta)] ?? e.etiqueta}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <aside className="panel elegida" aria-live="polite">
                    {status === "ready" && ficha ? (
                      <>
                        <h2>
                          {ficha.id} · {ficha.lugar.nombre}
                        </h2>
                        <p className="mono muted">
                          {ficha.lugar.region} · {ficha.lugar.lat}, {ficha.lugar.lon}
                        </p>
                        <span className="verdict" data-tono={ficha.etiqueta} key={ficha.id}>
                          <Marca tono={ficha.etiqueta} />
                          {verdicts[ficha.etiqueta] ?? ficha.etiqueta}
                        </span>
                        <div className="metrics chicas">
                          <div>
                            <strong key={`c${ficha.id}`}>{ficha.C === null ? number(null) : <Contador valor={ficha.C} formato={number} />}</strong>
                            <span>{t("Compatibility (C)", "Compatibilidad (C)")}</span>
                          </div>
                          <div>
                            <strong key={`e${ficha.id}`}><Contador valor={ficha.E} formato={number} /></strong>
                            <span>{t("Evidence (E)", "Evidencia (E)")}</span>
                          </div>
                        </div>
                        <p>{dataText(ficha.resumen)}</p>
                        <div className="actions">
                          <button className="btn" onClick={() => go("card")}>
                            {t("Open the card", "Abrir la ficha")}
                            <ArrowRight aria-hidden="true" size={16} />
                          </button>
                          <a href="#compare">{t("Compare with the Moon", "Comparar con la Luna")}</a>
                        </div>
                      </>
                    ) : (
                      <p className="muted" role="status">
                        {status === "error"
                          ? t("The card could not be loaded.", "No se pudo cargar la ficha.")
                          : t("Loading the card…", "Cargando la ficha…")}
                      </p>
                    )}
                  </aside>
                </div>
              );
            })()}
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
              <span className="verdict" data-tono={ficha.etiqueta}>
                <Marca tono={ficha.etiqueta} />
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
                    <strong>{ficha.C === null ? number(null) : <Contador valor={ficha.C} formato={number} />}</strong>
                    <span>{t("Compatibility (C)", "Compatibilidad (C)")}</span>
                  </div>
                  <div>
                    <strong><Contador valor={ficha.E} formato={number} /></strong>
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
                  {ficha.maqueta
                    ? t(
                        "Example values from the candidate file.",
                        "Valores de ejemplo del archivo de la candidata.",
                      )
                    : t(
                        "Values from the candidate file, computed by the scoring engine.",
                        "Valores del archivo de la candidata, calculados por el motor de puntaje.",
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
                  {ficha.maqueta
                    ? t(
                        "Example rehearsal window",
                        "Ventana de ensayo de ejemplo",
                      )
                    : t(
                        "Rehearsal windows (Sun from 7° to 1.5°)",
                        "Ventanas de ensayo (Sol de 7° a 1,5°)",
                      )}
                </h2>
                {ficha.horario.map((h, i) => (
                  <p key={i}>
                    <time>{h.fecha}</time> · {h.desde}–{h.hasta} (UTC−3)
                  </p>
                ))}
                <p className="muted">
                  {ficha.maqueta
                    ? t(
                        "Historical mock schedule. It is not a forecast or a recommendation for today.",
                        "Horario histórico de maqueta. No es un pronóstico ni una recomendación para hoy.",
                      )
                    : t(
                        "Computed by the physics engine from the Sun's position over a flat horizon. Nearby hills can shorten a window. It is not a recommendation for today.",
                        "Calculado por el motor físico con la posición del Sol sobre un horizonte liso. Los cerros cercanos pueden acortar una ventana. No es una recomendación para hoy.",
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
        {page === "community" && (
          <Comunidad servidor={servidor} usuario={usuario} onUsuario={setUsuario} irA={(p) => go(p as Page)} />
        )}
        {page === "account" && (
          <Cuenta servidor={servidor} usuario={usuario} onUsuario={setUsuario} irA={(p) => go(p as Page)} />
        )}
        {page === "admin" && <Admin servidor={servidor} usuario={usuario} irA={(p) => go(p as Page)} />}
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
                <span className="verdict" data-tono={status === "ready" ? "sostenido" : undefined}>
                  <Marca tono={status === "ready" ? "pasa" : "pendiente"} />
                  {status === "ready"
                    ? t("File structure checked", "Estructura de archivos comprobada")
                    : t("Not checked", "Sin comprobar")}
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
                {manifest?.maqueta
                  ? t(
                      "These are declarations in mock data. Source files and their hashes have not been independently verified.",
                      "Son declaraciones en datos de maqueta. Los archivos fuente y sus hashes no fueron verificados de forma independiente.",
                    )
                  : t(
                      "Each source is declared in the manifest with its licence and the SHA-256 written when the data was exported. The app shows them as declared; it does not download the sources again to check them.",
                      "Cada fuente figura en el manifiesto con su licencia y el SHA-256 registrado al exportar los datos. La app las muestra tal como están declaradas; no vuelve a descargar las fuentes para comprobarlas.",
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
            <dl className="preguntas">
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
                  mock
                    ? t(
                        "Can I trust the example numbers?",
                        "¿Puedo confiar en las cifras de ejemplo?",
                      )
                    : t(
                        "Where do the numbers come from?",
                        "¿De dónde salen las cifras?",
                      ),
                  mock
                    ? t(
                        "They demonstrate the interface, not a scientific conclusion. The mock banner stays visible until the source files declare real data.",
                        "Sirven para demostrar la interfaz, no una conclusión científica. El aviso de maqueta permanece mientras los archivos declaren datos de ejemplo.",
                      )
                    : t(
                        "From the exported files listed under Verification, each with its source and SHA-256. If a file is ever marked as demonstration data, a mock banner appears at the top of every page.",
                        "De los archivos exportados que figuran en Verificación, cada uno con su fuente y su SHA-256. Si algún archivo se marca como dato de demostración, aparece un aviso de maqueta arriba en todas las páginas.",
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
                <div key={h}>
                  <dt>{h}</dt>
                  <dd>{p}</dd>
                </div>
              ))}
            </dl>
            <section className="impacto" aria-labelledby="impacto-titulo">
              <div>
                <h2 id="impacto-titulo">{t("Why this matters", "Por qué importa")}</h2>
                <p>
                  {t(
                    "Artemis and its robotic precursors will work where the Sun grazes the ground and the night can outlast any battery. Teams rehearse those operations on Earth, but choosing the site is usually a matter of tradition and travel budget. TERRA-X turns it into a measurement: the same code, the same 60 m grid, the same Sun geometry on both worlds, and an honest list of what a site cannot teach.",
                    "Artemis y sus robots precursores van a trabajar donde el Sol roza el suelo y la noche puede durar más que cualquier batería. Los equipos ensayan esas operaciones en la Tierra, pero el lugar se elige por costumbre o por presupuesto de viaje. TERRA-X lo convierte en una medición: el mismo código, la misma grilla de 60 m, la misma geometría solar en los dos mundos, y una lista honesta de lo que un sitio no puede enseñar.",
                  )}
                </p>
                <p>
                  {t(
                    "Because every step is open and every file is hashed, a space agency, a university or a rover team anywhere can rerun it for their own candidate region in an afternoon.",
                    "Como cada paso es abierto y cada archivo lleva su huella, una agencia, una universidad o un equipo de rover en cualquier lugar puede repetirlo para su propia región candidata en una tarde.",
                  )}
                </p>
              </div>
              <div>
                <h2>{t("What comes next", "Qué sigue")}</h2>
                <ul>
                  <li>{t("Measure the two missing properties on the ground (surface material, fine traversability): evidence E would rise from 0.8 to 1.0 and the bounds L–U would close.", "Medir en el terreno las dos propiedades que faltan (material superficial, transitabilidad fina): la evidencia E subiría de 0,8 a 1,0 y los límites L–U se cerrarían.")}</li>
                  <li>{t("Earth terrain in 3D from the same Copernicus grid, so the Two Worlds stage shows a real parcel instead of a flat stand-in.", "Terreno terrestre en 3D desde la misma grilla de Copernicus, para que Dos Mundos muestre una parcela real en vez de un plano ilustrativo.")}</li>
                  <li>{t("More regions through the same pipeline (the Puna and the Atacama are already in the Sun queries), and a field campaign with the 0.50 m board to close the loop on real shadows.", "Más regiones por la misma cadena (la Puna y Atacama ya están en las consultas del Sol), y una campaña de campo con la tablita de 0,50 m para cerrar el círculo con sombras reales.")}</li>
                  <li>{t("A live engine deployed next to the site, so any date between 1901 and 2049 can be explored online, not only the two exported lunations.", "Un motor en vivo desplegado junto al sitio, para explorar en línea cualquier fecha entre 1901 y 2049, no solo las dos lunaciones exportadas.")}</li>
                </ul>
              </div>
            </section>
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
        <a href="#checks">
          {t("Data and limitations", "Datos y limitaciones")}
        </a>
      </footer>
      <AsistenteSI
        pagina={page}
        ficha={ficha}
        manifest={manifest}
        indice={candidateIndex}
        elevacionSolDeg={sol.elevacion}
        motorEnVivo={Boolean(motor)}
        idioma={language === "es" ? "es" : "en"}
        onNavegar={(dest) => go(dest as Page)}
        onSeleccionarCandidata={(id) => {
          setCandidateId(id);
          const url = new URL(location.href);
          url.searchParams.set("candidate", id);
          history.replaceState(null, "", url);
        }}
        onAjustarSol={(deg) => sol.setElevacion(deg)}
      />
      {page !== "home" && <Horizon />}
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
/** Shadow of a vertical 0.50 m board on flat ground: height / tan(Sun elevation). */
function sombraTablita(elevacionDeg: number) {
  return 0.5 / Math.tan((elevacionDeg * Math.PI) / 180);
}
/**
 * Home: a side-view shadow nomogram. A vertical 0.50 m board stands on the horizon; rays at
 * 10°, 7°, 5°, 3° and 1.5° land where its shadow ends (0.50 / tan e). Dragging along the ground
 * sets the shadow length, and the Sun elevation follows from it (e = atan(board / shadow)).
 */
function Nomograma() {
  const { t, language } = useLanguage();
  const sol = useSol();
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(1200);
  const [mostrado, setMostrado] = useState<number | null>(null);
  const arrastrando = useRef(false);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // One authored moment: the Sun sinks from 10° to the current elevation and the shadow runs out.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const desde = 10;
    const hasta = sol.elevacion;
    const inicio = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const k = Math.min(1, (ahora - inicio - 250) / 1700);
      if (k < 0) {
        setMostrado(desde);
      } else {
        const suave = 1 - Math.pow(1 - k, 3);
        setMostrado(desde + (hasta - desde) * suave);
      }
      if (k < 1) id = requestAnimationFrame(paso);
      else setMostrado(null);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const e = mostrado ?? sol.elevacion;
  const W = ancho;
  const chico = W < 640;
  const H = Math.max(26, Math.min(58, W / 21)); // the 0.50 m board, in pixels
  const alto = Math.round(H + (chico ? 140 : 136));
  const x0 = Math.max(28, Math.round(W * 0.07));
  const suelo = alto - (chico ? 58 : 66);
  const tope = suelo - H;
  const rad = (g: number) => (g * Math.PI) / 180;
  const largo = (g: number) => H / Math.tan(rad(g));
  const fmt = (v: number, d: number) =>
    v.toLocaleString(language, { minimumFractionDigits: d, maximumFractionDigits: d });
  const marcas = chico ? [10, 7, 3] : [10, 7, 5, 3, 1.5];
  const punta = x0 + largo(e);
  const fuera = punta > W - 16;
  const solX = Math.max(12, x0 - (chico ? 22 : 44));
  const solY = tope - (x0 - solX) * Math.tan(rad(e));

  const desdePuntero = (clientX: number) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    const px = clientX - r.left;
    if (px <= x0 + 4) return;
    const g = (Math.atan(H / (px - x0)) * 180) / Math.PI;
    setMostrado(null);
    sol.setElevacion(Math.round(Math.max(1.5, Math.min(10, g)) * 2) / 2);
  };

  return (
    <div className="nomograma" ref={caja}>
      <svg
        width={W}
        height={alto}
        viewBox={`0 0 ${W} ${alto}`}
        role="slider"
        tabIndex={0}
        aria-label={t(
          "Sun elevation. Drag the shadow along the ground; the Sun follows.",
          "Elevación del Sol. Arrastra la sombra sobre el suelo; el Sol la sigue.",
        )}
        aria-valuemin={1.5}
        aria-valuemax={10}
        aria-valuenow={sol.elevacion}
        aria-valuetext={t(
          `Sun ${fmt(sol.elevacion, 1)}°, a 0.50 m board casts ${fmt(sombraTablita(sol.elevacion), 2)} m of shadow`,
          `Sol ${fmt(sol.elevacion, 1)}°, una tablita de 0,50 m proyecta ${fmt(sombraTablita(sol.elevacion), 2)} m de sombra`,
        )}
        onKeyDown={(ev) => {
          const d = ev.key === "ArrowRight" || ev.key === "ArrowUp" ? 0.5 : ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? -0.5 : 0;
          if (!d) return;
          ev.preventDefault();
          setMostrado(null);
          sol.setElevacion((v) => v + d);
        }}
        onPointerDown={(ev) => {
          arrastrando.current = true;
          (ev.currentTarget as SVGSVGElement).setPointerCapture(ev.pointerId);
          desdePuntero(ev.clientX);
        }}
        onPointerMove={(ev) => {
          if (arrastrando.current) desdePuntero(ev.clientX);
        }}
        onPointerUp={() => {
          arrastrando.current = false;
        }}
      >
        <rect className="n-noche" x="0" y={suelo} width={W} height={alto - suelo} />
        {marcas.map((m) => {
          const fin = x0 + largo(m);
          const visible = fin < W - 70;
          return (
            <g key={m} className={Math.abs(m - e) < 0.25 && mostrado === null ? "n-rayo activo" : "n-rayo"}>
              <line x1={x0} y1={tope} x2={Math.min(fin, W)} y2={visible ? suelo : tope + (W - x0) * Math.tan(rad(m))} />
              {visible ? (
                <>
                  <line className="n-marca" x1={fin} y1={suelo} x2={fin} y2={suelo + 8} />
                  <text className="n-etq" x={fin} y={suelo + 26} textAnchor="middle">
                    {fmt(m, m % 1 ? 1 : 0)}°
                  </text>
                  <text className="n-etq tenue" x={fin} y={suelo + 44} textAnchor="middle">
                    {fmt(sombraTablita(m), 2)} m
                  </text>
                </>
              ) : !chico || Math.abs(m - e) < 0.25 ? (
                <text className="n-etq" x={W - 10} y={tope + (W - x0) * Math.tan(rad(m)) - 8} textAnchor="end">
                  {fmt(m, m % 1 ? 1 : 0)}° → {fmt(sombraTablita(m), 1)} m
                </text>
              ) : null}
            </g>
          );
        })}
        <line className="n-horizonte" x1="0" y1={suelo} x2={W} y2={suelo} />
        <rect className="n-sombra" x={x0} y={suelo - 7} width={Math.max(0, Math.min(punta, W) - x0)} height="7" />
        <line className="n-luz" x1={solX} y1={solY} x2={Math.min(punta, W)} y2={fuera ? tope + (W - x0) * Math.tan(rad(e)) : suelo} />
        <rect className="n-tablita" x={x0 - 3} y={tope} width="6" height={H} />
        <text className="n-etq" x={chico ? x0 + 8 : x0 - 10} y={chico ? tope - 8 : tope + H / 2} textAnchor={chico ? "start" : "end"}>
          0.50 m
        </text>
        <circle className="n-sol" cx={solX} cy={solY} r={chico ? 8 : 11} />
        {!fuera && (
          <g className="n-punta">
            <line x1={punta} y1={suelo - 30} x2={punta} y2={suelo} />
            <text x={punta} y={suelo - 40} textAnchor={punta > W - 140 ? "end" : "middle"}>
              {fmt(sombraTablita(e), 2)} m
            </text>
          </g>
        )}
        <text className="n-lectura" x={Math.max(16, solX - 11)} y="24">
          {t(`Sun ${fmt(e, 1)}°`, `Sol ${fmt(e, 1)}°`)}
        </text>
        <text className="n-ayuda" x={Math.max(16, solX - 11)} y="44">
          {t("Drag the shadow along the ground — the Sun follows", "Arrastra la sombra sobre el suelo: el Sol la sigue")}
        </text>
      </svg>
    </div>
  );
}
function Horizon() {
  const { t, language } = useLanguage();
  const sol = useSol();
  const marcas = [1.5, 3, 5, 7, 10];
  return (
    <div className="mvp-horizon">
      <label htmlFor="global-sun">
        {t("Sun elevation", "Elevación del Sol")}{" "}
        <strong>{sol.elevacion.toLocaleString(language)}°</strong>
      </label>
      <div className="regla-sol">
        <input
          id="global-sun"
          className="gnomon"
          type="range"
          min="1.5"
          max="10"
          step="0.5"
          value={sol.elevacion}
          onChange={(e) => sol.setElevacion(Number(e.target.value))}
          aria-describedby="global-sun-ayuda"
        />
        <div className="marcas" aria-hidden="true">
          {marcas.map((m) => (
            <span key={m} style={{ left: `calc(11px + (100% - 22px) * ${(m - 1.5) / 8.5})` }}>
              {m.toLocaleString(language)}°
            </span>
          ))}
        </div>
      </div>
      <output id="global-sun-ayuda" htmlFor="global-sun">
        {t("0.50 m board → ", "tablita de 0,50 m → ")}
        {sombraTablita(sol.elevacion).toLocaleString(language, {
          maximumFractionDigits: 2,
        })}{" "}
        {t("m of shadow", "m de sombra")}
      </output>
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
