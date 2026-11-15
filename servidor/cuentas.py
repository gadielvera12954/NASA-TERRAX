"""TERRA-X · accounts, science outreach ("Community") and the admin panel API.

Lives in the optional local server (python -m servidor). The public static site stays account-free;
when this server runs, the web shows sign-in, the Community page and, for admins, the admin panel.

Design:
- SQLite file in datos/ (git-ignored): personal data never enters the repository.
- Passwords: werkzeug scrypt hashes, 10+ characters; nobody (admins included) can read them.
- Sessions: Flask signed cookie, HttpOnly, SameSite=Lax; the signing key is generated once and kept
  next to the database. Every state-changing request must carry the header `X-TerraX: 1` (a custom
  header cannot be sent cross-site without passing the CORS check, which only admits localhost).
- Roles: `lector` (reads, may request verification), `autor` (verified: writes outreach articles that
  go to review), `admin` (verifies people, publishes or rejects articles, changes roles). Every admin
  action is written to an audit log.
- The first admin is promoted from the command line by someone with access to the machine:
      python -m servidor.cuentas admin persona@ejemplo.org
  (the person registers on the web first, with their own password).
- Articles are plain text with light markup; the web renders them as text (React escapes them), so
  no HTML from a user ever reaches another user's browser.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import datetime as dt
import functools
import os
import pathlib
import re
import secrets
import sqlite3
import sys
import threading
import time

from flask import Blueprint, abort, current_app, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

RAIZ = pathlib.Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
ROLES = ("lector", "autor", "admin")
ESTADOS = ("borrador", "revision", "publicado", "rechazado")
CATEGORIAS = ("explicacion", "metodo", "campo", "noticia")
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,24}$")

bp = Blueprint("cuentas", __name__)

ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre TEXT NOT NULL,
  afiliacion TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'lector' CHECK (rol IN ('lector','autor','admin')),
  verificado INTEGER NOT NULL DEFAULT 0,
  solicitud TEXT,
  solicitud_en TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL,
  ultimo_acceso TEXT
);
CREATE TABLE IF NOT EXISTS articulos (
  id INTEGER PRIMARY KEY,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  titulo TEXT NOT NULL,
  resumen TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'explicacion',
  fuentes TEXT NOT NULL DEFAULT '',
  idioma TEXT NOT NULL DEFAULT 'en',
  estado TEXT NOT NULL DEFAULT 'revision' CHECK (estado IN ('borrador','revision','publicado','rechazado')),
  motivo TEXT,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  publicado_en TEXT,
  revisado_por INTEGER REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  detalle TEXT NOT NULL DEFAULT '',
  cuando TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS articulos_estado ON articulos(estado, publicado_en);
"""


class Pedido(ValueError):
    """400 with a message shown as-is on the web."""


def ahora() -> str:
    return dt.datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


# ------------------------------------------------------------------------------------------------
# Storage
# ------------------------------------------------------------------------------------------------
def ruta_db() -> pathlib.Path:
    return pathlib.Path(current_app.config.get("TERRAX_DB") or os.environ.get("TERRAX_DB") or RAIZ / "datos" / "comunidad.sqlite3")


