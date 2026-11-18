"""Fetch the original football animation library at a pinned upstream revision.

Only public GitHub data is accessed. Each file is checked against its Git blob id.
Usage: python fetch_source.py <output directory>
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

REVISION = "3d9e754720a95621bba6475c4d3b0d56fe919014"
PREFIX = "third_party/gfootball_engine/"


def main():
    output = Path(sys.argv[1])
    request = urllib.request.Request(
        f"https://api.github.com/repos/google-research/football/git/trees/{REVISION}?recursive=1",
        headers={"User-Agent": "football-animation-extraction-demo"})
    with urllib.request.urlopen(request, timeout=40) as response:
        tree = json.load(response)
    selected = []
    for entry in tree["tree"]:
        p = entry["path"]
        if entry["type"] != "blob" or not p.startswith(PREFIX):
            continue
        relative = p[len(PREFIX):]
        if (relative.startswith("data/media/animations/") or
            relative.startswith("data/media/objects/players/models/") or
            relative in ("LICENSE", "data/media/objects/players/player.object", "src/utils/animation.cpp")):
            selected.append((entry, relative))

    def download(item):
        entry, relative = item
        path = output / relative
        if path.exists():
            content = path.read_bytes()
            digest = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
            if digest == entry["sha"]:
                return relative
        with urllib.request.urlopen(
            f"https://raw.githubusercontent.com/google-research/football/{REVISION}/{entry['path']}", timeout=45
        ) as response:
            content = response.read()
        digest = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
        if digest != entry["sha"]:
            raise ValueError(f"Git blob hash mismatch for {relative}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return relative

    with ThreadPoolExecutor(max_workers=8) as pool:
        completed = 0
        for future in as_completed([pool.submit(download, item) for item in selected]):
            future.result()
            completed += 1
            if completed % 50 == 0:
                print(f"Verified {completed}/{len(selected)} source files", flush=True)
    output.mkdir(parents=True, exist_ok=True)
    (output / "SOURCE.json").write_text(json.dumps({
        "repository": "https://github.com/google-research/football",
        "revision": REVISION,
        "files": [{"path": relative, "gitBlobSha1": entry["sha"], "size": entry["size"]}
                  for entry, relative in selected]}, indent=2))
    print(f"Finished: {len(selected)} original files verified", flush=True)


if __name__ == "__main__":
    main()
