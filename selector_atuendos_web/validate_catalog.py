from pathlib import Path
import json, csv, hashlib, sys

root = Path(__file__).resolve().parent
payload = json.loads((root / "data" / "atuendos.json").read_text(encoding="utf-8"))
items = payload if isinstance(payload, list) else payload.get("atuendos", [])
ids = [item["id"] for item in items]
assert len(ids) == len(set(ids)), "IDs repetidos"
for item in items:
    assert item["genero"] in {"hombre", "mujer"}
    assert (root / "images" / item["archivo"]).is_file(), f"Falta {item['archivo']}"
print({"registros": len(items), "ids_unicos": True, "referencias_imagen_validas": True})
