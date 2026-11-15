/** Sign in / create an account. Passwords go straight to the server, which keeps only a hash. */
import { FormEvent, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Usuario, cuentas } from "../../datos/cuentas";
import { Aviso, SinServidor, useTextos } from "./comun";

export default function Cuenta({
  servidor,
  usuario,
  onUsuario,
  irA,
}: {
  servidor: boolean;
  usuario: Usuario | null;
  onUsuario: (u: Usuario | null) => void;
  irA: (pagina: string) => void;
}) {
  const { t } = useTextos();
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [afiliacion, setAfiliacion] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  if (!servidor) return <SinServidor />;

  if (usuario)
    return (
      <div className="cuenta-panel">
        <p className="lead">
          {t(`Signed in as ${usuario.nombre}.`, `Entraste como ${usuario.nombre}.`)}{" "}
          {usuario.rol === "admin"
            ? t("You are an admin.", "Sos admin.")
            : usuario.verificado
              ? t("Your account is verified: you can publish in Community.", "Tu cuenta está verificada: podés publicar en Comunidad.")
              : t("Request verification in Community to publish.", "Pedí la verificación en Comunidad para publicar.")}
        </p>
        <div className="actions">
          <button className="btn" onClick={() => irA("community")}>
            {t("Go to Community", "Ir a Comunidad")}
          </button>
          {usuario.rol === "admin" && (
            <button className="btn sec" onClick={() => irA("admin")}>
              {t("Open the admin panel", "Abrir el panel admin")}
            </button>
          )}
          <button
            className="btn sec"
            onClick={async () => {
              await cuentas.salir().catch(() => {});
              onUsuario(null);
            }}
          >
            {t("Sign out", "Salir")}
          </button>
        </div>
      </div>
    );

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setEnviando(true);
    try {
      const r = modo === "entrar" ? await cuentas.entrar(email, clave) : await cuentas.registrar({ email, clave, nombre, afiliacion });
      setClave("");
      onUsuario(r.usuario);
      irA("community");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="cuenta-panel">
      <div className="segmento pestanas" role="group" aria-label={t("Account action", "Acción de la cuenta")}>
        <button aria-pressed={modo === "entrar"} onClick={() => setModo("entrar")}>
          <LogIn aria-hidden="true" size={16} /> {t("Sign in", "Entrar")}
        </button>
        <button aria-pressed={modo === "registro"} onClick={() => setModo("registro")}>
          <UserPlus aria-hidden="true" size={16} /> {t("Create an account", "Crear una cuenta")}
        </button>
      </div>
      <form className="form-cuenta panel" onSubmit={enviar}>
        {modo === "registro" && (
          <>
            <label>
              {t("Name", "Nombre")}
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
            </label>
            <label>
              {t("Affiliation (optional)", "Afiliación (opcional)")}
              <input value={afiliacion} onChange={(e) => setAfiliacion(e.target.value)} maxLength={120} placeholder={t("University, school, agency…", "Universidad, colegio, agencia…")} />
            </label>
          </>
        )}
        <label>
          {t("E-mail", "Correo")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          {t("Password", "Contraseña")}
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
            minLength={modo === "registro" ? 10 : 1}
            maxLength={200}
            autoComplete={modo === "registro" ? "new-password" : "current-password"}
          />
        </label>
        {modo === "registro" && (
          <p className="muted">
            {t(
              "At least 10 characters. The server stores only a scrypt hash; nobody, admins included, can read it.",
              "Al menos 10 caracteres. El servidor guarda solo un hash scrypt; nadie, ni los admins, puede leerla.",
            )}
          </p>
        )}
        <Aviso texto={error} />
        <button className="btn" type="submit" disabled={enviando}>
          {enviando ? t("One moment…", "Un momento…") : modo === "entrar" ? t("Sign in", "Entrar") : t("Create my account", "Crear mi cuenta")}
        </button>
      </form>
    </div>
  );
}