def abrir(ruta: pathlib.Path) -> sqlite3.Connection:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(ruta, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    c.execute("PRAGMA journal_mode = WAL")
    c.executescript(ESQUEMA)
    return c


def db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = abrir(ruta_db())
    return g.db


@bp.teardown_app_request
def _cerrar(_exc):
    c = g.pop("db", None)
    if c is not None:
        c.close()


def configurar(app) -> None:
    """Session cookie settings and a persistent signing key (generated once, kept next to the database)."""
    if not app.config.get("SECRET_KEY"):
        clave = os.environ.get("TERRAX_SECRET_KEY")
        if not clave:
            p = pathlib.Path(app.config.get("TERRAX_DB") or os.environ.get("TERRAX_DB") or RAIZ / "datos" / "comunidad.sqlite3").with_suffix(".clave")
            p.parent.mkdir(parents=True, exist_ok=True)
            if not p.exists():
                p.write_text(secrets.token_hex(32), encoding="ascii")
            clave = p.read_text(encoding="ascii").strip()
        app.config["SECRET_KEY"] = clave
    app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_NAME="terrax_sesion",
                      PERMANENT_SESSION_LIFETIME=dt.timedelta(days=14),
                      # Published behind HTTPS: the cookie must never travel in clear text.
                      SESSION_COOKIE_SECURE=os.environ.get("TERRAX_COOKIE_SEGURA") == "1")
    if os.environ.get("TERRAX_DETRAS_DE_PROXY") == "1":
        # Behind Vercel or another proxy: take the visitor's address from X-Forwarded-For (sign-in throttling).
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.register_blueprint(bp)


# ------------------------------------------------------------------------------------------------
# Helpers: input, session, permissions
# ------------------------------------------------------------------------------------------------
def texto(d: dict, clave: str, minimo: int, maximo: int, obligatorio: bool = True) -> str:
    v = d.get(clave)
    if v is None or (isinstance(v, str) and not v.strip()):
        if obligatorio:
            raise Pedido(f"'{clave}' is required")
        return ""
    if not isinstance(v, str):
        raise Pedido(f"'{clave}' must be text")
    v = v.strip()
    if not (minimo <= len(v) <= maximo):
        raise Pedido(f"'{clave}' must be between {minimo} and {maximo} characters")
    return v


def cuerpo() -> dict:
    d = request.get_json(silent=True)
    return d if isinstance(d, dict) else {}


def publico(u: sqlite3.Row | None) -> dict | None:
    if u is None:
        return None
    return {"id": u["id"], "nombre": u["nombre"], "afiliacion": u["afiliacion"], "rol": u["rol"],
            "verificado": bool(u["verificado"]), "solicitud_pendiente": bool(u["solicitud"]) and not u["verificado"]}


def privado(u: sqlite3.Row) -> dict:
    return {**publico(u), "email": u["email"], "creado": u["creado"], "ultimo_acceso": u["ultimo_acceso"],
            "solicitud": u["solicitud"], "solicitud_en": u["solicitud_en"], "activo": bool(u["activo"])}


def usuario_actual() -> sqlite3.Row | None:
    uid = session.get("uid")
    if not uid:
        return None
    u = db().execute("SELECT * FROM usuarios WHERE id = ? AND activo = 1", (uid,)).fetchone()
    if u is None or session.get("v") != u["hash"][-12:]:     # password changed or account disabled: session ends
        session.clear()
        return None
    return u


def requiere(*roles: str, verificado: bool = False):
    def deco(f):
        @functools.wraps(f)
        def envoltura(*a, **k):
            u = usuario_actual()
            if u is None:
                return jsonify({"error": "sign in first"}), 401
            if roles and u["rol"] not in roles:
                return jsonify({"error": "not allowed for your role"}), 403
            if verificado and not u["verificado"] and u["rol"] != "admin":
                return jsonify({"error": "your account is not verified yet"}), 403
            g.usuario = u
            return f(*a, **k)
        return envoltura
    return deco


