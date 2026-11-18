"""Resumable complete installed-motion inventory/export. Never modifies the game.
Raw clips and per-clip decode failures are retained; binding is a separate status.
"""
import argparse, collections, hashlib, json, shutil, struct, subprocess, sys, time
from pathlib import Path
from extract_fc27 import Archives, MOTION_TYPE, read_json, write_json as base_write_json, HERE
from formats import unpack, span, cstring, require, vbr_base, efix, scalar_array

def write_json(path,value):
    # Checkpoints survive interruption: replace only after the new JSON is complete.
    partial=path.with_name(path.name+'.partial')
    base_write_json(partial,value)
    partial.replace(path)

def entries(archives, reports):
    for area in ('Data', 'Patch'):
        root = archives.game / area / 'Win32'
        for path in sorted(root.rglob('*.toc')) if root.exists() else []:
            row = {'toc': str(path.relative_to(archives.game)), 'counts': {}}
            counts = collections.Counter()
            try:
                data = path.read_bytes()
                meta = unpack(data, 556, '>15I')
                require(meta[2] <= 100000, 'TOC bundle limit')
                for bundle in range(meta[2]):
                    _, _, off = unpack(data, 556 + meta[1] + 16 * bundle, '>IIQ')
                    base = 556 + off
                    header = unpack(data, base, '>9I')
                    flags = span(data, base + header[2], header[3])
                    require(len(flags) <= 200001, 'CAS entry limit')
                    cursor, route, routes = base + header[4], (0,0,0), []
                    for flag in flags:
                        if flag & 128:
                            route = unpack(data, cursor, '>HiH'); cursor += 8
                        offset, size = unpack(data, cursor, '>II'); cursor += 8
                        routes.append((*route, offset, size))
                    require(bool(routes), 'Missing metadata route')
                    blob = archives.packed({'route': routes[0]})
                    total, ne, nr, nc, strings, _, _ = unpack(blob, 8, '<7I')
                    require(total == ne + nr + nc and total <= 200000, 'Invalid bundle counts')
                    require(len(routes) == total + 1, 'Route count mismatch')
                    res_base = 36 + 20 * total + 8 * (ne + nr)
                    for i in range(ne + nr):
                        no, original = unpack(blob, 36 + 20 * total + 8*i, '<II')
                        name = cstring(blob, strings + 4 + no)
                        kind = 'ebx' if i < ne else 'res'
                        counts[kind] += 1
                        entry = dict(name=name, kind=kind, original=original, route=routes[i+1],
                                     toc=row['toc'], bundle=bundle, sha1=span(blob,36+20*i,20).hex())
                        if kind == 'res':
                            ri = i-ne
                            entry['resType'], = unpack(blob,res_base+4*ri,'<I')
                            entry['resMeta'] = span(blob,res_base+4*nr+16*ri,16).hex()
                        yield entry
                row['status'] = 'indexed'
            except Exception as error:
                row.update(status='failed', error=str(error))
            row['counts'] = dict(counts)
            reports.append(row)
            print(json.dumps(row), flush=True)

def index(archives, work, seed):
    assets, reports, dependencies = {}, [], {}
    names = set()
    if seed:
        names = {a['name'] for a in read_json(seed).values() if a.get('resType') == MOTION_TYPE}
    for a in entries(archives, reports):
        if a['kind']=='ebx' and a['name'].startswith(('antifreeze/','_af/')):
            dependencies[a['name']]=a
        if (a.get('resType') == MOTION_TYPE or a['name'] in names or
                a['name'].endswith('/toolchanneltodofassetdata')):
            assets[a['kind']+':'+a['name']] = a
    names = {a['name'] for a in assets.values() if a.get('resType') == MOTION_TYPE}
    missing = {n for n in names if 'ebx:'+n not in assets}
    if missing:
        extra_reports = []
        for a in entries(archives, extra_reports):
            if a['kind'] == 'ebx' and a['name'] in missing:
                assets['ebx:'+a['name']] = a
        reports += extra_reports
    write_json(work/'dependency-index.json',{name:a for name,a in dependencies.items() if name not in names})
    write_json(work/'asset-index.json',assets)
    write_json(work/'coverage.json',{'archives':reports,'motionResources':len(names),
        'missingEbx':sorted(n for n in names if 'ebx:'+n not in assets),
        'scope':'All recursively discovered Data/Win32 and Patch/Win32 TOCs, named AnimationAssetRelocResource after overlays. Not uninstalled DLC or unidentified resource types.'})
    print('INDEX COMPLETE',len(names),'motions',len(assets),'retained records',flush=True)

