"""Extract original Cocos mesh bins + albedo textures into resources/models."""
from __future__ import annotations

import json
import os
import re
import shutil
import struct
from glob import glob

ROOT = r"d:\Custom\PickGeese\assets\resources\origin"
OUT = r"d:\Custom\PickGeese\assets\resources\models"
FMT_SIZE = {21: 8, 32: 12, 44: 16, 35: 4, 18: 4, 29: 6, 11: 4}
FMT_COMP = {21: 2, 32: 3, 44: 4, 35: 4, 18: 2, 29: 3, 11: 1}

BASE64_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
HEX = "0123456789abcdef"
ASCII64 = [0] * 128
for i, c in enumerate(BASE64_KEYS[:64]):
    ASCII64[ord(c)] = i


def decode_uuid(compact: str) -> str:
    extra = ""
    if "@" in compact:
        compact, extra = compact.split("@", 1)
        extra = "@" + extra
    if len(compact) != 22:
        return compact + extra
    t = [""] * 4
    tmpl = t + t + ["-"] + t + ["-"] + t + ["-"] + t + ["-"] + t + t + t
    idx = [i for i, x in enumerate(tmpl) if x != "-"]
    tmpl[0], tmpl[1] = compact[0], compact[1]
    j = 2
    for i in range(2, 22, 2):
        lhs, rhs = ASCII64[ord(compact[i])], ASCII64[ord(compact[i + 1])]
        tmpl[idx[j]] = HEX[lhs >> 2]
        j += 1
        tmpl[idx[j]] = HEX[((lhs & 3) << 2) | (rhs >> 4)]
        j += 1
        tmpl[idx[j]] = HEX[rhs & 0xF]
        j += 1
    return "".join(tmpl) + extra


def slug(path: str) -> str:
    name = path.replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9_]+", "_", name)
    return name.strip("_") or "mesh"


def find_struct(import_root: str, hint: str) -> dict | None:
    needle = '"vertexBundles"'
    for p in glob(os.path.join(import_root, "**", "*.json"), recursive=True):
        if p.endswith(".meta"):
            continue
        try:
            raw = open(p, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        if needle not in raw or hint not in raw:
            continue
        i = raw.find(needle)
        # walk back to nearest {
        start = raw.rfind('{"primitives"', 0, i)
        if start < 0:
            start = raw.rfind("{", 0, i)
        if start < 0:
            continue
        depth = 0
        for j in range(start, len(raw)):
            if raw[j] == "{":
                depth += 1
            elif raw[j] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(raw[start : j + 1])
                    except json.JSONDecodeError:
                        break
    return None


def decode_mesh(bin_path: str, st: dict) -> dict:
    data = open(bin_path, "rb").read()
    bundle = st["vertexBundles"][0]
    view = bundle["view"]
    attrs = bundle["attributes"]
    stride = view["stride"]
    count = view["count"]
    off = view["offset"]
    names = []
    offsets = []
    comps = []
    cursor = 0
    for a in attrs:
        names.append(a["name"])
        offsets.append(cursor)
        c = FMT_COMP.get(a["format"], 3)
        comps.append(c)
        cursor += FMT_SIZE.get(a["format"], c * 4)
    pos = nrm = uv = None
    for name, aoff, c in zip(names, offsets, comps):
        arr = []
        for i in range(count):
            base = off + i * stride + aoff
            arr.extend(struct.unpack_from("<" + "f" * c, data, base))
        if name == "a_position":
            pos = arr
        elif name == "a_normal":
            nrm = arr
        elif name == "a_texCoord":
            uv = arr
    prim = st["primitives"][0]
    iv = prim["indexView"]
    icount = iv["count"]
    ioff = iv["offset"]
    istride = int(iv.get("stride") or 2)
    if istride not in (1, 2, 4):
        istride = 2
    ch = {1: "B", 2: "H", 4: "I"}[istride]
    if ioff + icount * istride > len(data):
        raise ValueError(f"index out of range {ioff}+{icount}*{istride} > {len(data)}")
    indices = list(struct.unpack_from("<" + ch * icount, data, ioff))
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    return {
        "positions": [round(x, 5) for x in pos],
        "normals": [round(x, 5) for x in nrm] if nrm else [],
        "uvs": [round(x, 5) for x in uv] if uv else [],
        "indices": indices,
        "min": [min(xs), min(ys), min(zs)],
        "max": [max(xs), max(ys), max(zs)],
    }


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    cfg = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))
    types, uuids = cfg["types"], cfg["uuids"]

    bins: dict[str, str] = {}
    for p in glob(os.path.join(ROOT, "native", "**", "*.bin"), recursive=True):
        uid = os.path.basename(p).split(".")[0]
        bins[uid.lower()] = p
        bins[uid.split("@")[0].lower()] = p

    jpgs: dict[str, str] = {}
    for p in glob(os.path.join(ROOT, "native", "**", "*.*"), recursive=True):
        if not p.lower().endswith((".jpg", ".png", ".jpeg")):
            continue
        uid = os.path.basename(p).split(".")[0]
        jpgs[uid.lower()] = p
        jpgs[uid.split("@")[0].lower()] = p

    images: dict[str, str] = {}
    for idx, v in cfg["paths"].items():
        t = types[v[1]] if isinstance(v[1], int) else v[1]
        if t != "cc.ImageAsset":
            continue
        uid = decode_uuid(uuids[int(idx)]).lower()
        p = jpgs.get(uid) or jpgs.get(uid.split("@")[0])
        if p:
            images[v[0]] = p

    catalog = []
    for idx, v in cfg["paths"].items():
        t = types[v[1]] if isinstance(v[1], int) else v[1]
        if t != "cc.Mesh":
            continue
        path = v[0]
        if "beach" not in path.lower() and "Yellow" not in path:
            continue
        uid = decode_uuid(uuids[int(idx)])
        bin_path = bins.get(uid.lower()) or bins.get(uid.split("@")[0].lower())
        if not bin_path:
            continue
        name = slug(path)
        st = find_struct(os.path.join(ROOT, "import"), name) or find_struct(
            os.path.join(ROOT, "import"), path.split("/")[-2] if "/" in path else name
        )
        if not st:
            print("NO STRUCT", name)
            continue
        geo = decode_mesh(bin_path, st)
        tex_path = None
        for key, jpg in images.items():
            base = name.replace("_", "").lower()
            kn = key.replace("_", "").replace("/", "").lower()
            if name.lower() in kn or base[:10] in kn:
                if key.endswith("_N") or key.endswith("_R") or key.endswith("_B"):
                    continue
                tex_path = jpg
                if key.endswith("_D") or key.endswith("Bucket"):
                    break
        out_json = os.path.join(OUT, name + ".json")
        json.dump(geo, open(out_json, "w", encoding="utf-8"), separators=(",", ":"))
        tex_name = ""
        if tex_path:
            ext = os.path.splitext(tex_path)[1]
            dest = os.path.join(OUT, name + ext)
            shutil.copy2(tex_path, dest)
            tex_name = name + ext
        catalog.append(
            {
                "id": name,
                "src": path,
                "extent": max(geo["max"][i] - geo["min"][i] for i in range(3)),
                "tex": tex_name,
            }
        )
        print("OK", name, "verts", len(geo["positions"]) // 3, "tex", tex_name)

    json.dump(catalog, open(os.path.join(OUT, "catalog.json"), "w", encoding="utf-8"), indent=2)
    print("wrote", len(catalog), "models")


if __name__ == "__main__":
    main()
