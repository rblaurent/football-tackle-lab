"""Extract selected FC27 Lite motions from an owner-installed Windows copy.
See docs/REPRODUCING.md and docs/FORMATS.md. Game files are only read.
"""
import argparse
import collections
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
from formats import Reader, FormatError, require, span, unpack, cstring, efix, scalar_array, relative_array, vbr_base

HERE = Path(__file__).resolve().parent
TOCS = ['globals.toc', 'globalsfull.toc', 'contentlaunchsb.toc', 'contentsb.toc',
        'presprematchsba.toc', 'storycharsb.toc', 'matchcinematicssba.toc', 'fc/fcgame/fcgame.toc']
MOTION_TYPE = 0x4088BF7E
MAX_ASSET = 256 * 1024 * 1024

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':')), encoding='utf-8')

class Archives:
    def __init__(self, game):
        self.game = game.resolve()
        data = (game / 'Data/layout.toc').read_bytes()
        _, self.layout = Reader(data, 556).db_object()
        self.catalogs = {x['persistentIndex']: x['installBundle']
                         for x in self.layout['installManifest']['installChunks']}
        self.oodle = None

    def packed(self, entry):
        patch, catalog, cas, offset, size = entry['route']
        require(patch in (0, 1) and catalog in self.catalogs, 'Unknown CAS route')
        require(0 <= size <= MAX_ASSET, 'CAS route size limit')
        path = self.game / ('Patch' if patch else 'Data') / self.catalogs[catalog] / f'cas_{cas:02d}.cas'
        require(path.resolve().is_relative_to(self.game), 'CAS path escapes game directory')
        require(offset >= 0 and offset + size <= path.stat().st_size, 'CAS range exceeds file')
        with path.open('rb') as handle:
            handle.seek(offset)
            data = handle.read(size)
        require(len(data) == size, 'Short CAS read')
        return data

    def decompress(self, entry):
        import lz4.block
        import zstandard
        packed = self.packed(entry)
        output, offset, codecs = bytearray(), 0, collections.Counter()
        while offset < len(packed):
            raw_size, = unpack(packed, offset, '>I')
            raw_size &= 0xFFFFFF
            typ, = unpack(packed, offset + 4, '<H')
            size, = unpack(packed, offset + 6, '>H')
            size |= ((typ >> 8) & 15) << 16
            offset += 8
            block = span(packed, offset, size)
            offset += size
            codec = typ & 127
            codecs[codec] += 1
            require(raw_size <= 16 * 1024 * 1024, 'Decompression block limit')
            if codec == 0:
                raw = block
            elif codec == 9:
                raw = lz4.block.decompress(block, uncompressed_size=raw_size)
            elif codec == 15:
                raw = zstandard.ZstdDecompressor().decompress(block, max_output_size=raw_size)
            elif codec in (17, 21, 25):
                require(os.name == 'nt' and struct.calcsize('P') == 8, 'Oodle stage requires Windows x64 Python')
                if self.oodle is None:
                    library = ctypes.CDLL(str(self.game / 'oo2core_9_win64.dll'))
                    fn = library.OodleLZ_Decompress
                    fn.restype = ctypes.c_ssize_t
                    fn.argtypes = [ctypes.c_void_p, ctypes.c_ssize_t, ctypes.c_void_p, ctypes.c_ssize_t,
                                   ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_ssize_t,
                                   ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ssize_t, ctypes.c_int]
                    self.oodle = (library, fn)
                dest = ctypes.create_string_buffer(raw_size)
                size_out = self.oodle[1](block, len(block), dest, raw_size, 1, 0, 0, None, 0, None, None, None, 0, 3)
                require(size_out == raw_size, 'Oodle returned unexpected size')
                raw = dest.raw
            else:
                raise FormatError(f'Unsupported Frostbite codec {codec}')
            require(len(raw) == raw_size, 'Decompressed block size mismatch')
            require(len(output) + len(raw) <= MAX_ASSET, 'Decompressed asset limit')
            output.extend(raw)
        require(len(output) == entry['original'], 'Decompressed asset size mismatch')
        raw_hash, packed_hash = hashlib.sha1(output).hexdigest(), hashlib.sha1(packed).hexdigest()
        require(entry['sha1'] in (raw_hash, packed_hash), 'Archive SHA1 mismatch')
        return bytes(output), {'sha1Decoded': raw_hash, 'sha1Packed': packed_hash, 'codecs': dict(codecs)}