@bp.before_app_request
def _proteccion_csrf():
    """State-changing account requests must come from our own page (custom header + same-site cookie)."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.path.startswith(("/api/cuentas", "/api/divulgacion", "/api/admin")):
        if request.headers.get("X-TerraX") != "1":
            return jsonify({"error": "missing X-TerraX header"}), 403
    return None


def auditar(accion: str, objetivo: str, detalle: str = "") -> None:
    db().execute("INSERT INTO auditoria (admin_id, accion, objetivo, detalle, cuando) VALUES (?,?,?,?,?)",
                 (g.usuario["id"], accion, objetivo, detalle[:500], ahora()))


# Brute-force brake: 5 failed sign-ins per address and e-mail every 15 minutes.
_FALLOS: dict[str, list[float]] = {}
_FALLOS_LOCK = threading.Lock()
VENTANA_S, MAX_FALLOS = 15 * 60, 5


def _clave_fallo(email: str) -> str:
    return f"{request.remote_addr}|{email.lower()}"


def _bloqueado(email: str) -> bool:
    with _FALLOS_LOCK:
        t = [x for x in _FALLOS.get(_clave_fallo(email), []) if time.time() - x < VENTANA_S]
        _FALLOS[_clave_fallo(email)] = t
        return len(t) >= MAX_FALLOS


def _fallo(email: str) -> None:
    with _FALLOS_LOCK:
        _FALLOS.setdefault(_clave_fallo(email), []).append(time.time())


def _iniciar_sesion(u: sqlite3.Row) -> None:
    session.clear()
    session.permanent = True
    session["uid"] = u["id"]
    session["v"] = u["hash"][-12:]
    db().execute("UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?", (ahora(), u["id"]))
    db().commit()


# ------------------------------------------------------------------------------------------------
# Accounts
# ------------------------------------------------------------------------------------------------
@bp.post("/api/cuentas/registro")
def registro():
    d = cuerpo()
    email = texto(d, "email", 6, 254).lower()
    if not EMAIL.match(email):
        raise Pedido("'email' is not a valid address")
    nombre = texto(d, "nombre", 2, 80)
    afiliacion = texto(d, "afiliacion", 0, 120, obligatorio=False)
    clave = d.get("clave")
    if not isinstance(clave, str) or not (10 <= len(clave) <= 200):
        raise Pedido("the password must have between 10 and 200 characters")
    if clave.lower() in (email, nombre.lower()) or len(set(clave)) < 5:
        raise Pedido("choose a less predictable password")
    try:
        cur = db().execute("INSERT INTO usuarios (email, nombre, afiliacion, hash, creado) VALUES (?,?,?,?,?)",
                           (email, nombre, afiliacion, generate_password_hash(clave), ahora()))
    except sqlite3.IntegrityError:
        raise Pedido("an account with that e-mail already exists") from None
    db().commit()
    u = db().execute("SELECT * FROM usuarios WHERE id = ?", (cur.lastrowid,)).fetchone()
    _iniciar_sesion(u)
    return jsonify({"usuario": privado(u)}), 201


@bp.post("/api/cuentas/entrar")
def entrar():
    d = cuerpo()
    email = str(d.get("email") or "").strip().lower()[:254]
    clave = d.get("clave") if isinstance(d.get("clave"), str) else ""
    if _bloqueado(email):
        return jsonify({"error": "too many failed attempts; try again in 15 minutes"}), 429
    u = db().execute("SELECT * FROM usuarios WHERE email = ? AND activo = 1", (email,)).fetchone()
    if u is None or not check_password_hash(u["hash"], clave[:200]):
        _fallo(email)
        return jsonify({"error": "wrong e-mail or password"}), 401
    _iniciar_sesion(u)
    return jsonify({"usuario": privado(u)})


@bp.post("/api/cuentas/salir")
def salir():
    session.clear()
    return jsonify({"ok": True})


@bp.get("/api/cuentas/yo")
def yo():
    u = usuario_actual()
    return jsonify({"usuario": privado(u) if u else None})


@bp.post("/api/cuentas/verificacion")
@requiere()
def pedir_verificacion():
    u = g.usuario
    if u["verificado"]:
        raise Pedido("your account is already verified")
    d = cuerpo()
    motivo = texto(d, "motivo", 20, 1000)
    afiliacion = texto(d, "afiliacion", 0, 120, obligatorio=False) or u["afiliacion"]
    db().execute("UPDATE usuarios SET solicitud = ?, solicitud_en = ?, afiliacion = ? WHERE id = ?", (motivo, ahora(), afiliacion, u["id"]))
    db().commit()
    return jsonify({"usuario": privado(db().execute("SELECT * FROM usuarios WHERE id = ?", (u["id"],)).fetchone())})


# ------------------------------------------------------------------------------------------------
# Science outreach (Community)
# ------------------------------------------------------------------------------------------------
def articulo(r: sqlite3.Row, completo: bool = True) -> dict:
    a = {"id": r["id"], "titulo": r["titulo"], "resumen": r["resumen"], "categoria": r["categoria"], "idioma": r["idioma"],
         "estado": r["estado"], "creado": r["creado"], "actualizado": r["actualizado"], "publicado_en": r["publicado_en"],
         "autor": {"id": r["autor_id"], "nombre": r["autor_nombre"], "afiliacion": r["autor_afiliacion"],
                   "verificado": bool(r["autor_verificado"]), "rol": r["autor_rol"]}}
    if completo:
        a.update({"cuerpo": r["cuerpo"], "fuentes": r["fuentes"], "motivo": r["motivo"]})
    return a


CONSULTA = ("SELECT a.*, u.nombre AS autor_nombre, u.afiliacion AS autor_afiliacion, u.verificado AS autor_verificado, "
            "u.rol AS autor_rol FROM articulos a JOIN usuarios u ON u.id = a.autor_id")


@bp.get("/api/divulgacion")
def lista_publica():
    filas = db().execute(CONSULTA + " WHERE a.estado = 'publicado' ORDER BY a.publicado_en DESC LIMIT 100").fetchall()
    return jsonify({"articulos": [articulo(r, completo=False) for r in filas]})


@bp.get("/api/divulgacion/<int:aid>")
def leer_articulo(aid: int):
    r = db().execute(CONSULTA + " WHERE a.id = ?", (aid,)).fetchone()
    if r is None:
        abort(404)
    if r["estado"] != "publicado":
        u = usuario_actual()
        if u is None or (u["id"] != r["autor_id"] and u["rol"] != "admin"):
            abort(404)                                     # unpublished work is invisible to everyone else
    return jsonify({"articulo": articulo(r)})


@bp.get("/api/divulgacion/mios")
@requiere()
def mis_articulos():
    filas = db().execute(CONSULTA + " WHERE a.autor_id = ? ORDER BY a.actualizado DESC", (g.usuario["id"],)).fetchall()
    return jsonify({"articulos": [articulo(r) for r in filas]})


def _datos_articulo(d: dict) -> dict:
    categoria = str(d.get("categoria") or "explicacion")
    if categoria not in CATEGORIAS:
        raise Pedido(f"'categoria' must be one of {', '.join(CATEGORIAS)}")
    idioma = str(d.get("idioma") or "en")
    if idioma not in ("en", "es"):
        raise Pedido("'idioma' must be en or es")
    return {"titulo": texto(d, "titulo", 8, 140), "resumen": texto(d, "resumen", 20, 400), "cuerpo": texto(d, "cuerpo", 200, 20000),
            "fuentes": texto(d, "fuentes", 0, 2000, obligatorio=False), "categoria": categoria, "idioma": idioma}


@bp.post("/api/divulgacion")
@requiere("autor", "admin", verificado=True)
def crear_articulo():
    a = _datos_articulo(cuerpo())
    estado = "borrador" if cuerpo().get("borrador") else "revision"
    t = ahora()
    cur = db().execute("INSERT INTO articulos (autor_id, titulo, resumen, cuerpo, categoria, fuentes, idioma, estado, creado, actualizado) "
                       "VALUES (?,?,?,?,?,?,?,?,?,?)", (g.usuario["id"], a["titulo"], a["resumen"], a["cuerpo"], a["categoria"],
                                                       a["fuentes"], a["idioma"], estado, t, t))
    db().commit()
    return jsonify({"articulo": articulo(db().execute(CONSULTA + " WHERE a.id = ?", (cur.lastrowid,)).fetchone())}), 201


@bp.put("/api/divulgacion/<int:aid>")
@requiere("autor", "admin", verificado=True)
def editar_articulo(aid: int):
    r = db().execute("SELECT * FROM articulos WHERE id = ?", (aid,)).fetchone()
    if r is None or r["autor_id"] != g.usuario["id"]:
        abort(404)
    if r["estado"] == "publicado":
        raise Pedido("published articles cannot be edited; write a follow-up")
    a = _datos_articulo(cuerpo())
    estado = "borrador" if cuerpo().get("borrador") else "revision"
    db().execute("UPDATE articulos SET titulo=?, resumen=?, cuerpo=?, categoria=?, fuentes=?, idioma=?, estado=?, motivo=NULL, actualizado=? WHERE id=?",
                 (a["titulo"], a["resumen"], a["cuerpo"], a["categoria"], a["fuentes"], a["idioma"], estado, ahora(), aid))
    db().commit()
    return jsonify({"articulo": articulo(db().execute(CONSULTA + " WHERE a.id = ?", (aid,)).fetchone())})


# ------------------------------------------------------------------------------------------------
# Admin panel
# ------------------------------------------------------------------------------------------------
@bp.get("/api/admin/resumen")
@requiere("admin")
def admin_resumen():
    c = db()
    uno = lambda q: c.execute(q).fetchone()[0]  # noqa: E731
    return jsonify({
        "usuarios": uno("SELECT COUNT(*) FROM usuarios"),
        "verificados": uno("SELECT COUNT(*) FROM usuarios WHERE verificado = 1"),
        "solicitudes": uno("SELECT COUNT(*) FROM usuarios WHERE verificado = 0 AND solicitud IS NOT NULL"),
        "en_revision": uno("SELECT COUNT(*) FROM articulos WHERE estado = 'revision'"),
        "publicados": uno("SELECT COUNT(*) FROM articulos WHERE estado = 'publicado'"),
        "admins": uno("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin'"),
    })


@bp.get("/api/admin/usuarios")
@requiere("admin")
def admin_usuarios():
    filas = db().execute("SELECT * FROM usuarios ORDER BY (solicitud IS NOT NULL AND verificado = 0) DESC, creado DESC").fetchall()
    return jsonify({"usuarios": [privado(u) for u in filas]})


@bp.post("/api/admin/usuarios/<int:uid>")
@requiere("admin")
def admin_cambiar_usuario(uid: int):
    d = cuerpo()
    u = db().execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()
    if u is None:
        abort(404)
    cambios = []
    if "verificado" in d:
        v = bool(d["verificado"])
        rol = u["rol"]
        if v and rol == "lector":
            rol = "autor"                                  # verifying someone lets them write
        if not v and rol == "autor":
            rol = "lector"
        db().execute("UPDATE usuarios SET verificado = ?, rol = ?, solicitud = CASE WHEN ? THEN NULL ELSE solicitud END WHERE id = ?",
                     (int(v), rol, int(v), uid))
        cambios.append(f"verificado={v}")
    if "rechazar_solicitud" in d and d["rechazar_solicitud"]:
        db().execute("UPDATE usuarios SET solicitud = NULL, solicitud_en = NULL WHERE id = ?", (uid,))
        cambios.append("solicitud rechazada")
    if "rol" in d:
        rol = str(d["rol"])
        if rol not in ROLES:
            raise Pedido(f"'rol' must be one of {', '.join(ROLES)}")
        if uid == g.usuario["id"] and rol != "admin":
            raise Pedido("you cannot remove your own admin role")
        db().execute("UPDATE usuarios SET rol = ?, verificado = CASE WHEN ? IN ('autor','admin') THEN 1 ELSE verificado END WHERE id = ?", (rol, rol, uid))
        cambios.append(f"rol={rol}")
    if "activo" in d:
        if uid == g.usuario["id"]:
            raise Pedido("you cannot disable your own account")
        db().execute("UPDATE usuarios SET activo = ? WHERE id = ?", (int(bool(d["activo"])), uid))
        cambios.append(f"activo={bool(d['activo'])}")
    if not cambios:
        raise Pedido("nothing to change")
    auditar("usuario", u["email"], ", ".join(cambios))
    db().commit()
    return jsonify({"usuario": privado(db().execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone())})


@bp.get("/api/admin/articulos")
@requiere("admin")
def admin_articulos():
    estado = request.args.get("estado", "revision")
    if estado not in ESTADOS:
        raise Pedido("unknown state")
    filas = db().execute(CONSULTA + " WHERE a.estado = ? ORDER BY a.actualizado DESC LIMIT 200", (estado,)).fetchall()
    return jsonify({"articulos": [articulo(r) for r in filas]})


@bp.post("/api/admin/articulos/<int:aid>")
@requiere("admin")
def admin_decidir(aid: int):
    d = cuerpo()
    accion = d.get("accion")
    r = db().execute("SELECT * FROM articulos WHERE id = ?", (aid,)).fetchone()
    if r is None:
        abort(404)
    if accion == "publicar":
        db().execute("UPDATE articulos SET estado='publicado', motivo=NULL, publicado_en=?, revisado_por=?, actualizado=? WHERE id=?",
                     (ahora(), g.usuario["id"], ahora(), aid))
    elif accion == "rechazar":
        motivo = texto(d, "motivo", 10, 1000)
        db().execute("UPDATE articulos SET estado='rechazado', motivo=?, revisado_por=?, actualizado=? WHERE id=?", (motivo, g.usuario["id"], ahora(), aid))
    elif accion == "retirar":
        db().execute("UPDATE articulos SET estado='revision', publicado_en=NULL, revisado_por=?, actualizado=? WHERE id=?", (g.usuario["id"], ahora(), aid))
    else:
        raise Pedido("'accion' must be publicar, rechazar or retirar")
    auditar(f"articulo:{accion}", f"#{aid} {r['titulo'][:60]}", str(d.get("motivo") or ""))
    db().commit()
    return jsonify({"articulo": articulo(db().execute(CONSULTA + " WHERE a.id = ?", (aid,)).fetchone())})


@bp.get("/api/admin/auditoria")
@requiere("admin")
def admin_auditoria():
    filas = db().execute("SELECT x.*, u.nombre AS admin FROM auditoria x JOIN usuarios u ON u.id = x.admin_id ORDER BY x.id DESC LIMIT 100").fetchall()
    return jsonify({"registros": [{"admin": r["admin"], "accion": r["accion"], "objetivo": r["objetivo"], "detalle": r["detalle"], "cuando": r["cuando"]} for r in filas]})


# ------------------------------------------------------------------------------------------------
# Command line: promote the first admin (no password ever passes through here)
# ------------------------------------------------------------------------------------------------
def principal(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="TERRA-X accounts: promote an existing account to admin, or list accounts.")
    sub = p.add_subparsers(dest="orden", required=True)
    a = sub.add_parser("admin", help="give the admin role to an account that already registered on the web")
    a.add_argument("email")
    sub.add_parser("lista", help="list accounts (no passwords)")
    p.add_argument("--db", type=pathlib.Path, default=pathlib.Path(os.environ.get("TERRAX_DB") or RAIZ / "datos" / "comunidad.sqlite3"))
    x = p.parse_args(argv)
    c = abrir(x.db)
    if x.orden == "admin":
        n = c.execute("UPDATE usuarios SET rol='admin', verificado=1, solicitud=NULL WHERE email = ? COLLATE NOCASE", (x.email.strip(),)).rowcount
        c.commit()
        if not n:
            print(f"No account with e-mail {x.email}. Register it on the web first.", file=sys.stderr)
            return 1
        print(f"{x.email} is now an admin.")
    else:
        for u in c.execute("SELECT id, email, nombre, rol, verificado, activo, creado FROM usuarios ORDER BY id"):
            print(f"{u['id']:>4}  {u['email']:<40} {u['nombre']:<24} {u['rol']:<7} verified={bool(u['verificado'])} active={bool(u['activo'])}")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
