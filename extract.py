"""Extract Gameplay Football's actual .anim, .object and ASE data without its engine.

Usage: python extract.py <downloaded gfootball_engine directory> <output directory>
Coordinates and quaternion order stay native: metres, Z-up, forward -Y, XYZW.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

CLIPS = {
    "run": "templates/sprintD000.anim",
    "slide": "sliding/sprint/000.anim",
    "fall": "trip/trip_t3/sprint/000.anim",
    "idle": "base.anim.util",
}


def animation(path):
    text = path.read_text()
    tracks = {}
    for line in text.splitlines():
        fields = line.strip().split(",")
        if len(fields) < 5 or fields[0] == "extension":
            continue
        name = fields[0]
        if not re.fullmatch(r"[a-z_]+", name):
            continue
        width = 4 if name == "player" else 5
        values = [float(v) for v in fields[1:]]
        if len(values) % width:
            raise ValueError(f"Incomplete track {path}: {name}")
        keys = [values[i:i+width] for i in range(0, len(values), width)]
        if any(a[0] >= b[0] for a, b in zip(keys, keys[1:])):
            raise ValueError(f"Non-increasing keys: {name}")
        if width == 5:
            for key in keys:
                if abs(sum(q*q for q in key[1:]) - 1) > 0.001:
                    raise ValueError(f"Invalid quaternion: {name}")
        tracks[name] = keys
    metadata = dict(re.findall(r"<([a-z_]+)>\s*([^<]+?)\s*</\1>", text))
    contact = re.search(r"extension,football,(\d+),([^\n]+)", text)
    if contact:
        metadata["contactFrame"] = int(contact.group(1))
        metadata["contactPosition"] = [float(v) for v in contact.group(2).split(",")]
    return {"fps": 100, "lastFrame": max(k[-1][0] for k in tracks.values()),
            "tracks": tracks, "metadata": metadata,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def skeleton(node):
    return {"name": node.findtext("name"),
            "position": [float(v) for v in node.findtext("position").split(",")],
            "mesh": Path(node.findtext("geometry/filename")).stem,
            "children": [skeleton(c) for c in node.findall("node")]}


def mesh(path):
    text = path.read_text()
    parts = []
    # ASE indices restart at zero for EACH geometry, e.g. head/neck/hair.
    # Preserve these objects rather than accidentally interleaving their vertices.
    for block in re.split(r"\*GEOMOBJECT\s*\{", text)[1:]:
        name = re.search(r'\*NODE_NAME\s+"([^"]+)"', block).group(1)
        verts = re.findall(r"\*MESH_VERTEX\s+(\d+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)", block)
        faces = re.findall(r"\*MESH_FACE\s+(\d+):\s+A:\s*(\d+)\s+B:\s*(\d+)\s+C:\s*(\d+)", block)
        vertices = [list(map(float, v[1:])) for v in sorted(verts, key=lambda v: int(v[0]))]
        indices = [int(v) for f in sorted(faces, key=lambda f: int(f[0])) for v in f[1:]]
        if not vertices or not indices or max(indices) >= len(vertices):
            raise ValueError(f"Invalid mesh {path}: {name}")
        declared_vertices = int(re.search(r"\*MESH_NUMVERTEX\s+(\d+)", block).group(1))
        declared_faces = int(re.search(r"\*MESH_NUMFACES\s+(\d+)", block).group(1))
        assert len(vertices) == declared_vertices and len(indices) == declared_faces * 3
        parts.append({"name": name, "vertices": vertices, "indices": indices})
    return {"parts": parts,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--all", action="store_true", help="Also export every .anim clip as animation-library.json")
    args = parser.parse_args()
    media = args.source / "data/media"
    rig = ET.parse(media / "objects/players/player.object").getroot().find("node")
    clips = {name: animation(media / "animations" / path) for name, path in CLIPS.items()}
    meshes = {name: mesh(media / f"objects/players/models/{name}.ase") for name in
              ("pelvis", "trunk", "head", "upperarm", "lowerarm", "upperleg", "lowerleg", "foot")}
    result = {"source": "google-research/football: third_party/gfootball_engine",
              "author": "Bastiaan Konings Schuiling", "license": "Unlicense",
              "coordinates": "Z-up, forward -Y, metres; quaternion XYZW; 100 frames/sec",
              "skeleton": skeleton(rig), "clips": clips, "meshes": meshes}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "extracted.json").write_text(json.dumps(result, separators=(",", ":")))
    if args.all:
        library = {path.relative_to(media / "animations").as_posix(): animation(path)
                   for path in sorted((media / "animations").rglob("*.anim"))}
        (args.output / "animation-library.json").write_text(json.dumps(library, separators=(",", ":")))
        print(f"Full library: {len(library)} source clips", flush=True)
    print(json.dumps({"clips": {n: {"frames": c["lastFrame"], "tracks": len(c["tracks"])}
                                for n, c in clips.items()},
                      "meshVertices": sum(len(p["vertices"]) for m in meshes.values() for p in m["parts"])}))


if __name__ == "__main__":
    main()