def index_archives(archives, profile, clips, work):
    needed = set(clips) | set(profile.get('researchAssets', [])) | set(profile['dofAssets'].values()) | {profile['skeleton'], profile['rig']}
    assets, report = {}, []
    for area in ('Data', 'Patch'):
        for filename in TOCS:
            path = archives.game / area / 'Win32' / filename
            if not path.exists():
                continue
            data, counts = path.read_bytes(), collections.Counter()
            meta = unpack(data, 556, '>15I')
            require(meta[2] <= 100000, 'TOC bundle count limit')
            for bundle in range(meta[2]):
                _, _, bundle_offset = unpack(data, 556 + meta[1] + 16 * bundle, '>IIQ')
                base = 556 + bundle_offset
                header = unpack(data, base, '>9I')
                flags = span(data, base + header[2], header[3])
                require(len(flags) <= 200001, 'CAS entry count limit')
                cursor, route, routes = base + header[4], (0, 0, 0), []
                for flag in flags:
                    if flag & 128:
                        route = unpack(data, cursor, '>HiH')
                        cursor += 8
                    offset, size = unpack(data, cursor, '>II')
                    cursor += 8
                    routes.append((*route, offset, size))
                require(bool(routes), 'Bundle has no CAS metadata route')
                blob = archives.packed({'route': routes[0]})
                total, ne, nr, nc, strings, _, _ = unpack(blob, 8, '<7I')
                require(total == ne + nr + nc and total <= 200000, 'Invalid bundle counts')
                require(len(routes) == total + 1, 'Bundle route/asset count mismatch')
                res_base = 36 + 20 * total + 8 * (ne + nr)
                for i in range(ne + nr):
                    name_offset, original = unpack(blob, 36 + 20 * total + 8 * i, '<II')
                    name = cstring(blob, strings + 4 + name_offset)
                    kind = 'ebx' if i < ne else 'res'
                    counts[kind] += 1
                    entry = dict(name=name, kind=kind, original=original, route=routes[i + 1],
                                 toc=str(path.relative_to(archives.game)), bundle=bundle,
                                 sha1=span(blob, 36 + 20 * i, 20).hex())
                    if kind == 'res':
                        ri = i - ne
                        entry['resType'], = unpack(blob, res_base + 4 * ri, '<I')
                        entry['resMeta'] = span(blob, res_base + 4 * nr + 16 * ri, 16).hex()
                    if (name in needed or name.endswith('/toolchanneltodofassetdata') or
                            (kind == 'res' and entry['resType'] == MOTION_TYPE)):
                        assets[kind + ':' + name] = entry
            row = dict(area=area, toc=filename, counts=dict(counts))
            report.append(row)
            print(json.dumps(row), flush=True)
    write_json(work / 'asset-index.json', assets)
    write_json(work / 'index-report.json', {'archives': report, 'retained': len(assets), 'filter': 'selected dependencies + all motion RES metadata'})
    write_json(work / 'motion-candidates.json', [a for a in assets.values() if a.get('resType') == MOTION_TYPE])
    write_json(work / 'layout-data.json', archives.layout)
    return assets

def read_asset(archives, assets, kind, name, manifest, work, filename=None):
    key = kind + ':' + name
    require(key in assets, f'Missing {key}; rerun index with this selection/build profile')
    entry = assets[key]
    data, checks = archives.decompress(entry)
    manifest[key] = dict(entry, **checks)
    if filename:
        (work / 'extracted' / filename).write_bytes(data)
    return data