KNOWN_TAGS = {b' RBV':'VBR', b' TCD':'DCT', b' WAR':'RAW', b'MARF':'FRAM', b'PLCE':'ECLIPSE', b'VRUC':'CURVE'}
def animation_base(data):
    fix=efix(data)
    hits=[32+x for x in fix['objects'] if data[32+x+40:32+x+44] in KNOWN_TAGS]
    require(len(hits)==1, f'Expected one known animation object, found {len(hits)}')
    return hits[0],fix

def extract(archives, work, dependency_work):
    assets = read_json(work/'asset-index.json')
    mapping = read_json(dependency_work/'extracted/dof-map.json')
    extracted = work/'extracted'; extracted.mkdir(exist_ok=True)
    shared = work/'shared'; shared.mkdir(exist_ok=True)
    for name in ('skeleton.json','dof-map.json','rig-dependencies.json'):
        shutil.copyfile(dependency_work/'extracted'/name,shared/name)
    maps, catalog, statuses = {}, [], collections.Counter()
    previous = {}
    if (work/'catalog.json').exists():
        previous={r['id']:r for r in read_json(work/'catalog.json')}
    journal = (work/'extraction-log.jsonl').open('a',encoding='utf-8')
    motions = sorted((a for a in assets.values() if a.get('resType')==MOTION_TYPE),key=lambda a:a['name'])
    for number, resource in enumerate(motions,1):
        name = resource['name']; ident = hashlib.sha256(name.encode()).hexdigest()[:24]
        require(ident not in {r['id'] for r in catalog[-1:]},'Duplicate consecutive asset ID')
        row = dict(id=ident,name=name,resSha1=resource['sha1'],rawBytes=resource['original'])
        ebx = assets.get('ebx:'+name)
        row['ebxSha1'] = ebx['sha1'] if ebx else None
        old = previous.get(ident)
        if (old and old.get('resSha1')==row['resSha1'] and old.get('ebxSha1')==row['ebxSha1']
                and old.get('rawStatus')=='verified' and (extracted/(ident+'.res')).exists()
                and (extracted/(ident+'.ebx')).exists()
                and all(hashlib.sha1((extracted/(ident+'.'+kind)).read_bytes()).hexdigest()==old.get(kind+'Checks',{}).get('sha1Decoded') for kind in ('ebx','res'))):
            row=old
        else:
            try:
                for suffix in ('.validation.json','.motion.bin.gz','.motion.json','.error.json'):
                    (extracted/(ident+suffix)).unlink(missing_ok=True)
                for kind, entry in [('res',resource),('ebx',ebx)]:
                    require(entry is not None,'Missing companion EBX')
                    data, checks = archives.decompress(entry)
                    (extracted/(ident+'.'+kind)).write_bytes(data)
                    row[kind+'Checks']=checks
                    if kind=='ebx': descriptor=data
                row['rawStatus']='verified'
                try:
                    base, fix = animation_base(descriptor)
                    row['codec']=KNOWN_TAGS[descriptor[base+40:base+44]]
                    row['frames']=unpack(descriptor,base+56,'<H')[0]+1
                    if row['codec']=='VBR': row['keys']=unpack(descriptor,base+154,'<H')[0]
                    ref=unpack(descriptor,base+64,'<Q')[0]
                    require(ref&1 and (ref>>1)<len(fix['imports']),'Nonexternal channel map')
                    guid=fix['imports'][ref>>1]['fileGuid']
                    row['channelMapGuid']=guid
                    if guid not in maps:
                        table=assets.get('ebx:_af/'+guid[:18]+'/toolchanneltodofassetdata')
                        require(table is not None,'Missing channel map '+guid)
                        data, _=archives.decompress(table); tf=efix(data)
                        require(tf['fileGuid']==guid,'Channel map GUID mismatch')
                        maps[guid]=scalar_array(data,32+tf['objects'][0],40,'I',4096)
                    ids=maps[guid]; row['channelIds']=ids
                    unknown=[x for x in ids if str(x) not in mapping]
                    if unknown:
                        row.update(bindingStatus='unresolved',unknownChannelIds=unknown)
                    else:
                        channels=[mapping[str(x)] for x in ids]
                        q=[x['name'][:-2] if x['name'].endswith('.q') else x['name'] for x in channels if x['type']==14]
                        v=[x['name'] for x in channels if x['type'] in (0x7a2e5497,0x7a2e53c6)]
                        f=[x['name'] for x in channels if x['type']==10]
                        require(len(q)+len(v)+len(f)==len(ids),'Unsupported channel type')
                        row.update(bindingStatus='bound',qNames=q,vNames=v,fNames=f)
                except Exception as error:
                    row.setdefault('codec','unknown'); row.setdefault('bindingStatus','unresolved')
                    row['metadataError']=str(error)
            except Exception as error:
                row.update(rawStatus='failed',error=str(error))
            journal.write(json.dumps(row,separators=(',',':'))+'\n'); journal.flush()
        catalog.append(row); statuses[row['rawStatus']+'/'+row.get('codec','unknown')+'/'+row.get('bindingStatus','unknown')]+=1
        if number%500==0:
            write_json(work/'catalog.json',catalog)
            print('EXTRACT',number,'/',len(motions),dict(statuses),flush=True)
    require(len({r['id'] for r in catalog})==len(catalog),'Asset ID collision')
    journal.close(); write_json(work/'catalog.json',catalog)
    write_json(work/'channel-maps.json',maps)
    print('EXTRACTION COMPLETE',dict(statuses),flush=True)

