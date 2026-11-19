/** Device-aware renderer/streaming limits. Full native CPU rig is retained in every profile. */
export function renderProfile({width=1024,coarse=false,mobile=false,memory=8,quality=null}={}){
 const low=quality==='low'||(quality!=='high'&&(mobile||(coarse&&width<1100)||memory<=4));
 return {name:low?'mobile':'desktop',low,antialias:!low,pixelRatio:low?1:1.5,fps:low?30:60,shadows:!low,compactPalette:low,assetRoot:low?'./character/mobile/':'./character/',cacheBytes:(low?8:32)*1024*1024,maxClips:low?24:64,maxConcurrent:low?1:3,maxPending:low?24:64,prefetchCount:low?1:2};
}

export function browserRenderProfile(){return renderProfile({width:innerWidth,coarse:matchMedia('(pointer: coarse)').matches,mobile:navigator.userAgentData?.mobile||/Android|iPhone|iPad/i.test(navigator.userAgent),memory:navigator.deviceMemory||8,quality:new URLSearchParams(location.search).get('quality')});}
