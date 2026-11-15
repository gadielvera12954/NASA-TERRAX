/** Admin panel: verify people, review articles, manage roles; every action is audited on the server. */
import { useEffect, useState } from "react";
import { BadgeCheck, Check, FileText, ScrollText, ShieldAlert, Users, X } from "lucide-react";
import { Articulo, RegistroAuditoria, ResumenAdmin, Rol, Usuario, cuentas } from "../../datos/cuentas";
import { Autoria, Aviso, SinServidor, Texto, useTextos } from "./comun";

type Pestana = "solicitudes" | "revision" | "personas" | "auditoria";

export default function Admin({ servidor, usuario, irA }: { servidor: boolean; usuario: Usuario | null; irA: (p: string) => void }) {
  const { t, fecha, categorias } = useTextos();
  const [pestana, setPestana] = useState<Pestana>("solicitudes");
  const [resumen, setResumen] = useState<ResumenAdmin>();
  const [personas, setPersonas] = useState<Usuario[]>([]);
  const [revision, setRevision] = useState<Articulo[]>([]);
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();

  const esAdmin = usuario?.rol === "admin";
  const recargar = () => {
    if (!esAdmin) return;
    cuentas.admin.resumen().then(setResumen).catch((e) => setError(e.message));
    cuentas.admin.usuarios().then((r) => setPersonas(r.usuarios)).catch(() => {});
    cuentas.admin.articulos("revision").then((r) => setRevision(r.articulos)).catch(() => {});
    cuentas.admin.auditoria().then((r) => setAuditoria(r.registros)).catch(() => {});
  };
  useEffect(recargar, [esAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!servidor) return <SinServidor />;
  if (!usuario || !esAdmin)
    return (
      <div className="sin-servidor" role="alert">
        <ShieldAlert aria-hidden="true" size={28} />
        <div>
          <h2>{t("Admins only", "Solo para admins")}</h2>
          <p>{t("Sign in with an admin account to see this panel.", "Entrá con una cuenta admin para ver este panel.")}</p>
          <button className="btn" onClick={() => irA("account")}>{t("Sign in", "Entrar")}</button>
        </div>
      </div>
    );

  const hacer = async (accion: () => Promise<unknown>, mensaje: string) => {
    setError(undefined);
    setOk(undefined);
    try {
      await accion();
      setOk(mensaje);
      setMotivo("");
      setAbierto(null);
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const solicitudes = personas.filter((p) => p.solicitud_pendiente);
  const tarjetas: [string, number | undefined, Pestana][] = [
    [t("Verification requests", "Pedidos de verificación"), resumen?.solicitudes, "solicitudes"],
    [t("Articles in review", "Artículos en revisión"), resumen?.en_revision, "revision"],
    [t("People", "Personas"), resumen?.usuarios, "personas"],
    [t("Published articles", "Artículos publicados"), resumen?.publicados, "revision"],
  ];
  const rolNombre: Record<Rol, string> = { lector: t("Reader", "Lector"), autor: t("Author", "Autor"), admin: "Admin" };

  return (
    <div className="admin">
      <div className="admin-tarjetas">
        {tarjetas.map(([nombre, n, p], i) => (
          <button key={i} className={pestana === p && i < 3 ? "admin-tarjeta activa" : "admin-tarjeta"} onClick={() => setPestana(p)}>
            <strong className="mono">{n ?? "—"}</strong>
            <span>{nombre}</span>
          </button>
        ))}
      </div>

      <div className="segmento pestanas" role="tablist">
        {([
          ["solicitudes", BadgeCheck, t("Verification", "Verificación")],
          ["revision", FileText, t("Review", "Revisión")],
          ["personas", Users, t("People", "Personas")],
          ["auditoria", ScrollText, t("Audit log", "Registro")],
        ] as const).map(([p, Icono, nombre]) => (
          <button key={p} role="tab" aria-selected={pestana === p} aria-pressed={pestana === p} onClick={() => setPestana(p)}>
            <Icono aria-hidden="true" size={16} /> {nombre}
          </button>
        ))}
      </div>
      <Aviso texto={error} />
      <Aviso texto={ok} tipo="ok" />

      {pestana === "solicitudes" && (
        <section>
          {solicitudes.length === 0 ? (
            <p className="muted vacio">{t("No pending requests.", "No hay pedidos pendientes.")}</p>
          ) : (
            <ul className="admin-lista">
              {solicitudes.map((p) => (
                <li key={p.id} className="admin-item">
                  <div>
                    <strong>{p.nombre}</strong> <span className="mono muted">{p.email}</span>
                    {p.afiliacion && <span className="afiliacion"> · {p.afiliacion}</span>}
                    <p className="cita">“{p.solicitud}”</p>
                    <span className="mono muted">{fecha(p.solicitud_en)}</span>
                  </div>
                  <div className="admin-botones">
                    <button className="btn chico" onClick={() => hacer(() => cuentas.admin.cambiar(p.id, { verificado: true }), t(`${p.nombre} is now a verified author.`, `${p.nombre} ahora es autor verificado.`))}>
                      <Check aria-hidden="true" size={16} /> {t("Verify", "Verificar")}
                    </button>
                    <button className="btn sec chico" onClick={() => hacer(() => cuentas.admin.cambiar(p.id, { rechazar_solicitud: true }), t("Request declined.", "Pedido rechazado."))}>
                      <X aria-hidden="true" size={16} /> {t("Decline", "Rechazar")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pestana === "revision" && (
        <section>
          {revision.length === 0 ? (
            <p className="muted vacio">{t("Nothing waiting for review.", "No hay nada esperando revisión.")}</p>
          ) : (
            <ul className="admin-lista">
              {revision.map((a) => (
                <li key={a.id} className="admin-item columna">
                  <div className="admin-art-cabeza">
                    <span className="cat">{categorias[a.categoria]}</span>
                    <strong>{a.titulo}</strong>
                    <Autoria autor={a.autor} />
                  </div>
                  <p>{a.resumen}</p>
                  {abierto === a.id ? (
                    <div className="admin-lectura">
                      <Texto texto={a.cuerpo ?? ""} />
                      {a.fuentes && (
                        <>
                          <h3>{t("Sources", "Fuentes")}</h3>
                          <Texto texto={a.fuentes} />
                        </>
                      )}
                      <label>
                        {t("Reason, if you ask for changes", "Motivo, si pedís cambios")}
                        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} />
                      </label>
                    </div>
                  ) : null}
                  <div className="admin-botones">
                    {abierto !== a.id ? (
                      <button className="btn sec chico" onClick={() => setAbierto(a.id)}>{t("Read it", "Leerlo")}</button>
                    ) : (
                      <>
                        <button className="btn chico" onClick={() => hacer(() => cuentas.admin.decidir(a.id, "publicar"), t("Published.", "Publicado."))}>
                          <Check aria-hidden="true" size={16} /> {t("Publish", "Publicar")}
                        </button>
                        <button className="btn sec chico" disabled={motivo.trim().length < 10} onClick={() => hacer(() => cuentas.admin.decidir(a.id, "rechazar", motivo), t("Changes requested.", "Cambios pedidos."))}>
                          {t("Ask for changes", "Pedir cambios")}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pestana === "personas" && (
        <div className="tabla-scroll">
          <table className="tabla-admin">
            <thead>
              <tr>
                <th>{t("Person", "Persona")}</th>
                <th>{t("Role", "Rol")}</th>
                <th>{t("Verified", "Verificado")}</th>
                <th>{t("Last sign-in", "Último acceso")}</th>
                <th>{t("Account", "Cuenta")}</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.id} className={p.activo === false ? "inactivo" : ""}>
                  <td>
                    <strong>{p.nombre}</strong>
                    <br />
                    <span className="mono muted">{p.email}</span>
                  </td>
                  <td>
                    <select
                      value={p.rol}
                      aria-label={t(`Role of ${p.nombre}`, `Rol de ${p.nombre}`)}
                      disabled={p.id === usuario.id}
                      onChange={(e) => hacer(() => cuentas.admin.cambiar(p.id, { rol: e.target.value as Rol }), t("Role updated.", "Rol actualizado."))}
                    >
                      {(["lector", "autor", "admin"] as Rol[]).map((r) => (
                        <option key={r} value={r}>{rolNombre[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>{p.verificado ? <BadgeCheck aria-label={t("yes", "sí")} size={18} className="ok-icono" /> : <span className="muted">—</span>}</td>
                  <td className="mono muted">{fecha(p.ultimo_acceso)}</td>
                  <td>
                    {p.id !== usuario.id && (
                      <button className="texto-boton" onClick={() => hacer(() => cuentas.admin.cambiar(p.id, { activo: !p.activo }), t("Account updated.", "Cuenta actualizada."))}>
                        {p.activo === false ? t("Re-enable", "Reactivar") : t("Disable", "Desactivar")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pestana === "auditoria" && (
        <ol className="auditoria">
          {auditoria.length === 0 && <p className="muted vacio">{t("No admin actions yet.", "Todavía no hay acciones de admins.")}</p>}
          {auditoria.map((r, i) => (
            <li key={i}>
              <span className="mono muted">{new Date(r.cuando).toLocaleString()}</span>
              <strong>{r.admin}</strong>
              <span>{r.accion}</span>
              <span className="muted">{r.objetivo}</span>
              {r.detalle && <span className="mono muted">{r.detalle}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
