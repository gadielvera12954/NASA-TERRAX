"""Accounts, outreach and admin panel:  python -m pytest servidor/tests/test_cuentas.py

Known results: passwords are stored only as hashes; the session ends on sign-out; state-changing
requests without the X-TerraX header are refused; readers cannot write and authors cannot publish;
a verified author's article reaches the public list only after an admin publishes it; an unpublished
article is invisible to everyone but its author and the admins; every admin action is audited.

Test credentials below are throwaway values for this local test database only.
"""
from __future__ import annotations

import sqlite3

import pytest

pytest.importorskip("flask", reason="pip install -r servidor/requirements.txt")

from servidor import cuentas  # noqa: E402
from servidor.app import app  # noqa: E402

H = {"X-TerraX": "1"}
CLAVE = "prueba-local-7x!Q"          # throwaway test value
ARTICULO = {
    "titulo": "Why shadows are so long at the lunar south pole",
    "resumen": "At Mons Mouton the Sun never climbs more than about seven degrees, so every hill throws a very long shadow.",
    "cuerpo": "x" * 260,
    "categoria": "explicacion",
    "idioma": "en",
    "fuentes": "NASA LOLA PGDA 90",
}


@pytest.fixture()
def base(tmp_path, monkeypatch):
    app.config["TERRAX_DB"] = str(tmp_path / "comunidad.sqlite3")
    monkeypatch.setattr(cuentas, "_FALLOS", {})
    yield tmp_path / "comunidad.sqlite3"
    app.config.pop("TERRAX_DB", None)


def cliente():
    return app.test_client()


def registrar(c, email, nombre="Persona de prueba"):
    return c.post("/api/cuentas/registro", json={"email": email, "nombre": nombre, "clave": CLAVE}, headers=H)


def hacer_admin(db, email):
    assert cuentas.principal(["--db", str(db), "admin", email]) == 0


def test_registro_guarda_solo_el_hash_y_abre_sesion(base):
    c = cliente()
    r = registrar(c, "ana@example.org")
    assert r.status_code == 201 and r.get_json()["usuario"]["rol"] == "lector"
    assert c.get("/api/cuentas/yo").get_json()["usuario"]["email"] == "ana@example.org"
    fila = sqlite3.connect(base).execute("SELECT hash FROM usuarios").fetchone()[0]
    assert CLAVE not in fila and fila.startswith(("scrypt:", "pbkdf2:"))
    assert registrar(cliente(), "ANA@example.org").status_code == 400          # same e-mail, any case


def test_contrasenas_debiles_y_datos_invalidos(base):
    c = cliente()
    assert c.post("/api/cuentas/registro", json={"email": "b@example.org", "nombre": "B", "clave": "corta"}, headers=H).status_code == 400
    assert c.post("/api/cuentas/registro", json={"email": "no-es-correo", "nombre": "Bea", "clave": CLAVE}, headers=H).status_code == 400
    assert c.post("/api/cuentas/registro", json={"email": "b@example.org", "nombre": "Bea", "clave": "aaaaaaaaaaaa"}, headers=H).status_code == 400


def test_entrar_salir_y_freno_de_intentos(base):
    registrar(cliente(), "carla@example.org")
    c = cliente()
    for _ in range(cuentas.MAX_FALLOS):
        assert c.post("/api/cuentas/entrar", json={"email": "carla@example.org", "clave": "incorrecta-123"}, headers=H).status_code == 401
    assert c.post("/api/cuentas/entrar", json={"email": "carla@example.org", "clave": CLAVE}, headers=H).status_code == 429
    cuentas._FALLOS.clear()
    assert c.post("/api/cuentas/entrar", json={"email": "carla@example.org", "clave": CLAVE}, headers=H).status_code == 200
    assert c.post("/api/cuentas/salir", headers=H).status_code == 200
    assert c.get("/api/cuentas/yo").get_json()["usuario"] is None


def test_sin_cabecera_x_terrax_se_rechaza(base):
    r = cliente().post("/api/cuentas/registro", json={"email": "d@example.org", "nombre": "Dani", "clave": CLAVE})
    assert r.status_code == 403


