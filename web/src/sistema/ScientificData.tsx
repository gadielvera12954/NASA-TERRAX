import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/Language";
interface Test {
  id: string;
  nombre_en: string;
  nombre_es: string;
  estado: "pasa" | "falla" | "pendiente";
  meta: { texto: string; texto_en?: string };
  resultado: { texto: string; texto_en?: string };
}
interface Report {
  resumen: { total: number; pasa: number; falla: number; pendiente: number };
  pruebas: Test[];
}
export function ScientificData() {
  const { t, language } = useLanguage();
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/data/pruebas.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((v) => {
        if (
          !Array.isArray(v.pruebas) ||
          !v.resumen ||
          !v.pruebas.every(
            (p: Test) =>
              p &&
              typeof p.nombre_en === "string" &&
              typeof p.nombre_es === "string" &&
              ["pasa", "falla", "pendiente"].includes(p.estado) &&
              p.meta &&
              p.resultado,
          )
        )
          throw new Error();
        if (active) setReport(v);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel">
      <h2>{t("Scientific tests", "Pruebas científicas")}</h2>
      {report ? (
        <>
          <p>
            {report.resumen.total} {t("tests", "pruebas")} ·{" "}
            {report.resumen.pasa} {t("passed", "aprobadas")} ·{" "}
            {report.resumen.falla} {t("failed", "fallidas")} ·{" "}
            {report.resumen.pendiente} {t("pending", "pendientes")}
          </p>
          <p className="muted">
            {t(
              "Exported by the physics engine. Pending tests remain unverified.",
              "Exportadas por el motor físico. Las pruebas pendientes siguen sin verificar.",
            )}
          </p>
          <details>
            <summary>
              {t("See all test results", "Ver todos los resultados")}
            </summary>
            {report.pruebas.map((p) => (
              <section key={p.id}>
                <h3>{language === "es" ? p.nombre_es : p.nombre_en}</h3>
                <span className="verdict">
                  {p.estado === "pasa"
                    ? t("✓ Passed", "✓ Aprobada")
                    : p.estado === "falla"
                      ? t("× Failed", "× Fallida")
                      : t("? Pending", "? Pendiente")}
                </span>
                <p>
                  {language === "es"
                    ? p.resultado.texto
                    : (p.resultado.texto_en ?? p.resultado.texto)}
                </p>
                <p className="muted">
                  {t("Target", "Meta")}:{" "}
                  {language === "es"
                    ? p.meta.texto
                    : (p.meta.texto_en ?? p.meta.texto)}
                </p>
              </section>
            ))}
          </details>
          <a href="/data/pruebas.json" target="_blank" rel="noreferrer">
            {t("Open test report (JSON)", "Abrir informe de pruebas (JSON)")}
          </a>
        </>
      ) : (
        <p role="status">
          {error
            ? t(
                "? Results unavailable; not verified",
                "? Resultados no disponibles; sin verificar",
              )
            : t("Loading test report…", "Cargando informe de pruebas…")}
        </p>
      )}
    </section>
  );
}
