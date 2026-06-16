from pathlib import Path
import json, csv, hashlib, sys

root = Path(__file__).resolve().parent
strict = "--strict" in sys.argv
payload = json.loads((root / "data" / "atuendos.json").read_text(encoding="utf-8"))
items = payload if isinstance(payload, list) else payload.get("atuendos", [])
ids = [item["id"] for item in items]
assert len(ids) == len(set(ids)), "IDs repetidos"
missing_images = []
for item in items:
    assert item["genero"] in {"hombre", "mujer", "otro"}
    image_path = root / "images" / item["archivo"]
    if not image_path.is_file():
        missing_images.append(item["archivo"])

if strict and missing_images:
    raise AssertionError(f"Faltan imagenes: {missing_images}")

print({
    "registros": len(items),
    "ids_unicos": True,
    "imagenes_faltantes": len(missing_images),
    "modo_estricto": strict
})
