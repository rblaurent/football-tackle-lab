"""Fetch a pinned upstream reference locally; its source is not vendored in this repo."""
from pathlib import Path
import hashlib
import shutil
import urllib.request
from formats import require

COMMIT = '8a9868a5649aa5b296b1c6e66c7c583469d7a017'
URL = f'https://raw.githubusercontent.com/sadistaaa14-sketch/Frosty-Toolsuite-FIFA-17-edition/{COMMIT}/FrostyAnimationEditor/Core/Anim/VbrClip.cs'
SHA256 = '7344e3275871c34ac5618bf731b92a5e503ecf1092d9ba786420111f32bd1809'


def prepare_decoder(folder, source=None):
    folder.mkdir(parents=True, exist_ok=True)
    pristine = folder / 'VbrClip.upstream.txt'
    if source:
        raw = Path(source).read_bytes()
    elif pristine.exists():
        raw = pristine.read_bytes()
    else:
        print('Fetching pinned upstream reference codec; see docs/TOOLS-AND-SOURCES.md for attribution/license status.', flush=True)
        with urllib.request.urlopen(URL, timeout=45) as response:
            raw = response.read(1024 * 1024)
    require(hashlib.sha256(raw).hexdigest() == SHA256, 'Upstream codec checksum mismatch; do not patch an unknown version')
    pristine.write_bytes(raw)
    text = raw.decode('utf-8-sig')
    old = 'body[i] = Data[st + size - 1 - i];'
    new = 'body[i] = Data[st + 3 + i];'
    require(text.count(old) == 1, 'Expected one reverse-storage expression')
    text = text.replace(old, new)
    # The final partial DCT block encodes a complete eight-key window ending at
    # NumKeys-1. Its first rows overlap the preceding block, rather than being
    # the first new keys. Offset ramps use the same overlapping window.
    old_rows = """for (int r = 0; r < 8; r++)
                        for (int l = 0; l < Lanes; l++) all[bi * 8 + r, l] = b[r, l];"""
    new_rows = """int valid = Math.Min(8, nk - bi * 8);
                    int rowStart = nk >= 8 ? 8 - valid : 0;
                    for (int r = 0; r < valid; r++)
                        for (int l = 0; l < Lanes; l++) all[bi * 8 + r, l] = b[rowStart + r, l];"""
    require(text.count(old_rows) == 1, 'Expected one decoded-block row copy')
    text = text.replace(old_rows, new_rows)
    old_ramp = 'keys[kk, lane0 + ch] = keys[kk, lane0 + ch] + vals[j];'
    new_ramp = 'keys[kk, lane0 + ch] = keys[kk, lane0 + ch] + vals[j + (nk >= 8 && bi * 8 + 8 > nk ? 8 - (nk & 7) : 0)];'
    require(text.count(old_ramp) == 1, 'Expected one offset-ramp row copy')
    # Skip unused padded keys before indexing the partial-window ramp rows.
    require(text.count('if (kk < keys.GetLength(0))') == 1, 'Expected one offset-ramp padded-key guard')
    text = text.replace('if (kk < keys.GetLength(0))', 'if (kk < nk)')
    text = text.replace(old_ramp, new_ramp)
    (folder / 'VbrClip.cs').write_text(text, encoding='utf-8')
    here = Path(__file__).resolve().parent / 'decode'
    for name in ('Program.cs', 'Adapter.cs', 'Decoder.csproj'):
        shutil.copyfile(here / name, folder / name)
    return folder / 'Decoder.csproj'
