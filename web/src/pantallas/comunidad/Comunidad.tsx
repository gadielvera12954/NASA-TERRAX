/**
 * Community: science outreach written by people the TERRA-X admins verified. Anyone can read;
 * verified authors write; every article is reviewed by an admin before it is published.
 */
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Clock, PenLine, Send } from "lucide-react";
import { Articulo, Categoria, Usuario, cuentas } from "../../datos/cuentas";
import { Autoria, Aviso, SinServidor, Texto, useTextos } from "./comun";

const ESTADOS_ES: Record<Articulo["estado"], [string, string]> = {
  borrador: ["Draft", "Borrador"],
  revision: ["In review", "En revisión"],
  publicado: ["Published", "Publicado"],
  rechazado: ["Changes requested", "Con cambios pedidos"],
};

export default function Comunidad({ servidor, usuario, onUsuario, irA }: { servidor: boolean; usuario: Usuario | null; onUsuario: (u: Usuario | null) => void; irA: (p: string) => void }) {
  const { t, language, categorias, fecha } = useTextos();
  const [lista, setLista] = useState<Articulo[]>();
  const [abierto, setAbierto] = useState<Articulo>();
  const [mios, setMios] = useState<Articulo[]>([]);
  const [editando, setEditando] = useState<Partial<Articulo> | null>(null);
  const [error, setError] = useState<string>();
  const [filtro, setFiltro] = useState<Categoria | "todas">("todas");

  const cargar = () => {
    cuentas.publicados().then((r) => setLista(r.articulos)).catch((e) => setError(e.message));
    if (usuario) cuentas.mios().then((r) => setMios(r.articulos)).catch(() => {});
  };
  useEffect(() => {
    if (servidor) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servidor, usuario?.id]);

  if (!servidor) return <SinServidor />;

  const puedeEscribir = !!usuario && (usuario.rol === "admin" || (usuario.rol === "autor" && usuario.verificado));

  if (abierto)
    return (
      <article className="articulo">
        <button className="texto-boton volver" onClick={() => setAbierto(undefined)}>
          <ArrowLeft aria-hidden="true" size={16} /> {t("All articles", "Todos los artículos")}
        </button>
        <span className="cat">{categorias[abierto.categoria]}</span>
        <h2 className="articulo-titulo">{abierto.titulo}</h2>
        <p className="lead">{abierto.resumen}</p>
        <div className="articulo-meta">
          <Autoria autor={abierto.autor} />
          <span className="mono muted">{fecha(abierto.publicado_en ?? abierto.actualizado)}</span>
        </div>
        <div className="articulo-cuerpo">
          <Texto texto={abierto.cuerpo ?? ""} />
        </div>
        {abierto.fuentes && (
          <section className="articulo-fuentes">
            <h3>{t("Sources", "Fuentes")}</h3>
            <Texto texto={abierto.fuentes} />
          </section>
        )}
        <p className="muted nota-revision">
          {t(
            "Reviewed and published by the TERRA-X admins. Numbers that come from the engine can be checked on the Explore and Verification pages.",
            "Revisado y publicado por los admins de TERRA-X. Las cifras que vienen del motor se pueden comprobar en Explorar y Verificación.",
          )}
        </p>
      </article>
    );

  const publicados = (lista ?? []).filter((a) => filtro === "todas" || a.categoria === filtro);

  return (
    <div className="comunidad">
      <div className="comunidad-lista">
        <div className="filtro-cat" role="group" aria-label={t("Category", "Categoría")}>
          {(["todas", "explicacion", "metodo", "campo", "noticia"] as const).map((c) => (
            <button key={c} aria-pressed={filtro === c} onClick={() => setFiltro(c)}>
              {c === "todas" ? t("All", "Todo") : categorias[c]}
            </button>
          ))}
        </div>
        <Aviso texto={error} />
        {lista === undefined ? (
          <p className="muted" role="status">{t("Loading…", "Cargando…")}</p>
        ) : publicados.length === 0 ? (
          <div className="vacio">
            <h3>{t("No articles here yet", "Todavía no hay artículos acá")}</h3>
            <p className="muted">
              {t(
                "Verified authors write explainers, methods and field notes about the lunar south pole and its Earth analogs. Every article is reviewed by an admin before it appears here.",
                "Los autores verificados escriben explicaciones, métodos y notas de campo sobre el polo sur lunar y sus análogos en la Tierra. Cada artículo lo revisa un admin antes de aparecer acá.",
              )}
            </p>
          </div>
        ) : (
          <ol className="articulos">
            {publicados.map((a) => (
              <li key={a.id}>
                <button
                  className="tarjeta-art"
                  onClick={() => cuentas.articulo(a.id).then((r) => setAbierto(r.articulo)).catch((e) => setError(e.message))}
                >
                  <span className="cat">{categorias[a.categoria]}</span>
                  <strong className="tarjeta-titulo">{a.titulo}</strong>
                  <span className="tarjeta-resumen">{a.resumen}</span>
                  <span className="tarjeta-pie">
                    <Autoria autor={a.autor} />
                    <span className="mono muted">{fecha(a.publicado_en)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <aside className="comunidad-lado">
        {!usuario ? (
          <section className="panel">
            <h2>{t("Write for TERRA-X", "Escribí para TERRA-X")}</h2>
            <p>
              {t(
                "Scientists, teachers and students can publish here once an admin verifies who they are. Readers never need an account.",
                "Científicos, docentes y estudiantes pueden publicar acá cuando un admin verifica quiénes son. Para leer nunca hace falta una cuenta.",
              )}
            </p>
            <button className="btn" onClick={() => irA("account")}>
              {t("Sign in or create an account", "Entrar o crear una cuenta")}
            </button>
          </section>
        ) : puedeEscribir ? (
          <section className="panel">
            <h2>{t("Your articles", "Tus artículos")}</h2>
            {!editando && (
              <button className="btn" onClick={() => setEditando({ categoria: "explicacion", idioma: language === "es" ? "es" : "en" })}>
                <PenLine aria-hidden="true" size={16} /> {t("Write an article", "Escribir un artículo")}
              </button>
            )}
            {editando && (
              <Editor
                inicial={editando}
                onCancelar={() => setEditando(null)}
                onGuardado={() => {
                  setEditando(null);
                  cargar();
                }}
              />
            )}
            {mios.length > 0 && (
              <ul className="mis-articulos">
                {mios.map((a) => (
                  <li key={a.id}>
                    <span className={`estado-art ${a.estado}`}>{ESTADOS_ES[a.estado][language === "es" ? 1 : 0]}</span>
                    <strong>{a.titulo}</strong>
                    {a.motivo && a.estado === "rechazado" && <span className="motivo">{a.motivo}</span>}
                    {a.estado !== "publicado" && !editando && (
                      <button className="texto-boton" onClick={() => setEditando(a)}>
                        {t("Edit", "Editar")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <Verificacion usuario={usuario} onUsuario={onUsuario} />
        )}
      </aside>
    </div>
  );
}

function Verificacion({ usuario, onUsuario }: { usuario: Usuario; onUsuario: (u: Usuario) => void }) {
  const { t } = useTextos();
  const [motivo, setMotivo] = useState("");
  const [afiliacion, setAfiliacion] = useState(usuario.afiliacion);
  const [error, setError] = useState<string>();
  if (usuario.solicitud_pendiente)
    return (
      <section className="panel">
        <h2>
          <Clock aria-hidden="true" size={20} /> {t("Verification requested", "Verificación pedida")}
        </h2>
        <p>{t("An admin will review your request. When it is approved you will be able to write here.", "Un admin va a revisar tu pedido. Cuando lo apruebe vas a poder escribir acá.")}</p>
      </section>
    );
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      onUsuario((await cuentas.pedirVerificacion(motivo, afiliacion)).usuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <section className="panel">
      <h2>{t("Become a verified author", "Convertite en autor verificado")}</h2>
      <p className="muted">{t("Tell the admins who you are and what you would like to explain.", "Contale a los admins quién sos y qué te gustaría explicar.")}</p>
      <form className="form-cuenta" onSubmit={enviar}>
        <label>
          {t("Affiliation", "Afiliación")}
          <input value={afiliacion} onChange={(e) => setAfiliacion(e.target.value)} maxLength={120} />
        </label>
        <label>
          {t("Why should we verify you?", "¿Por qué deberíamos verificarte?")}
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={20} maxLength={1000} rows={4} required />
        </label>
        <Aviso texto={error} />
        <button className="btn" type="submit">
          <Send aria-hidden="true" size={16} /> {t("Send request", "Enviar pedido")}
        </button>
      </form>
    </section>
  );
}

function Editor({ inicial, onCancelar, onGuardado }: { inicial: Partial<Articulo>; onCancelar: () => void; onGuardado: () => void }) {
  const { t, categorias } = useTextos();
  const [a, setA] = useState<Partial<Articulo>>(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const campo = (k: keyof Articulo) => (e: { target: { value: string } }) => setA((x) => ({ ...x, [k]: e.target.value }));
  const guardar = async (borrador: boolean) => {
    setError(undefined);
    setEnviando(true);
    try {
      const datos = { titulo: a.titulo, resumen: a.resumen, cuerpo: a.cuerpo, categoria: a.categoria, idioma: a.idioma, fuentes: a.fuentes, borrador };
      if (a.id) await cuentas.editar(a.id, datos);
      else await cuentas.crear(datos);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  };
  const largo = (a.cuerpo ?? "").length;
  return (
    <form className="form-cuenta editor" onSubmit={(e) => { e.preventDefault(); guardar(false); }}>
      <label>
        {t("Title", "Título")}
        <input value={a.titulo ?? ""} onChange={campo("titulo")} minLength={8} maxLength={140} required />
      </label>
      <div className="dos">
        <label>
          {t("Category", "Categoría")}
          <select value={a.categoria} onChange={campo("categoria")}>
            {(Object.keys(categorias) as Categoria[]).map((c) => (
              <option key={c} value={c}>{categorias[c]}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Language", "Idioma")}
          <select value={a.idioma} onChange={campo("idioma")}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </div>
      <label>
        {t("Summary (one or two sentences)", "Resumen (una o dos oraciones)")}
        <textarea value={a.resumen ?? ""} onChange={campo("resumen")} minLength={20} maxLength={400} rows={2} required />
      </label>
      <label>
        {t("Article", "Artículo")}
        <textarea value={a.cuerpo ?? ""} onChange={campo("cuerpo")} minLength={200} maxLength={20000} rows={10} required />
        <span className="muted contador-car">
          {largo} / 20000 · {t("blank line = new paragraph · **bold** · - list", "línea en blanco = párrafo nuevo · **negrita** · - lista")}
        </span>
      </label>
      <label>
        {t("Sources (one per line)", "Fuentes (una por línea)")}
        <textarea value={a.fuentes ?? ""} onChange={campo("fuentes")} maxLength={2000} rows={3} />
      </label>
      <Aviso texto={error} />
      <div className="actions">
        <button className="btn" type="submit" disabled={enviando}>
          <Send aria-hidden="true" size={16} /> {t("Send for review", "Enviar a revisión")}
        </button>
        <button className="btn sec" type="button" disabled={enviando} onClick={() => guardar(true)}>
          {t("Save draft", "Guardar borrador")}
        </button>
        <button className="texto-boton" type="button" onClick={onCancelar}>
          {t("Cancel", "Cancelar")}
        </button>
      </div>
    </form>
  );
}
