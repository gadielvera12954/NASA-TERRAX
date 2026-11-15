/** Shared bits of the Community, Account and Admin screens. */
import { Fragment } from "react";
import { BadgeCheck, ServerOff } from "lucide-react";
import { Autor, Categoria } from "../../datos/cuentas";
import { useLanguage } from "../../i18n/Language";

export function useTextos() {
  const { t, language } = useLanguage();
  const categorias: Record<Categoria, string> = {
    explicacion: t("Explainer", "Explicación"),
    metodo: t("Method", "Método"),
    campo: t("Field work", "Trabajo de campo"),
    noticia: t("News", "Novedad"),
  };
  const fecha = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric" }) : "—";
  return { t, language, categorias, fecha };
}

export function Autoria({ autor }: { autor: Autor }) {
  const { t } = useLanguage();
  return (
    <span className="autoria">
      <span className="avatar" aria-hidden="true">
        {autor.nombre.trim().charAt(0).toUpperCase()}
      </span>
      <span>
        <strong>{autor.nombre}</strong>
        {autor.verificado && (
          <span className="verificado" title={t("Verified by the TERRA-X admins", "Verificado por los admins de TERRA-X")}>
            <BadgeCheck aria-hidden="true" size={15} />
            {t("Verified", "Verificado")}
          </span>
        )}
        {autor.afiliacion && <span className="afiliacion">{autor.afiliacion}</span>}
      </span>
    </span>
  );
}

/** Paragraphs, bullet lists and **bold**; rendered as text, never as HTML. */
export function Texto({ texto }: { texto: string }) {
  const bloques = texto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((x, i) => (x.startsWith("**") && x.endsWith("**") ? <strong key={i}>{x.slice(2, -2)}</strong> : <Fragment key={i}>{x}</Fragment>));
  return (
    <>
      {bloques.map((b, i) => {
        const lineas = b.split("\n");
        if (lineas.every((l) => /^\s*[-•*]\s+/.test(l)))
          return (
            <ul key={i}>
              {lineas.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        if (/^#{1,3}\s/.test(b)) return <h3 key={i}>{inline(b.replace(/^#{1,3}\s/, ""))}</h3>;
        return <p key={i}>{inline(b.replace(/\n/g, " "))}</p>;
      })}
    </>
  );
}

export function SinServidor() {
  const { t } = useLanguage();
  return (
    <div className="sin-servidor" role="status">
      <ServerOff aria-hidden="true" size={28} />
      <div>
        <h2>{t("Accounts and Community run on the TERRA-X server", "Las cuentas y la Comunidad corren en el servidor de TERRA-X")}</h2>
        <p>
          {t(
            "The public site is static on purpose: no database, nothing to leak. Accounts, verified authors and the admin panel live in the TERRA-X server, which keeps them in its own database. Start it next to the site and this page comes alive:",
            "El sitio público es estático a propósito: sin base de datos, nada que filtrar. Las cuentas, los autores verificados y el panel admin viven en el servidor de TERRA-X, que los guarda en su propia base de datos. Arrancalo junto al sitio y esta página cobra vida:",
          )}
        </p>
        <code className="comando">python -m servidor</code>
      </div>
    </div>
  );
}

export function Aviso({ texto, tipo = "error" }: { texto?: string; tipo?: "error" | "ok" }) {
  if (!texto) return null;
  return (
    <p className={tipo === "ok" ? "aviso-form ok" : "aviso-form"} role={tipo === "ok" ? "status" : "alert"}>
      {texto}
    </p>
  );
}
