"""Optional public-.NET-bundle inspection helper used during research. Not required for extraction."""
import argparse
from pathlib import Path
import struct
import json
import zlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--exe', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
data = args.exe.read_bytes()
signature = bytes.fromhex('8b1202b96a612038727b930214d7a03213f5b9e6efae3318ee3b2dce24b36aae')
marker = data.find(signature)
if marker < 8:
    raise ValueError('No .NET single-file bundle signature')
position = struct.unpack_from('<Q', data, marker - 8)[0]
major, minor, count = struct.unpack_from('<IIi', data, position)
position += 12
if not 0 <= count <= 100000:
    raise ValueError('Unexpected bundle entry count')
def string():
    global position
    size = 0
    for shift in range(0, 70, 7):
        byte = data[position]
        position += 1
        size |= (byte & 127) << shift
        if byte < 128:
            break
    else:
        raise ValueError('Overlong bundle string length')
    if size > len(data) - position:
        raise ValueError('Bundle string exceeds file')
    value = data[position:position + size].decode('utf-8')
    position += size
    return value
bundle_id = string()
if major >= 2:
    position += 40
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=True)
entries = []
for _ in range(count):
    offset, size = struct.unpack_from('<qq', data, position)
    position += 16
    compressed = 0
    if major >= 6:
        compressed, = struct.unpack_from('<q', data, position)
        position += 8
    kind = data[position]
    position += 1
    name = string()
    entry = dict(name=name, size=size, compressed=compressed, type=kind)
    entries.append(entry)
    if not (name.startswith(('FMT.', 'Frosty')) or name.endswith(('.deps.json', '.runtimeconfig.json'))):
        continue
    stored = compressed or size
    if min(offset, size, compressed) < 0 or offset + stored > len(data) or size > 256 * 1024 * 1024:
        raise ValueError('Unexpected bundle payload bounds')
    destination = (out / name).resolve()
    if not destination.is_relative_to(out):
        raise ValueError('Bundle path escapes output directory')
    payload = data[offset:offset + stored]
    if compressed:
        decoder = zlib.decompressobj(-15)
        payload = decoder.decompress(payload, size + 1)
        if not decoder.eof:
            raise ValueError('Truncated or oversized compressed payload')
    if len(payload) != size:
        raise ValueError('Decoded bundle size mismatch')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
(out / 'bundle-index.json').write_text(json.dumps(dict(major=major, minor=minor, count=count, entries=entries), indent=2), encoding='utf-8')
print(json.dumps({'major': major, 'minor': minor, 'entries': count, 'selectedFiles': sum(p.is_file() for p in out.rglob('*'))}))