def extract_and_bind(archives, assets, profile, clips, work):
    out = work / 'extracted'
    out.mkdir(parents=True, exist_ok=True)
    manifest = {}
    def load(name, kind='ebx', filename=None):
        return read_asset(archives, assets, kind, name, manifest, work, filename)
    data = load(profile['skeleton'], filename='skeleton_player.ebx')
    base = 32 + efix(data)['objects'][0]
    skeleton = {}
    for name, field in [('BoneNames', 40), ('Hierarchy', 88), ('LocalPose', 120), ('ModelPose', 96), ('BoneNameHashes', 56)]:
        if name == 'BoneNames':
            pointer = base + field
            target = pointer + unpack(data, pointer, '<q')[0]
            count, = unpack(data, target - 4, '<I')
            require(count <= 4096, 'Skeleton count limit')
            skeleton[name] = [cstring(data, target + 8 * i + unpack(data, target + 8 * i, '<q')[0]) for i in range(count)]
        elif name in ('LocalPose', 'ModelPose'):
            skeleton[name] = [list(x) for x in relative_array(data, base, field, '16f', 4096)]
        else:
            skeleton[name] = scalar_array(data, base, field, 'i' if name == 'Hierarchy' else 'I', 4096)
    require(len(set(skeleton['BoneNames'])) == len(skeleton['BoneNames']), 'Duplicate bone names')
    require(all(-1 <= p < i for i, p in enumerate(skeleton['Hierarchy'])), 'Invalid bone hierarchy')
    require(all(len(v) == len(skeleton['BoneNames']) for v in skeleton.values()), 'Skeleton array mismatch')
    write_json(out / 'skeleton.json', skeleton)
    data = load(profile['rig'], filename='player_rig.ebx')
    fix = efix(data)
    base = 32 + fix['objects'][0]
    refs = scalar_array(data, base, 56, 'q', 4096)
    ids = scalar_array(data, base, 72, 'I', 100000)
    indices = scalar_array(data, base, 80, 'I', 4096)
    require(len(refs) == len(indices), 'Rig refs/index count mismatch')
    mapping, sets = {}, []
    for i, ref in enumerate(refs):
        start = indices[i]
        if start == 0xFFFFFFFF:
            continue
        end = next((x for x in indices[i + 1:] if x <= len(ids)), len(ids))
        require(0 <= start <= end <= len(ids), 'Invalid DOF interval')
        require(ref & 1 and 0 <= (ref >> 1) < len(fix['imports']), 'Expected external DOF set')
        guid = fix['imports'][ref >> 1]['fileGuid']
        name = profile['dofAssets'].get(guid)
        require(name is not None, f'Unknown DOF GUID {guid}; profile extension required')
        ds = load(name)
        ds_fix = efix(ds)
        require(ds_fix['fileGuid'] == guid, 'DOF GUID/profile mismatch')
        words = scalar_array(ds, 32 + ds_fix['objects'][0], 40, 'Q', 100000)
        layout = struct.pack('<' + 'Q' * len(words), *words)
        name_base, = unpack(layout, 16, '<I')
        for j in range(end - start):
            slot = 32 + 32 * j
            require(slot + 32 <= name_base, 'DOF slots overlap string table')
            typ, _, _, name_offset = unpack(layout, slot, '<4I')
            mapping[ids[start + j]] = {'name': cstring(layout, name_base + name_offset), 'type': typ}
        sets.append({'name': name, 'guid': guid, 'start': start, 'end': end})
    write_json(out / 'dof-map.json', mapping)
    write_json(out / 'rig-dependencies.json', sets)
    bindings, stems = {}, set()
    for name in clips:
        stem = name.rsplit('/', 1)[-1]
        require(re.fullmatch(r'[A-Za-z0-9_.-]+', stem) is not None and stem not in stems, 'Unsafe/duplicate clip stem')
        stems.add(stem)
        data = load(name, filename=stem + '.ebx')
        resource = load(name, 'res', stem + '.res')
        base, fix = vbr_base(data)
        ref, = unpack(data, base + 64, '<Q')
        require(ref & 1 and (ref >> 1) < len(fix['imports']), 'Expected external channel map')
        guid = fix['imports'][ref >> 1]['fileGuid']
        table = load('_af/' + guid[:18] + '/toolchanneltodofassetdata')
        table_fix = efix(table)
        require(table_fix['fileGuid'] == guid, 'Channel map GUID mismatch')
        channel_ids = scalar_array(table, 32 + table_fix['objects'][0], 40, 'I', 4096)
        require(all(i in mapping for i in channel_ids), 'Unresolved channel IDs')
        channels = [mapping[i] for i in channel_ids]
        q = [x['name'][:-2] for x in channels if x['type'] == 14]
        v = [x['name'] for x in channels if x['type'] in (0x7A2E5497, 0x7A2E53C6)]
        f = [x['name'] for x in channels if x['type'] == 10]
        require(len(q) + len(v) + len(f) == len(channels), 'Unsupported channel type')
        bindings[stem] = dict(assetName=name, channelToDofGuid=guid, channels=channels, qNames=q, vNames=v, fNames=f)
        print('Bound', stem, 'Q/V/F', len(q), len(v), len(f), flush=True)
    write_json(work / 'bindings.json', bindings)
    write_json(work / 'source-manifest.json', manifest)
    return bindings

