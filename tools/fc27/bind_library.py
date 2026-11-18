"""Inspect and bind every extracted animation without re-reading its payload from CAS."""
import collections,json,struct
from pathlib import Path
from extract_fc27 import Archives,read_json,write_json
from extract_library import animation_base,KNOWN_TAGS
from formats import efix,unpack,scalar_array,cstring,require

def refresh(work,game,guid_index=None):
    require(not work.resolve().is_relative_to(game.resolve()),'Output must be outside game')
    archives=Archives(game); assets=read_json(work/'asset-index.json');rows=read_json(work/'catalog.json')
    mapping=read_json(work/'shared/dof-map.json'); dependencies={};errors=[]
    cache=read_json(guid_index) if guid_index else {}
    if not guid_index and (work/'dependency-index.json').exists():
        for entry in read_json(work/'dependency-index.json').values():
            try:
                data,_=archives.decompress(entry);fix=efix(data)
                cache[fix['fileGuid']]=entry
            except Exception as error:
                errors.append({'name':entry['name'],'error':str(error)})
        write_json(work/'dependency-guid-index.json',cache)
    # Optional verified GUID index is build-specific. Never trust GUID-to-name association without checking the file.
    def get(guid):
        a=cache.get(guid); require(a is not None,'Missing dependency GUID '+guid)
        d,checks=archives.decompress(a); f=efix(d);require(f['fileGuid']==guid,'Dependency GUID mismatch')
        dependencies[guid]=dict(a,**checks);return d,f
    for guid,a in cache.items():
        if not any(x in a['name'].lower() for x in ('rig','dof')):continue
        try:
            d,f=get(guid);b=32+f['objects'][0]
            if f['classes'][unpack(d,b,'<H')[0]]!='eff09df1-81da-e67e-6e55-f06f5aec2b88':continue
            refs=scalar_array(d,b,56,'q',4096);ids=scalar_array(d,b,72,'I',100000);indices=scalar_array(d,b,80,'I',4096)
            require(len(refs)==len(indices),'Rig interval count mismatch')
            for i,ref in enumerate(refs):
                start=indices[i]
                if start==0xffffffff:continue
                end=next((x for x in indices[i+1:] if x<=len(ids)),len(ids))
                require(0<=start<=end<=len(ids),'Rig interval bounds')
                require(ref&1 and (ref>>1)<len(f['imports']),'External rig DOF set required')
                ds,df=get(f['imports'][ref>>1]['fileGuid']);words=scalar_array(ds,32+df['objects'][0],40,'Q',100000)
                layout=struct.pack('<'+'Q'*len(words),*words);nb=unpack(layout,16,'<I')[0]
                for j in range(end-start):
                    require(32+32*j+32<=nb,'DOF layout overlap')
                    typ,_,_,no=unpack(layout,32+32*j,'<4I');entry={'name':cstring(layout,nb+no),'type':typ};key=str(ids[start+j])
                    require(key not in mapping or mapping[key]==entry,'Conflicting global DOF ID '+key)
                    mapping[key]=entry
        except Exception as e:errors.append({'guid':guid,'name':a['name'],'error':str(e)})
    write_json(work/'shared/expanded-dof-map.json',mapping)
    write_json(work/'binding-dependency-report.json',{'dependencies':dependencies,'probeErrors':errors})
    tables={};stats=collections.Counter()
    for n,row in enumerate(rows,1):
        try:
            d=(work/'extracted'/(row['id']+'.ebx')).read_bytes();base,fix=animation_base(d)
            row['codec']=KNOWN_TAGS[d[base+40:base+44]];row['frames']=unpack(d,base+56,'<H')[0]+1
            row['baseFlags']=d[base+80]
            ref=unpack(d,base+64,'<Q')[0];require(ref&1 and (ref>>1)<len(fix['imports']),'Missing external channel map')
            guid=fix['imports'][ref>>1]['fileGuid'];row['channelMapGuid']=guid
            if guid not in tables:
                entry=assets.get('ebx:_af/'+guid[:18]+'/toolchanneltodofassetdata');require(entry is not None,'Channel map absent')
                td,_=archives.decompress(entry);tf=efix(td);require(tf['fileGuid']==guid,'Channel map GUID mismatch')
                tables[guid]=scalar_array(td,32+tf['objects'][0],40,'I',4096)
            ids=tables[guid];row['channelIds']=ids
            unknown=[x for x in ids if str(x) not in mapping]
            if unknown:row.update(bindingStatus='unresolved',unknownChannelIds=unknown)
            else:
                channels=[mapping[str(x)] for x in ids]
                q=[x['name'][:-2] if x['name'].endswith('.q') else x['name'] for x in channels if x['type']==14]
                v=[x['name'] for x in channels if x['type'] in (0x7a2e5497,0x7a2e53c6)]
                f=[x['name'] for x in channels if x['type']==10]
                require(len(q)+len(v)+len(f)==len(ids),'Unsupported channel type')
                row.update(bindingStatus='bound',qNames=q,vNames=v,fNames=f)
                row.pop('unknownChannelIds',None)
            row.pop('metadataError',None)
        except Exception as e:row['metadataError']=str(e);row.setdefault('codec','unknown');row['bindingStatus']='unresolved'
        stats[(row.get('codec'),row.get('bindingStatus'))]+=1
        if n%10000==0:print('BINDINGS',n,flush=True)
    write_json(work/'catalog.json',rows);write_json(work/'channel-maps.json',tables)
    print('BINDINGS COMPLETE',len(mapping),'named DOFs',dict(stats),flush=True)
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--work',type=Path,required=True);p.add_argument('--game',type=Path,required=True);p.add_argument('--guid-index',type=Path)
    a=p.parse_args();refresh(a.work,a.game,a.guid_index)