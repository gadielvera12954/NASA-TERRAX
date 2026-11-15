/** Client of the accounts, Community and admin API (servidor/cuentas.py). Same-origin cookie session. */
export type Rol = "lector" | "autor" | "admin";
export interface Usuario {
  id: number;
  nombre: string;
  afiliacion: string;
  rol: Rol;
  verificado: boolean;
  solicitud_pendiente: boolean;
  email?: string;
  creado?: string;
  ultimo_acceso?: string | null;
  solicitud?: string | null;
  solicitud_en?: string | null;
  activo?: boolean;
}
export interface Autor {
  id: number;
  nombre: string;
  afiliacion: string;
  verificado: boolean;
  rol: Rol;
}
export type Categoria = "explicacion" | "metodo" | "campo" | "noticia";
export interface Articulo {
  id: number;
  titulo: string;
  resumen: string;
  categoria: Categoria;
  idioma: "en" | "es";
  estado: "borrador" | "revision" | "publicado" | "rechazado";
  creado: string;
  actualizado: string;
  publicado_en: string | null;
  autor: Autor;
  cuerpo?: string;
  fuentes?: string;
  motivo?: string | null;
}
export interface ResumenAdmin {
  usuarios: number;
  verificados: number;
  solicitudes: number;
  en_revision: number;
  publicados: number;
  admins: number;
}
export interface RegistroAuditoria {
  admin: string;
  accion: string;
  objetivo: string;
  detalle: string;
  cuando: string;
}

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje);
  }
}

async function api<T>(ruta: string, metodo = "GET", cuerpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(ruta, {
      method: metodo,
      credentials: "same-origin",
      cache: "no-store",
      headers: metodo === "GET" ? {} : { "Content-Type": "application/json", "X-TerraX": "1" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "server unreachable");
  }
  let j: unknown = null;
  try {
    j = await r.json();
  } catch {
    // proxy error page or empty body
  }
  if (!r.ok) {
    const msg = j && typeof j === "object" && "error" in j ? String((j as { error: unknown }).error) : `HTTP ${r.status}`;
    throw new ErrorApi(r.status, msg);
  }
  return j as T;
}

export const cuentas = {
  yo: () => api<{ usuario: Usuario | null }>("/api/cuentas/yo"),
  registrar: (d: { email: string; nombre: string; clave: string; afiliacion?: string }) =>
    api<{ usuario: Usuario }>("/api/cuentas/registro", "POST", d),
  entrar: (email: string, clave: string) => api<{ usuario: Usuario }>("/api/cuentas/entrar", "POST", { email, clave }),
  salir: () => api<{ ok: boolean }>("/api/cuentas/salir", "POST", {}),
  pedirVerificacion: (motivo: string, afiliacion: string) =>
    api<{ usuario: Usuario }>("/api/cuentas/verificacion", "POST", { motivo, afiliacion }),
  publicados: () => api<{ articulos: Articulo[] }>("/api/divulgacion"),
  articulo: (id: number) => api<{ articulo: Articulo }>(`/api/divulgacion/${id}`),
  mios: () => api<{ articulos: Articulo[] }>("/api/divulgacion/mios"),
  crear: (a: Partial<Articulo> & { borrador?: boolean }) => api<{ articulo: Articulo }>("/api/divulgacion", "POST", a),
  editar: (id: number, a: Partial<Articulo> & { borrador?: boolean }) => api<{ articulo: Articulo }>(`/api/divulgacion/${id}`, "PUT", a),
  admin: {
    resumen: () => api<ResumenAdmin>("/api/admin/resumen"),
    usuarios: () => api<{ usuarios: Usuario[] }>("/api/admin/usuarios"),
    cambiar: (id: number, d: { verificado?: boolean; rol?: Rol; activo?: boolean; rechazar_solicitud?: boolean }) =>
      api<{ usuario: Usuario }>(`/api/admin/usuarios/${id}`, "POST", d),
    articulos: (estado: Articulo["estado"]) => api<{ articulos: Articulo[] }>(`/api/admin/articulos?estado=${estado}`),
    decidir: (id: number, accion: "publicar" | "rechazar" | "retirar", motivo?: string) =>
      api<{ articulo: Articulo }>(`/api/admin/articulos/${id}`, "POST", { accion, motivo }),
    auditoria: () => api<{ registros: RegistroAuditoria[] }>("/api/admin/auditoria"),
  },
};
