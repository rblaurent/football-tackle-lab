/** Shared native-foot sole proxy. Identical geometry in rendering and the final pose solve. */
import * as T from './vendor/three.module.js';
export function bootContact(foot,orientation,toe){
 const forward=toe.clone().sub(foot).setY(0).normalize(),side=new T.Vector3().crossVectors(new T.Vector3(0,1,0),forward).normalize(),inverse=orientation.clone().invert();
 const part=(height,radii)=>({center:forward.clone().multiplyScalar(.065).add(new T.Vector3(0,height,0)).applyQuaternion(inverse),axes:[side.clone().multiplyScalar(radii[0]).applyQuaternion(inverse),new T.Vector3(0,radii[1],0).applyQuaternion(inverse),forward.clone().multiplyScalar(radii[2]).applyQuaternion(inverse)]});
 return {sole:part(-.065,[.08,.015,.156]),shoe:part(-.005,[.078,.069,.153])};
}
export function soleClearance(proxy,orientation){const c=proxy.center.clone().applyQuaternion(orientation),ys=proxy.axes.map(a=>a.clone().applyQuaternion(orientation).y);return -c.y+Math.hypot(...ys);}
export function proxyMatrix(proxy){const m=new T.Matrix4().makeBasis(...proxy.axes);m.setPosition(proxy.center);return m;}
