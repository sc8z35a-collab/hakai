import * as THREE from '../vendor/three.module.js';

export const FLOOR_HEIGHT = 4.2;
export const FLOOR_NAMES = ['RECEPTION / ロビー','COMMONS / カフェ','WORKSPACE / コワーキング','OPEN OFFICE / オフィス','CONFERENCE / 会議室','DESIGN STUDIO / スタジオ','LIBRARY / ライブラリー','EXECUTIVE / 役員フロア','SKY LOUNGE / ラウンジ','WINTER GARDEN / スカイガーデン'];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(.5, .5, 1, 12);
const leafGeo = new THREE.IcosahedronGeometry(1, 1);

export function createMaterials() {
  const standard = (color, roughness = .65, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
  return {
    concrete:standard('#cbd0c9'), slab:standard('#cbd3cc'), white:standard('#efede4'), wall:standard('#d5dbd1'),
    metal:standard('#768f94', .25, .7), darkMetal:standard('#3d5355', .35, .6), silver:standard('#c0ced0', .25, .65),
    glass:new THREE.MeshPhysicalMaterial({color:'#89bcca',metalness:.3,roughness:.12,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false,envMapIntensity:1.15}),
    glassDark:new THREE.MeshPhysicalMaterial({color:'#458d9d',metalness:.38,roughness:.15,transparent:true,opacity:.64,side:THREE.DoubleSide,depthWrite:false}),
    partition:new THREE.MeshPhysicalMaterial({color:'#c0d3cc',transparent:true,opacity:.23,roughness:.12,metalness:.1,depthWrite:false}),
    wood:standard('#b99571'), woodDark:standard('#7e634d'), orange:standard('#d98052'), fabric:standard('#83998b'), cream:standard('#dfd9c7'),
    black:standard('#283b3c', .5), screen:new THREE.MeshStandardMaterial({color:'#77adb0',emissive:'#518389',emissiveIntensity:.35,roughness:.35}),
    green:standard('#638468'), soil:standard('#6a6955'), light:new THREE.MeshStandardMaterial({color:'#f6f2dc',emissive:'#f6efd0',emissiveIntensity:.65}),
    book:[standard('#797f66'),standard('#ca9574'),standard('#6d9599'),standard('#dfceaa')]
  };
}
function box(parent, mat, size, pos = [0,0,0]) {
  const mesh = new THREE.Mesh(boxGeo, mat); mesh.scale.set(...size); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, mat, size, pos) { const m = new THREE.Mesh(cylinderGeo,mat);m.scale.set(...size);m.position.set(...pos);m.castShadow=true;parent.add(m);return m; }
function prop(sim, floor, kind, at, size, construct, yaw = 0) {
  const g = new THREE.Group(); construct(g); g.position.set(...at); g.rotation.y=yaw;
  return sim.addEntity(floor, g, size, at, yaw, kind);
}
function desk(sim,floor,x,z,yaw=0,executive=false){
  prop(sim,floor,'furniture',[x,.65,z],[executive?2.8:2,.95,1.05],g=>{
    const width=executive?2.8:2; box(g,sim.m.wood,[width,.1,1.05],[0,.15,0]);
    for(const dx of [-width/2+.15,width/2-.15])box(g,sim.m.darkMetal,[.07,.72,.82],[dx,-.25,0]);
    box(g,sim.m.black,[.73,.48,.065],[0,.47,-.19]);box(g,sim.m.screen,[.66,.39,.015],[0,.47,-.15]);box(g,sim.m.darkMetal,[.1,.18,.1],[0,.18,-.18]);box(g,sim.m.black,[.37,.025,.13],[0,.22,.2]);box(g,sim.m.white,[.25,.02,.3],[.64,.22,.15]);
  },yaw);
  const off = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  chair(sim,floor,x+off.x*.95,z+off.z*.95,yaw);
}
function chair(sim,floor,x,z,yaw=0,mat){
  prop(sim,floor,'furniture',[x,.57,z],[.59,1,.62],g=>{
    box(g,mat||sim.m.fabric,[.55,.12,.55],[0,-.09,0]);box(g,mat||sim.m.fabric,[.55,.47,.1],[0,.2,.23]);
    box(g,sim.m.darkMetal,[.08,.45,.08],[0,-.37,0]);box(g,sim.m.darkMetal,[.48,.05,.45],[0,-.56,0]);
  },yaw);
}
function sofa(sim,floor,x,z,yaw=0){
  prop(sim,floor,'furniture',[x,.52,z],[2.6,.95,.95],g=>{
    box(g,sim.m.fabric,[2.5,.3,.92],[0,-.12,0]);box(g,sim.m.fabric,[2.5,.58,.19],[0,.22,-.36]);
    for(const dx of [-1.17,1.17])box(g,sim.m.fabric,[.18,.5,.9],[dx,.05,0]);
    for(const dx of [-.75,0,.75])box(g,sim.m.cream,[.67,.12,.63],[dx,.07,.01]);
    for(const dx of [-1,1])box(g,sim.m.woodDark,[.12,.16,.6],[dx,-.42,0]);
  },yaw);
}
function plant(sim,floor,x,z,large=false){
  const s=large?1.5:1;
  prop(sim,floor,'furniture',[x,.8*s,z],[.65*s,1.6*s,.65*s],g=>{
    cylinder(g,sim.m.cream,[.55*s,.57*s,.55*s],[0,-.5*s,0]);cylinder(g,sim.m.woodDark,[.06*s,.85*s,.06*s],[0,.12*s,0]);
    for(let i=0;i<4;i++){const m=new THREE.Mesh(leafGeo,sim.m.green);m.position.set(Math.sin(i*2.4)*.2*s,(.33+i*.1)*s,Math.cos(i*2.4)*.18*s);m.scale.set(.38*s,.32*s,.35*s);g.add(m);m.castShadow=true;}
  });
}
function table(sim,floor,x,z,long=false){
  const w=long?4.7:1.3, d=long?1.65:1.3;
  prop(sim,floor,'furniture',[x,.48,z],[w,.8,d],g=>{
    box(g,sim.m.wood,[w,.1,d],[0,.28,0]);for(const dx of [-w*.36,w*.36])box(g,sim.m.darkMetal,[.13,.72,d*.6],[dx,-.1,0]);
    if(long)for(let i=-1;i<=1;i++)box(g,sim.m.white,[.3,.02,.42],[i*1.2,.345,.15]);
  });
}
function shelf(sim,floor,x,z,yaw=0){
  prop(sim,floor,'furniture',[x,1.2,z],[2.1,2.3,.52],g=>{
    box(g,sim.m.wood,[.08,2.3,.5],[-1.02,0,0]);box(g,sim.m.wood,[.08,2.3,.5],[1.02,0,0]);
    for(let row=0;row<4;row++){const y=-1.1+row*.69;box(g,sim.m.wood,[2,.065,.5],[0,y,0]);for(let j=0;j<8;j++)box(g,sim.m.book[(j+row)%4],[.14,.36+(j%3)*.065,.3],[-.84+j*.225,y+.24,0]);}
  },yaw);
}
function art(sim,floor,x,z,yaw=0){
  prop(sim,floor,'furniture',[x,2.05,z],[1.7,1.05,.07],g=>{box(g,sim.m.woodDark,[1.7,1.05,.06]);box(g,sim.m.cream,[1.6,.95,.02],[0,0,.04]);box(g,sim.m.orange,[.57,.61,.02],[-.23,.05,.06]);box(g,sim.m.fabric,[.5,.35,.02],[.36,-.19,.07]);},yaw);
}
function interior(sim,floor,index){
  // An offset service core leaves a traversable central aisle on every floor.
  for(const x of [-2.45,2.45])sim.addBox(floor,sim.m.wall,[.18,3.65,3.7],[x,2,-3.85],'wall');
  sim.addBox(floor,sim.m.wall,[5.05,3.65,.18],[0,2,-5.68],'wall');
  sim.addBox(floor,sim.m.wall,[1.5,3.65,.18],[-1.76,2,-2],'wall');
  sim.addBox(floor,sim.m.wall,[1.5,3.65,.18],[1.76,2,-2],'wall');
  sim.addBox(floor,sim.m.silver,[1.8,2.9,.12],[0,1.63,-2.02],'furniture');
  sim.addBox(floor,sim.m.darkMetal,[.025,2.85,.14],[0,1.63,-1.94],'furniture');
  sim.addBox(floor,sim.m.black,[.15,.34,.06],[1.12,1.45,-1.85],'furniture');
  // Visible staircase, stairwell rail, ceiling light strips and wayfinding.
  for(let s=0;s<10;s++)sim.addBox(floor,sim.m.concrete,[1.25,.16,.29],[-1.42,.25+s*.35,-5.15+s*.29],'furniture');
  const rail=sim.addBox(floor,sim.m.metal,[.055,3.4,.055],[-.71,2.1,-3.85],'furniture');rail.mesh.rotation.x=.67;
  for(const x of [-6,6])for(const z of [-3.8,3.8])sim.addBox(floor,sim.m.light,[2.7,.06,.16],[x,3.93,z],'furniture');
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#d5dbd1';ctx.fillRect(0,0,512,128);ctx.fillStyle='#43585a';ctx.font='bold 62px sans-serif';ctx.fillText(String(index+1).padStart(2,'0'),18,84);ctx.font='18px sans-serif';ctx.fillText(FLOOR_NAMES[index].split(' / ')[0],140,74);const tex=new THREE.CanvasTexture(labelCanvas);tex.colorSpace=THREE.SRGBColorSpace;sim.ownedTextures.push(tex);
  const signmat=new THREE.MeshStandardMaterial({map:tex});sim.ownedMaterials.push(signmat);sim.addBox(floor,signmat,[2.05,.52,.025],[0,3.42,-1.9],'furniture');
  if(index===0){
    prop(sim,floor,'furniture',[0,.68,1.7],[4.5,1.15,1.2],g=>{box(g,sim.m.wood,[4.5,1.15,1.2]);box(g,sim.m.cream,[4.65,.09,1.25],[0,.61,0]);box(g,sim.m.black,[.7,.42,.1],[-1,.86,-.1]);});
    sofa(sim,floor,-6,3.6);sofa(sim,floor,6,3.6);table(sim,floor,-6,5.1);table(sim,floor,6,5.1);plant(sim,floor,-8,-5,true);plant(sim,floor,8,-5,true);
    for(const x of [-7.5,7.5])sim.addBox(floor,sim.m.wood,[.5,3.65,2],[x,2,-.5],'wall');
  }else if(index===1){
    prop(sim,floor,'furniture',[-6,1.1,-4],[5,2,1.3],g=>{box(g,sim.m.wood,[5,1.2,1.3],[0,-.4,0]);box(g,sim.m.darkMetal,[5.1,.08,1.35],[0,.23,0]);box(g,sim.m.silver,[.9,.8,.6],[.8,.66,0]);box(g,sim.m.black,[.4,.8,.6],[-.15,.66,0]);});
    for(const x of [-6,0,6])for(const z of [1.2,5.6]){table(sim,floor,x,z);chair(sim,floor,x,z+1.05);chair(sim,floor,x,z-1.05,Math.PI);}
    shelf(sim,floor,6,-5);plant(sim,floor,8,6.5);
  }else if(index===2||index===3||index===5){
    for(const x of [-6,6])for(const z of [-4.5,-.6,3.3])desk(sim,floor,x,z,index===5?Math.PI/2:0);
    if(index===3)for(const x of [-6,6])sim.addBox(floor,sim.m.partition,[3.3,1.1,.06],[x,1.6,-2.7],'glass');
    if(index===5){for(const x of [-2.8,2.8])prop(sim,floor,'furniture',[x,1.2,4.7],[1.6,2.1,.2],g=>{box(g,sim.m.white,[1.6,1.1,.08],[0,.35,0]);box(g,sim.m.wood,[.06,2,.06],[-.6,0,0]);box(g,sim.m.wood,[.06,2,.06],[.6,0,0]);box(g,sim.m.orange,[.3,.3,.02],[-.3,.4,.055]);});}
    shelf(sim,floor,-6,6.8);shelf(sim,floor,6,6.8);plant(sim,floor,8,-6.5);plant(sim,floor,-8,-6.5);
  }else if(index===4){
    for(const x of [-5.6,5.6]){table(sim,floor,x,1.4,true);for(const dx of [-1.5,0,1.5]){chair(sim,floor,x+dx,2.9);chair(sim,floor,x+dx,-.1,Math.PI);}sim.addBox(floor,sim.m.partition,[.06,3.4,8],[x>0?2.7:-2.7,1.9,1.6],'glass');prop(sim,floor,'furniture',[x,2.1,-6],[2.7,1.5,.1],g=>{box(g,sim.m.black,[2.7,1.5,.1]);box(g,sim.m.screen,[2.56,1.36,.02],[0,0,.06]);});}plant(sim,floor,-8,6.7);plant(sim,floor,8,6.7);
  }else if(index===6){
    for(const x of [-7.7,-4.5,4.5,7.7])for(const z of [-3.6,.2])shelf(sim,floor,x,z,Math.PI/2);
    for(const x of [-5,5]){table(sim,floor,x,5.5,true);for(const dx of [-1.4,1.4])chair(sim,floor,x+dx,6.7);}plant(sim,floor,0,6.7);
  }else if(index===7){
    desk(sim,floor,-6,-1.5,0,true);desk(sim,floor,6,-1.5,0,true);sofa(sim,floor,-6,4);sofa(sim,floor,6,4);table(sim,floor,-6,5.5);table(sim,floor,6,5.5);shelf(sim,floor,-6,-6.5);shelf(sim,floor,6,-6.5);art(sim,floor,-2.33,-3.6,Math.PI/2);plant(sim,floor,8,6.5,true);plant(sim,floor,-8,6.5,true);
  }else if(index===8){
    for(const x of [-5.8,5.8]){sofa(sim,floor,x,1);sofa(sim,floor,x,5.3,Math.PI);table(sim,floor,x,3.15);}prop(sim,floor,'furniture',[5,1,-5],[5,1.7,1.3],g=>{box(g,sim.m.woodDark,[5,1.7,1.3]);box(g,sim.m.wood,[5.1,.12,1.5],[0,.86,0]);});for(let i=0;i<3;i++)chair(sim,floor,3.5+i*1.5,-3.5);plant(sim,floor,-8,-5,true);plant(sim,floor,0,6,true);
  }else{
    for(const x of [-6.3,6.3])for(const z of [-4.8,0,4.8]){plant(sim,floor,x,z,true);plant(sim,floor,x+1.1,z+.5);}
    for(const x of [-3.8,3.8]){sofa(sim,floor,x,5.5,Math.PI);table(sim,floor,x,3.9);}sim.addBox(floor,sim.m.wood,[7,.12,5.7],[0,.24,2.8],'floor');
  }
  for(const x of [-8.6,8.6])plant(sim,floor,x,0);
}

function perimeter(){
  const points=[];const corners=[[8.6,6.6,0],[-8.6,6.6,Math.PI/2],[-8.6,-6.6,Math.PI],[8.6,-6.6,Math.PI*1.5]];
  // Counterclockwise rounded rectangle, regularly subdivided for independent panes.
  for(let c=0;c<4;c++){
    const [cx,cz,start]=corners[c];
    for(let j=0;j<=4;j++){const a=start+j*Math.PI/8;points.push(new THREE.Vector2(cx+Math.cos(a)*2.4,cz+Math.sin(a)*2.4));}
    const last=points[points.length-1];const next=corners[(c+1)%4];const firstNext=new THREE.Vector2(next[0]+Math.cos(next[2])*2.4,next[1]+Math.sin(next[2])*2.4);
    const steps=Math.ceil(last.distanceTo(firstNext)/1.68);for(let k=1;k<steps;k++)points.push(last.clone().lerp(firstNext,k/steps));
  }
  return points;
}
export function buildGlasshouse(sim){
  const perimeterPoints=perimeter();
  for(let n=0;n<10;n++){
    const floor=sim.createFloor(n,n*FLOOR_HEIGHT+.12);
    // Each slab is tiled: blast holes remove only the nearby concrete cells.
    for(let ix=0;ix<6;ix++)for(let iz=0;iz<5;iz++){
      const x=(ix-2.5)*3.56,z=(iz-2)*3.46;
      sim.addBox(floor,sim.m.slab,[3.55,.3,3.45],[x,0,z],'floor');
      sim.addBox(floor,n===0?sim.m.cream:n===9?sim.m.wood:sim.m.white,[3.53,.045,3.43],[x,.173,z],'finish');
    }
    const columns=[[-8.2,-6.5],[-8.2,0],[-8.2,6.5],[8.2,-6.5],[8.2,0],[8.2,6.5],[-2.75,-6.5],[2.75,-6.5],[-2.75,6.5],[2.75,6.5]];
    for(const [x,z] of columns)sim.addBox(floor,sim.m.concrete,[.48,4.03,.48],[x,2.08,z],'column');
    for(let i=0;i<perimeterPoints.length;i++){
      const a=perimeterPoints[i],b=perimeterPoints[(i+1)%perimeterPoints.length];const center=a.clone().add(b).multiplyScalar(.5);const len=a.distanceTo(b),yaw=-Math.atan2(b.y-a.y,b.x-a.x);
      // Leave an actual entrance on the south face of the ground floor.
      const entrance=n===0&&Math.abs(center.x)<2&&center.y>8.8;
      if(!entrance)sim.addBox(floor,(i+n)%5===0?sim.m.glassDark:sim.m.glass,[len-.075,3.57,.055],[center.x,2.19,center.y],'glass',yaw);
      sim.addBox(floor,sim.m.silver,[.075,4.2,.13],[a.x,2.1,a.y],'frame',yaw);
      sim.addBox(floor,sim.m.metal,[len,.43,.17],[center.x,.37,center.y],'frame',yaw);
      sim.addBox(floor,sim.m.silver,[len,.065,.09],[center.x,3.78,center.y],'frame',yaw);
      if(n===9)sim.addBox(floor,sim.m.silver,[.075,.9,.12],[a.x,4.57,a.y],'frame',yaw);
    }
    interior(sim,floor,n);
    if(n===9){
      for(let ix=0;ix<6;ix++)for(let iz=0;iz<5;iz++)sim.addBox(floor,sim.m.silver,[3.55,.2,3.45],[(ix-2.5)*3.56,4.22,(iz-2)*3.46],'floor');
      for(const x of [-3.8,3.8])prop(sim,floor,'furniture',[x,4.84,-2.2],[3.1,1,2.4],g=>{box(g,sim.m.silver,[3.1,1,2.4]);for(let i=0;i<9;i++)box(g,sim.m.darkMetal,[.17,.015,2.1],[-1.25+i*.31,.515,0]);});
      sim.addBox(floor,sim.m.metal,[.055,3,.055],[7,5.6,-5.7],'frame');
    }
  }
  sim.totalStructural=sim.entities.filter(e=>e.kind==='column'||e.kind==='floor').length;
  sim.totalEntities=sim.entities.length;
  sim.scene.updateMatrixWorld(true);
}