def test_circuito_completo_de_verificacion_y_publicacion(base):
    admin, autora, curioso = cliente(), cliente(), cliente()
    registrar(admin, "admin@example.org", "Admin")
    hacer_admin(base, "admin@example.org")
    admin.post("/api/cuentas/entrar", json={"email": "admin@example.org", "clave": CLAVE}, headers=H)
    registrar(autora, "eva@example.org", "Eva")
    registrar(curioso, "fede@example.org", "Fede")

    # A reader cannot write and cannot see the admin panel.
    assert autora.post("/api/divulgacion", json=ARTICULO, headers=H).status_code == 403
    assert autora.get("/api/admin/resumen").status_code == 403
    assert cliente().get("/api/admin/resumen").status_code == 401

    # She asks for verification; the admin sees it and verifies her (she becomes an author).
    r = autora.post("/api/cuentas/verificacion", json={"motivo": "Planetary science student, I give school talks about the Moon.", "afiliacion": "UNA"}, headers=H)
    assert r.status_code == 200 and r.get_json()["usuario"]["solicitud_pendiente"] is True
    assert admin.get("/api/admin/resumen").get_json()["solicitudes"] == 1
    eva = next(u for u in admin.get("/api/admin/usuarios").get_json()["usuarios"] if u["email"] == "eva@example.org")
    r = admin.post(f"/api/admin/usuarios/{eva['id']}", json={"verificado": True}, headers=H)
    assert r.get_json()["usuario"]["rol"] == "autor" and r.get_json()["usuario"]["verificado"] is True

    # Her article goes to review: invisible to the public and to other readers.
    r = autora.post("/api/divulgacion", json=ARTICULO, headers=H)
    assert r.status_code == 201
    aid = r.get_json()["articulo"]["id"]
    assert r.get_json()["articulo"]["estado"] == "revision"
    assert cliente().get("/api/divulgacion").get_json()["articulos"] == []
    assert curioso.get(f"/api/divulgacion/{aid}").status_code == 404
    assert autora.get(f"/api/divulgacion/{aid}").status_code == 200

    # A rejection needs a reason; publishing makes it public with the author's verified badge.
    assert admin.post(f"/api/admin/articulos/{aid}", json={"accion": "rechazar"}, headers=H).status_code == 400
    assert admin.post(f"/api/admin/articulos/{aid}", json={"accion": "publicar"}, headers=H).status_code == 200
    pub = cliente().get("/api/divulgacion").get_json()["articulos"]
    assert len(pub) == 1 and pub[0]["autor"]["verificado"] is True and "cuerpo" not in pub[0]
    assert cliente().get(f"/api/divulgacion/{aid}").get_json()["articulo"]["cuerpo"] == ARTICULO["cuerpo"]

    # A published article cannot be edited by its author; every admin action is in the audit log.
    assert autora.put(f"/api/divulgacion/{aid}", json=ARTICULO, headers=H).status_code == 400
    acciones = [x["accion"] for x in admin.get("/api/admin/auditoria").get_json()["registros"]]
    assert "articulo:publicar" in acciones and "usuario" in acciones


def test_admin_no_puede_quitarse_su_propio_rol_y_desactivar_corta_la_sesion(base):
    admin, otro = cliente(), cliente()
    registrar(admin, "root@example.org", "Root")
    hacer_admin(base, "root@example.org")
    admin.post("/api/cuentas/entrar", json={"email": "root@example.org", "clave": CLAVE}, headers=H)
    yo = admin.get("/api/cuentas/yo").get_json()["usuario"]
    assert admin.post(f"/api/admin/usuarios/{yo['id']}", json={"rol": "lector"}, headers=H).status_code == 400
    registrar(otro, "gina@example.org", "Gina")
    gina = next(u for u in admin.get("/api/admin/usuarios").get_json()["usuarios"] if u["email"] == "gina@example.org")
    assert admin.post(f"/api/admin/usuarios/{gina['id']}", json={"activo": False}, headers=H).status_code == 200
    assert otro.get("/api/cuentas/yo").get_json()["usuario"] is None          # disabled: her session ends


def test_promover_admin_por_linea_de_comandos_exige_cuenta_existente(base, capsys):
    assert cuentas.principal(["--db", str(base), "admin", "nadie@example.org"]) == 1
    assert "Register it on the web first" in capsys.readouterr().err