def decode(work, source):
    from bootstrap_decoder import prepare_decoder
    project=prepare_decoder(work/'decoder',source)
    subprocess.run(['dotnet','build',str(project),'-c','Release','--verbosity','quiet'],check=True)
    rows=read_json(work/'catalog.json')
    names=[r['id'] for r in rows if r.get('codec')=='VBR' and r.get('rawStatus')=='verified']
    manifest=work/'decode-list.txt'; manifest.write_text('\n'.join(names),encoding='utf-8')
    subprocess.run(['dotnet',str(work/'decoder/bin/Release/net9.0/Decoder.dll'),str(work),'@'+str(manifest),'--binary','--resume'],check=True)
    subprocess.run([sys.executable,str(HERE/'decode_other.py'),'--work',str(work)],check=True)

def report(work):
    rows=read_json(work/'catalog.json'); status=collections.Counter(); total=0
    for row in rows:
        val=work/'extracted'/(row['id']+'.validation.json')
        err=work/'extracted'/(row['id']+'.error.json')
        payload=work/'extracted'/(row['id']+'.motion.bin.gz')
        if val.exists() and payload.exists():
            row['decodeStatus']='decoded'; row['validation']=read_json(val); total+=payload.stat().st_size
            row['decodedBytes']=payload.stat().st_size
        elif err.exists():
            row['decodeStatus']='failed'; row['decodeError']=read_json(err)
        else: row['decodeStatus']='not-decoded'
        status[(row['rawStatus'],row.get('codec'),row.get('bindingStatus'),row['decodeStatus'])]+=1
    write_json(work/'catalog.json',rows)
    result={'total':len(rows),'groups':[{'raw':a,'codec':b,'binding':c,'decode':d,'count':n} for (a,b,c,d),n in status.items()],
            'decodedCompressedBytes':total,'coverage':read_json(work/'coverage.json')}
    write_json(work/'summary.json',result)
    print(json.dumps({k:v for k,v in result.items() if k!='coverage'},indent=2),flush=True)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--game',type=Path,required=True); p.add_argument('--work',type=Path,required=True)
    p.add_argument('--stage',choices=['index','extract','bind','decode','report','all'],default='all')
    p.add_argument('--seed-index',type=Path); p.add_argument('--dependency-work',type=Path)
    p.add_argument('--codec-source',type=Path)
    a=p.parse_args(); a.work=a.work.resolve(); a.game=a.game.resolve()
    require(not a.work.is_relative_to(a.game),'Output must be outside game')
    a.work.mkdir(parents=True,exist_ok=True)
    if a.stage in ('index','all'): index(Archives(a.game),a.work,a.seed_index)
    if a.stage in ('extract','all'):
        require(a.dependency_work is not None,'--dependency-work with verified skeleton and DOF map required')
        extract(Archives(a.game),a.work,a.dependency_work)
    if a.stage in ('bind','all'):
        from bind_library import refresh
        refresh(a.work,a.game)
    if a.stage in ('decode','all'): decode(a.work,a.codec_source)
    if a.stage in ('report','all'): report(a.work)
if __name__=='__main__': main()