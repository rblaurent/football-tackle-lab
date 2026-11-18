/** Validated shared binary reader for native frame/channel payloads. */
export async function inflateBytes(data){const raw=data instanceof Uint8Array?data:new Uint8Array(data);if(raw[0]!==31||raw[1]!==139)return raw;return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
export function decodeMotion(data,binding){
 const raw=data instanceof Uint8Array?data:new Uint8Array(data);if(raw.byteLength<24)throw Error('Truncated motion header');const h=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);if(h.getUint32(0,true)!==0x314c4346)throw Error('Unknown motion format');
 const [frames,q,v,f,fps]=[4,8,12,16,20].map(i=>h.getInt32(i,true)),width=4*q+3*v+f;
 if(frames<1||frames>36000||q<0||v<0||f<0||width>8192||fps!==30||raw.byteLength!==24+4*frames*width)throw Error('Motion header/size limit');
 if(!binding||q!==binding.qNames.length||v!==binding.vNames.length||f!==binding.fNames.length)throw Error('Motion binding count mismatch');
 // Buffers returned by inflate are aligned; copy only if a caller supplied an unaligned view.
 const bytes=(raw.byteOffset+24)%4?raw.slice():raw,values=new Float32Array(bytes.buffer,bytes.byteOffset+24,frames*width);if(!values.every(Number.isFinite))throw Error('Nonfinite motion sample');
 const quaternions=[],vectors=[],floats=[];for(let frame=0;frame<frames;frame++){let p=frame*width;const qa=[],va=[];for(let i=0;i<q;i++){const value=values.subarray(p,p+4);p+=4;const norm=Math.hypot(...value);if(norm<.9||norm>1.1)throw Error('Invalid quaternion norm');qa.push(value);}for(let i=0;i<v;i++){va.push(values.subarray(p,p+3));p+=3;}quaternions.push(qa);vectors.push(va);floats.push(values.subarray(p,p+f));}
 return {...binding,frameCount:frames,fps,quaternions,vectors,floats,bufferBytes:raw.byteLength,residentEstimate:raw.byteLength+frames*((q+v+1)*96+128)+100000};
}
export async function fetchJSONGzip(url){const response=await fetch(url);if(!response.ok)throw Error('Animation database HTTP '+response.status);return JSON.parse(new TextDecoder().decode(await inflateBytes(await response.arrayBuffer())));}