def pack(work, bindings):
    clips = {}
    for stem, binding in bindings.items():
        motion = read_json(work / 'extracted' / (stem + '.motion.json'))
        for field, names in [('quaternions', 'qNames'), ('vectors', 'vNames'), ('floats', 'fNames')]:
            require(len(motion[field]) == motion['frameCount'], 'Frame count mismatch')
            require(all(len(frame) == len(binding[names]) for frame in motion[field]), 'Channel count mismatch')
            motion[names] = binding[names]
        clips[stem] = motion
    write_json(work / 'data.json', {'skeleton': read_json(work / 'extracted/skeleton.json'), 'clips': clips})
    print('Wrote', work / 'data.json', 'with', len(clips), 'clips', flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', type=Path, required=True, help='Owner-installed FC27 Lite PC folder; read only')
    parser.add_argument('--work', type=Path, required=True, help='Writable generated output/cache folder, outside the game')
    parser.add_argument('--profile', type=Path, default=HERE / 'fc27-lite-profile.json')
    parser.add_argument('--stage', choices=['index', 'assets', 'decode', 'pack', 'all'], default='all')
    parser.add_argument('--clip', action='append', default=[], help='Additional full asset name; rerun index when adding')
    parser.add_argument('--codec-source', type=Path, help='Optional pristine, hash-matching upstream VbrClip.cs')
    args = parser.parse_args()
    args.game, args.work = args.game.resolve(), args.work.resolve()
    require(not args.work.is_relative_to(args.game), 'Work/output folder must be outside game installation')
    args.work.mkdir(parents=True, exist_ok=True)
    profile = read_json(args.profile)
    clips = list(dict.fromkeys(profile['clips'] + args.clip))
    archives = Archives(args.game)
    if args.stage in ('all', 'index'):
        index_archives(archives, profile, clips, args.work)
    if args.stage in ('all', 'assets'):
        assets = read_json(args.work / 'asset-index.json')
        extract_and_bind(archives, assets, profile, clips, args.work)
    if args.stage in ('all', 'decode'):
        from bootstrap_decoder import prepare_decoder
        project = prepare_decoder(args.work / 'decoder', args.codec_source)
        bindings = read_json(args.work / 'bindings.json')
        subprocess.run(['dotnet', 'run', '--project', str(project), '--verbosity', 'quiet', '--', str(args.work), *bindings], check=True)
    if args.stage in ('all', 'pack'):
        pack(args.work, read_json(args.work / 'bindings.json'))

if __name__ == '__main__':
    try:
        main()
    except (FormatError, OSError, subprocess.CalledProcessError) as error:
        print('Extraction failed:', error, file=sys.stderr)
        sys.exit(1)
