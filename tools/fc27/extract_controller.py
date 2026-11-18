"""Export selected FC27 controller settings and neural IK weights. See docs/CONTROLLER.md.
Uses the filtered index made with --profile controller-profile.json. Reads game files only.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
from extract_fc27 import Archives, read_json, write_json
from formats import efix, unpack, scalar_array, relative_array, cstring, require, FormatError
HERE = Path(__file__).resolve().parent

def pointer(data, offset, fix):
    ref, = unpack(data, offset, '<Q')
    if not ref: return None
    if ref & 1:
        require((ref >> 1) < len(fix['imports']), 'External reference range')
        return fix['imports'][ref >> 1]
    # Native RIFF object references store signed 32-bit relative offsets in the low word.
    delta, = unpack(data, offset, '<i')
    target = offset + delta - 32
    require(target in fix['objects'], f'Internal pointer is not an object: {target}')
    return {'internalOffset': target}

def decode_objects(data, schemas):
    fix = efix(data)
    objects = []
    for offset in fix['objects']:
        base = 32 + offset
        type_index, = unpack(data, base, '<H')
        require(type_index < len(fix['classes']), 'Object type index')
        guid = fix['classes'][type_index]
        schema = schemas.get(guid)
        values, unresolved = {}, {}
        if schema and schema['name'] != 'PTMLocomotionControllerAsset':
            for field in schema['fields']:
                p, typ, name = base + field['offset'], field['type'], field['name']
                try:
                    if typ in ('float','int','uint','bool','long'):
                        value, = unpack(data,p,{'float':'<f','int':'<i','uint':'<I','bool':'<?','long':'<q'}[typ])
                    elif typ == 'PointerRef': value = pointer(data,p,fix)
                    elif typ in ('List<float>','List<uint>','List<int>','List<bool>'):
                        value = scalar_array(data,base,field['offset'],{'List<float>':'f','List<uint>':'I','List<int>':'i','List<bool>':'?'}[typ],1000000)
                    elif typ == 'List<IntVec>':
                        # SIMD IntVec storage contains packed float bits for PTM feature weights.
                        value = [v for row in relative_array(data,base,field['offset'],'4f') for v in row]
                    elif typ == 'List<PointerRef>':
                        delta, = unpack(data,p,'<q'); start = p + delta
                        refs = scalar_array(data,base,field['offset'],'Q')
                        value = [pointer(data,start+8*i,fix) for i in range(len(refs))]
                    elif typ == 'CString':
                        delta, = unpack(data,p,'<q'); value = cstring(data,p+delta)
                    elif typ == 'List<CString>':
                        delta, = unpack(data,p,'<q'); start = p+delta
                        refs = scalar_array(data,base,field['offset'],'q')
                        value = [cstring(data,start+8*i+ref) for i,ref in enumerate(refs)]
                    elif typ in ('Vec4','Vec3'): value=list(unpack(data,p,'<4f' if typ=='Vec4' else '<3f'))
                    elif field['encoding'] == 24704: value,=unpack(data,p,'<i')
                    else: raise FormatError('Unsupported field type '+typ)
                    if isinstance(value,float): require(math.isfinite(value),'Nonfinite scalar')
                    if isinstance(value,list): require(all(not isinstance(v,float) or math.isfinite(v) for v in value),'Nonfinite array')
                    values[name] = value
                except (FormatError,UnicodeError,IndexError) as error: unresolved[name]=str(error)
        elif schema:
            unresolved['layout']='FC27 adds fields to the FC26 root controller layout; root fields are deliberately not interpreted.'
        objects.append({'offset':offset,'classGuid':guid,'schema':schema['name'] if schema else None,'values':values,'unresolved':unresolved})
    return fix,objects

def networks_from(report):
    networks={}
    for asset in report:
        if not asset['name'].endswith(('/knee_loco_dnn','/arm1_loco_dnn','/chest_loco_dnn')): continue
        by_offset={o['offset']:o for o in asset['objects']}
        matches=[o for o in asset['objects'] if o['schema']=='DNNAsset']
        require(len(matches)==1,'Expected one neural model')
        model=dict(matches[0]['values']); layers=[]; count=model['NumInputs']
        for ref in model['Layers']:
            layer=by_offset[ref['internalOffset']]
            require(layer['schema']=='DNNLayer' and not layer['unresolved'],'Unsupported/unresolved neural layer')
            values=layer['values']; require(values['NumInputs']==count,'Network chain mismatch')
            if values['LayerType']==0:
                require(len(values['Weights'])==values['NumInputs']*values['NumNodes'] and len(values['Bias'])==values['NumNodes'],'Dense dimensions')
            elif values['LayerType']==1:
                require(values['NumNodes']==count and len(values['Alphas'])==count,'LeakyReLU dimensions')
            else: raise FormatError('Unsupported neural activation')
            count=values['NumNodes']; layers.append(values)
        require(len(layers)==model['NumLayers'] and count==model['NumOutputs'],'Network output/layer dimensions')
        require(len(model['InputMins'])==model['NumInputs'] and len(model['InputMaxs'])==model['NumInputs'],'Input normalization dimensions')
        require(len(model['OutputMins'])==count and len(model['OutputMaxs'])==count,'Output normalization dimensions')
        model['Layers']=layers;networks[asset['name'].rsplit('/',1)[-1]]=model
    require(len(networks)==3,'Missing expected locomotion IK models')
    return networks

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--game',type=Path,required=True);ap.add_argument('--work',type=Path,required=True);ap.add_argument('--profile',type=Path,default=HERE/'controller-profile.json');ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
    require(not args.out.resolve().is_relative_to(args.game.resolve()),'Output must be outside game')
    profile=read_json(args.profile);index=read_json(args.work/'asset-index.json');schemas=read_json(HERE/'controller-schema.json')['types'];archives=Archives(args.game);report=[];raw=args.out/'raw';raw.mkdir(parents=True,exist_ok=True)
    for name in profile['researchAssets']:
        key='ebx:'+name;require(key in index,'Missing '+key+'; index with controller-profile.json')
        data,checks=archives.decompress(index[key]);fix,objects=decode_objects(data,schemas);filename=hashlib.sha256(name.encode()).hexdigest()[:12]+'-'+name.rsplit('/',1)[-1]+'.ebx';(raw/filename).write_bytes(data)
        report.append({'name':name,'fileGuid':fix['fileGuid'],'sha1':hashlib.sha1(data).hexdigest(),'archiveSha1':index[key]['sha1'],'rawFile':'raw/'+filename,'checks':checks,'objects':objects})
    networks=networks_from(report);write_json(args.out/'controller-assets.json',report);write_json(args.out/'neural-ik.json',networks)
    if (args.work/'data.json').exists():
        data=read_json(args.work/'data.json');data['clips']={k:c for k,c in data['clips'].items() if any(s in k for s in profile['runtimeClipStems'])};require(len(data['clips'])==13,'Expected thirteen controller clips');write_json(args.out/'controller-data.json',data)
    summary={'assets':len(report),'networks':{k:{'inputs':m['NumInputs'],'outputs':m['NumOutputs'],'layers':m['NumLayers'],'denseWeights':sum(len(l['Weights']) for l in m['Layers'])} for k,m in networks.items()},'unresolvedFields':sum(len(o['unresolved']) for a in report for o in a['objects']),'interpretation':'SDK-assisted, bounded structural validation. Native runtime equivalence is not established.'}
    write_json(args.out/'validation.json',summary);print(json.dumps(summary,indent=2))
if __name__=='__main__':
    try:main()
    except (FormatError,OSError,ValueError,KeyError) as error:print('Controller extraction failed:',error,file=sys.stderr);sys.exit(1)
