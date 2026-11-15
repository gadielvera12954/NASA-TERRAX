"""Verifica, sin red, que los datos publicados en web/public/data son exactamente los del manifiesto.

    python -m motor.exportar.verificar          # informe legible; sale con código 1 si algo no coincide
    python -m motor.exportar.verificar --json   # el mismo informe en JSON (para CI)

Qué comprueba:
1. cada archivo listado en manifest.json existe y su tamaño y su SHA-256 coinciden;
2. no hay archivos publicados que falten en el manifiesto (salvo manifest.json);
3. los archivos de la Parte 3 (partes.parte3.archivos) coinciden con las copias publicadas;
4. parametros.yaml tiene la huella que registran el manifiesto y parametros/CONGELADO.json;
5. si el manifiesto dice que no hay maqueta, ningún archivo publicado está marcado como tal.

La web hace la misma comprobación 1 en el navegador (Verification → "Verify the published files"),
con WebCrypto, para que cualquiera pueda repetirla sin instalar nada.

Uso de SI: redactado con Claude Code para la Parte 4.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys
import time

import parametros

RAIZ = pathlib.Path(__file__).resolve().parents[2]
WEB = RAIZ / "web" / "public" / "data"


def sha_archivo(p: pathlib.Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def verificar(web: pathlib.Path = WEB) -> dict:
    """Devuelve un informe con `ok` y la lista de `fallas` (vacía cuando todo coincide)."""
    t0 = time.perf_counter()
    fallas: list[dict] = []
    ruta_manifest = web / "manifest.json"
    if not ruta_manifest.exists():
        return {"ok": False, "fallas": [{"tipo": "manifiesto", "archivo": "manifest.json", "detalle": "missing"}],
                "archivos": 0, "bytes": 0, "segundos": 0.0}
    m = json.loads(ruta_manifest.read_text(encoding="utf-8"))
    listados: dict[str, dict] = {a["archivo"]: a for a in m.get("archivos", [])}

    # 1. Cada archivo listado existe y coincide en tamaño y SHA-256.
    total_bytes = 0
    huellas: dict[str, str] = {}
    for rel, a in listados.items():
        p = web / rel
        if not p.is_file():
            fallas.append({"tipo": "falta", "archivo": rel, "detalle": "listed in the manifest but not published"})
            continue
        n = p.stat().st_size
        if n != a.get("bytes"):
            fallas.append({"tipo": "tamano", "archivo": rel, "detalle": f"{n} bytes published, {a.get('bytes')} in the manifest"})
        h = sha_archivo(p)
        huellas[rel] = h
        if h != a.get("sha256"):
            fallas.append({"tipo": "sha256", "archivo": rel, "detalle": f"{h[:16]}… published, {str(a.get('sha256'))[:16]}… in the manifest"})
        total_bytes += n

    # 2. Nada publicado fuera del manifiesto.
    for p in sorted(web.rglob("*")):
        if p.is_file() and p.name != "manifest.json":
            rel = str(p.relative_to(web)).replace("\\", "/")
            if rel not in listados:
                fallas.append({"tipo": "sin_listar", "archivo": rel, "detalle": "published but absent from the manifest"})

    # 3. Las copias de la Parte 3 son las que su propio manifiesto registró.
    parte3 = (m.get("partes") or {}).get("parte3") or {}
    for a in parte3.get("archivos", []):
        rel = a.get("archivo")
        if rel in huellas and huellas[rel] != a.get("sha256"):
            fallas.append({"tipo": "parte3", "archivo": rel, "detalle": "differs from salida/manifest_parte3.json"})

    # 4. Parámetros congelados.
    actual = parametros.huella()
    congelado = parametros.estado_congelado()
    if m.get("parametros_sha256") != actual:
        fallas.append({"tipo": "parametros", "archivo": "parametros/parametros.yaml",
                       "detalle": "its SHA-256 differs from the one recorded in manifest.json"})
    if not congelado.get("coincide"):
        fallas.append({"tipo": "parametros", "archivo": "parametros/CONGELADO.json",
                       "detalle": "parametros.yaml no longer matches the frozen record"})

    # 5. Coherencia de la marca de maqueta.
    if m.get("maqueta") is False:
        for rel, a in listados.items():
            if a.get("maqueta"):
                fallas.append({"tipo": "maqueta", "archivo": rel, "detalle": "marked as mock data in a manifest that declares none"})

    return {"ok": not fallas, "fallas": fallas, "archivos": len(listados), "bytes": total_bytes,
            "fuentes": len(m.get("fuentes", [])), "version": m.get("version"), "fecha": m.get("fecha"),
            "parametros_sha256": actual, "segundos": round(time.perf_counter() - t0, 2)}


def principal(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--json", action="store_true", help="print the report as JSON")
    p.add_argument("--web", type=pathlib.Path, default=WEB, help=argparse.SUPPRESS)
    a = p.parse_args(argv)
    r = verificar(a.web)
    if a.json:
        print(json.dumps(r, ensure_ascii=False, indent=1))
    else:
        estado = "OK" if r["ok"] else "FAIL"
        print(f"{estado}: {r['archivos']} files, {r['bytes'] / 1e6:.1f} MB, {r.get('fuentes', 0)} sources, "
              f"dataset {r.get('version')} ({r.get('fecha')}), checked in {r['segundos']} s")
        for f in r["fallas"]:
            print(f"  - [{f['tipo']}] {f['archivo']}: {f['detalle']}")
    return 0 if r["ok"] else 1


if __name__ == "__main__":
    sys.exit(principal())
