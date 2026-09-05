import * as THREE from '../vendor/three.module.js';
import * as CANNON from '../vendor/cannon-es.js';
import {buildGlasshouse, createMaterials} from './building.js';

export const WEAPONS = [
  {name:'C4',radius:4.2,power:200,color:0xec8146},
  {name:'BREACH',radius:7,power:280,color:0xf5b064},
  {name:'SEISMIC',radius:11,power:380,color:0xf8b262},
  {name:'CATACLYSM',radius:17,power:550,color:0xffb97e},
  {name:'MISSILE',radius:7.3,power:310,color:0xff9955}
];
const vec = new THREE.Vector3();
const boxGeometry = new THREE.BoxGeometry(1,1,1);
const sphereGeometry = new THREE.IcosahedronGeometry(1,1);
const orientation = new THREE.Quaternion();
const cannonV = v => new CANNON.Vec3(v.x,v.y,v.z);
const densities = {glass:2500,column:2350,floor:2350,ground:2200,frame:2400,finish:1000,wall:900,furniture:150};
const hitpoints = {glass:9,column:115,floor:100,ground:145,frame:65,finish:20,wall:45,furniture:25};

export class Simulation {
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8eeed');this.scene.fog=new THREE.FogExp2('#e8eeed',.0033);
    this.camera=new THREE.PerspectiveCamera(47,innerWidth/innerHeight,.08,1300);
    this.m=createMaterials();
    this.scene.add(new THREE.HemisphereLight(0xe9f6ff,0xb5b8a5,2.7));
    const sun=new THREE.DirectionalLight(0xfff4df,3.3);sun.position.set(-45,78,38);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=60;sun.shadow.camera.bottom=-45;sun.shadow.camera.far=200;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;this.scene.add(sun);this.sun=sun;
    const rim=new THREE.DirectionalLight(0xc5e3ed,1.3);rim.position.set(35,35,-45);this.scene.add(rim);
    this.makeEnvironment();this.makeGround();
    this.ownedTextures=[];this.ownedMaterials=[];this.reset();
  }
  makeEnvironment(){
    const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,512);g.addColorStop(0,'#6898b0');g.addColorStop(.45,'#e2f1f5');g.addColorStop(.54,'#d6e0df');g.addColorStop(1,'#778780');ctx.fillStyle=g;ctx.fillRect(0,0,1024,512);
    for(let i=0;i<24;i++){ctx.fillStyle=i%3===0?'rgba(255,255,255,.44)':'rgba(98,144,162,.12)';ctx.fillRect(i*49,90,12+i%5*5,245);}
    const tex=new THREE.CanvasTexture(c);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
    const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromEquirectangular(tex);this.scene.environment=this.environment.texture;tex.dispose();pmrem.dispose();
  }
  makeGround(){
    // Four unbroken outer strips + a tiled, destructible foundation at the center.
    const mat=new THREE.MeshStandardMaterial({color:'#e5e9e2',roughness:.95});
    this.groundGroup=new THREE.Group();this.scene.add(this.groundGroup);
    for(const [w,d,x,z] of [[2000,980,0,-510],[2000,980,0,510],[980,40,-510,0],[980,40,510,0]]){
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,.4,d),mat);m.position.set(x,-.36,z);m.receiveShadow=true;this.groundGroup.add(m);
    }
    const lower=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardMaterial({color:'#c5cdc3',roughness:1}));lower.rotation.x=-Math.PI/2;lower.position.y=-1.6;lower.receiveShadow=true;this.groundGroup.add(lower);
    const grid=new THREE.GridHelper(1200,240,0xa1b2aa,0xc2cec5);grid.position.y=-.148;grid.material.transparent=true;grid.material.opacity=.52;this.groundGroup.add(grid);
    // Small orange survey corners; no buildings or surrounding scenery.
    const paint=new THREE.MeshBasicMaterial({color:'#d6865e',transparent:true,opacity:.6});
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const g=new THREE.Group();g.position.set(sx*15,.005,sz*12.8);
      const a=new THREE.Mesh(boxGeometry,paint);a.scale.set(2.4,.015,.065);a.position.x=-sx*1.2;g.add(a);
      const b=new THREE.Mesh(boxGeometry,paint);b.scale.set(.065,.015,2.4);b.position.z=-sz*1.2;g.add(b);this.groundGroup.add(g);
    }
  }
  reset(){
    if(this.floors)for(const f of this.floors)this.scene.remove(f.group);
    if(this.debris)for(const d of this.debris){this.scene.remove(d.mesh);if(d.ownedGeometry)d.mesh.geometry.dispose();}
    if(this.effects)for(const e of this.effects)this.disposeEffect(e);
    if(this.charges)for(const c of this.charges)c.mesh.removeFromParent();
    if(this.missiles)for(const m of this.missiles){this.scene.remove(m.mesh);m.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}
    for(const t of this.ownedTextures)t.dispose();for(const m of this.ownedMaterials)m.dispose();this.ownedTextures=[];this.ownedMaterials=[];
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0)});this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.allowSleep=true;this.world.solver.iterations=10;this.world.solver.tolerance=.005;
    this.physicsMaterial=new CANNON.Material('structure');this.world.defaultContactMaterial.friction=.48;this.world.defaultContactMaterial.restitution=.06;
    const base=new CANNON.Body({mass:0,shape:new CANNON.Plane()});base.quaternion.setFromEuler(-Math.PI/2,0,0);base.position.y=-1.62;this.world.addBody(base);
    for(const [w,d,x,z] of [[2000,980,0,-510],[2000,980,0,510],[980,40,-510,0],[980,40,510,0]]){
      const b=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,.2,d/2)),position:new CANNON.Vec3(x,-.36,z)});this.world.addBody(b);
    }
    this.entities=[];this.hitMeshes=[];this.floors=[];this.debris=[];this.effects=[];this.charges=[];this.missiles=[];this.clock=0;this.timeScale=1;this.paused=false;this.shake=0;this.collapsedCount=0;this.lastStructureCheck=0;
    this.foundation=this.createFloor(-1,-.38);
    for(let x=-18;x<=18;x+=4)for(let z=-18;z<=18;z+=4)this.addBox(this.foundation,this.m.slab,[3.99,.44,3.99],[x,0,z],'ground');
    buildGlasshouse(this);
    this.player=new CANNON.Body({mass:75,shape:new CANNON.Sphere(.34),position:new CANNON.Vec3(0,60,80),linearDamping:.85,fixedRotation:true,collisionFilterGroup:2,collisionFilterMask:0});this.player.allowSleep=false;this.world.addBody(this.player);
  }
  createFloor(index,y){
    const group=new THREE.Group();group.position.y=y;this.scene.add(group);
    const body=new CANNON.Body({mass:0,material:this.physicsMaterial,position:new CANNON.Vec3(0,y,0),linearDamping:.13,angularDamping:.42});
    this.world.addBody(body);
    const floor={index,group,body,entities:[],dynamic:false,retired:false,releaseAt:Infinity,expires:Infinity,shake:0,mass:0};this.floors.push(floor);return floor;
  }
  addBox(floor,mat,size,at,kind,yaw=0){
    const mesh=new THREE.Mesh(boxGeometry,mat);mesh.scale.set(...size);mesh.position.set(...at);mesh.rotation.y=yaw;mesh.castShadow=kind!=='glass';mesh.receiveShadow=true;
    return this.addEntity(floor,mesh,size,at,yaw,kind);
  }
  addEntity(floor,mesh,size,at,yaw,kind){
    floor.group.add(mesh);
    const mass=Math.max(.5,size[0]*size[1]*size[2]*(densities[kind]||500));
    const shape=new CANNON.Box(new CANNON.Vec3(size[0]/2,size[1]/2,size[2]/2));const quat=new CANNON.Quaternion();quat.setFromEuler(0,yaw,0);
    floor.body.addShape(shape,new CANNON.Vec3(...at),quat);
    const entity={mesh,floor,kind,size,shape,mass,hp:hitpoints[kind]||30,maxHp:hitpoints[kind]||30,alive:true};
    mesh.traverse(o=>{if(o.isMesh){o.userData.entity=entity;this.hitMeshes.push(o);}});
    floor.entities.push(entity);floor.mass+=mass;this.entities.push(entity);return entity;
  }
  raycast(origin,direction,maxDistance=160){
    this.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(origin,direction,.05,maxDistance);
    const result=ray.intersectObjects(this.hitMeshes,false);
    return result.find(h=>h.object.userData.entity?.alive)||null;
  }
  addCharge(hit,weapon){
    const entity=hit.object.userData.entity;if(!entity?.alive)return false;
    const mesh=new THREE.Group();
    const shell=new THREE.Mesh(boxGeometry,this.m.orange);shell.scale.set(.38,.25,.17);mesh.add(shell);
    const band=new THREE.Mesh(boxGeometry,this.m.black);band.scale.set(.08,.27,.18);mesh.add(band);
    const led=new THREE.Mesh(sphereGeometry,this.m.light);led.scale.setScalar(.035);led.position.set(.12,.07,.1);mesh.add(led);
    const normal=hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):new THREE.Vector3(0,1,0);
    mesh.position.copy(hit.point).addScaledVector(normal,.12);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);this.scene.add(mesh);
    entity.mesh.attach(mesh);this.charges.push({mesh,weapon,entity});return true;
  }
  detonate(){
    if(!this.charges.length)return 0;
    this.scene.updateMatrixWorld(true);const charges=this.charges.map(c=>({pos:c.mesh.getWorldPosition(new THREE.Vector3()),weapon:c.weapon}));const count=charges.length;
    for(const c of this.charges)c.mesh.removeFromParent();this.charges=[];
    for(const c of charges)this.explode(c.pos,c.weapon);return count;
  }
  fireMissile(origin,direction){
    const g=new THREE.Group();const material=new THREE.MeshStandardMaterial({color:0x616e65,metalness:.5,roughness:.4});
    const rocket=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,1.25,8),material);rocket.rotation.x=Math.PI/2;g.add(rocket);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.12,.36,8),material);nose.rotation.x=-Math.PI/2;nose.position.z=-.8;g.add(nose);
    const fire=new THREE.Mesh(new THREE.ConeGeometry(.13,.8,8),new THREE.MeshBasicMaterial({color:0xffbf78}));fire.rotation.x=Math.PI/2;fire.position.z=.9;g.add(fire);
    g.position.copy(origin).addScaledVector(direction,1);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);this.scene.add(g);
    this.missiles.push({mesh:g,direction:direction.clone(),life:0});
  }
  spawnDebris(mesh,size,mass,position,quaternion,blast,force,kind,ownedGeometry=false,inheritedVelocity){
    this.scene.add(mesh);mesh.position.copy(position);mesh.quaternion.copy(quaternion);
    mesh.castShadow=kind!=='glass';mesh.receiveShadow=true;
    const body=new CANNON.Body({mass:Math.max(mass,.15),material:this.physicsMaterial,shape:new CANNON.Box(new CANNON.Vec3(Math.max(.018,size[0]/2),Math.max(.018,size[1]/2),Math.max(.018,size[2]/2))),position:cannonV(position),quaternion:new CANNON.Quaternion(quaternion.x,quaternion.y,quaternion.z,quaternion.w),linearDamping:.07,angularDamping:.12});
    const outward=position.clone().sub(blast);const length=outward.length();if(length<.15)outward.set(Math.random()-.5,.6,Math.random()-.5);outward.normalize();
    const speed=force*(kind==='glass'?1.2:.7);body.velocity.set(outward.x*speed+(Math.random()-.5)*2,outward.y*speed+3+Math.random()*3,outward.z*speed+(Math.random()-.5)*2);
    if(inheritedVelocity)body.velocity.vadd(inheritedVelocity,body.velocity);
    body.angularVelocity.set((Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*5);body.sleepSpeedLimit=.2;body.sleepTimeLimit=1;
    this.world.addBody(body);this.debris.push({mesh,body,expires:this.clock+5,ownedGeometry});return body;
  }
  destroyEntity(e,blast,strength){
    if(!e.alive)return;e.alive=false;e.hp=0;
    const p=e.mesh.getWorldPosition(new THREE.Vector3()),q=e.mesh.getWorldQuaternion(new THREE.Quaternion());
    // Charges attached to a broken element remain attached to its first rigid fragment.
    const attached=this.charges.filter(c=>c.entity===e);for(const c of attached)this.scene.attach(c.mesh);
    e.floor.body.removeShape(e.shape);e.mesh.removeFromParent();
    let firstFragment;
    if(e.kind==='glass'){
      const count=8;
      for(let i=0;i<count;i++){
        const sx=e.size[0]/2,sy=e.size[1]/4;
        const off=new THREE.Vector3((i%2-.5)*sx,(Math.floor(i/2)-1.5)*sy,0).applyQuaternion(q).add(p);
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-sx*.46,-sy*.43,0,sx*.46,-sy*.36,0,(Math.random()-.5)*sx,sy*.45,0],3));geometry.computeVertexNormals();
        const mesh=new THREE.Mesh(geometry,e.mesh.material);this.spawnDebris(mesh,[sx*.9,sy*.9,.045],Math.max(.15,e.mass/count),off,q,blast,strength,'glass',true,e.floor.body.velocity);if(!firstFragment)firstFragment=mesh;
      }
    }else if(e.kind==='floor'||e.kind==='column'||e.kind==='ground'){
      const count=e.kind==='column'?3:4;
      for(let i=0;i<count;i++){
        const size=e.kind==='column'?[e.size[0],e.size[1]/3,e.size[2]]:[e.size[0]/2,e.size[1],e.size[2]/2];
        const offset=e.kind==='column'?new THREE.Vector3(0,(i-1)*size[1],0):new THREE.Vector3((i%2-.5)*size[0],0,(Math.floor(i/2)-.5)*size[2]);offset.applyQuaternion(q).add(p);
        const mesh=new THREE.Mesh(boxGeometry,e.mesh.material);mesh.scale.set(...size);this.spawnDebris(mesh,size,e.mass/count,offset,q,blast,strength,e.kind,false,e.floor.body.velocity);if(!firstFragment)firstFragment=mesh;
      }
    }else{this.spawnDebris(e.mesh,e.size,e.mass,p,q,blast,strength,e.kind,false,e.floor.body.velocity);firstFragment=e.mesh;}
    if(firstFragment){firstFragment.updateMatrixWorld(true);for(const c of attached){firstFragment.attach(c.mesh);c.fragment=firstFragment;}}
  }
  explode(position,weaponIndex=0){
    const weapon=WEAPONS[weaponIndex];this.scene.updateMatrixWorld(true);
    let destroyed=0;
    for(const e of this.entities){
      if(!e.alive)continue;const center=e.mesh.getWorldPosition(vec);
      // Distance to oriented element AABB, not only its center: wide slabs can be hit at an edge.
      e.mesh.getWorldQuaternion(orientation);
      const delta=position.clone().sub(center).applyQuaternion(orientation.clone().invert());
      const dx=Math.max(0,Math.abs(delta.x)-e.size[0]/2),dy=Math.max(0,Math.abs(delta.y)-e.size[1]/2),dz=Math.max(0,Math.abs(delta.z)-e.size[2]/2);
      const distance=Math.hypot(dx,dy,dz);if(distance>weapon.radius)continue;
      const attenuation=Math.pow(1-distance/weapon.radius,1.35);e.hp-=weapon.power*attenuation;
      if(e.hp<=0){this.destroyEntity(e,position,6+attenuation*weapon.radius*2);destroyed++;}
    }
    this.hitMeshes=this.hitMeshes.filter(m=>m.userData.entity?.alive);
    for(const d of this.debris){const diff=d.mesh.position.clone().sub(position);const distance=diff.length();if(distance<weapon.radius*1.25&&distance>.1){diff.normalize().multiplyScalar(d.body.mass*8*(1-distance/(weapon.radius*1.25)));d.body.applyImpulse(cannonV(diff));d.body.wakeUp();}}
    for(const f of this.floors){
      if(f.index<0||f.retired)continue;f.shake=Math.min(.018,f.shake+.05/(1+Math.abs(f.body.position.y-position.y)/5));
      if(f.dynamic){const diff=new THREE.Vector3(f.body.position.x,f.body.position.y+2,f.body.position.z).sub(position);const distance=diff.length();if(distance<weapon.radius*1.6){diff.normalize().multiplyScalar(f.body.mass*2*(1-distance/(weapon.radius*1.6)));f.body.applyImpulse(cannonV(diff),new CANNON.Vec3(position.x-f.body.position.x,position.y-f.body.position.y,position.z-f.body.position.z));}}
    }
    this.makeExplosion(position,weapon.radius,weapon.color);
    this.shake=Math.max(this.shake,weapon.radius*.025);this.checkStructure();
    if(this.onExplosion)this.onExplosion(position,weapon.radius,destroyed);
  }
  checkStructure(){
    for(const f of this.floors){
      if(f.index<0||f.retired||f.dynamic)continue;
      const columns=f.entities.filter(e=>e.kind==='column');const support=columns.reduce((sum,e)=>sum+Math.max(0,e.hp/e.maxHp),0)/columns.length;
      const slabs=f.entities.filter(e=>e.kind==='floor');const floorRatio=slabs.filter(e=>e.alive).length/slabs.length;
      if(support<.57){for(const upper of this.floors)if(upper.index>f.index&&!upper.dynamic)upper.releaseAt=Math.min(upper.releaseAt,this.clock+.15+(upper.index-f.index)*.14);}
      if(floorRatio<.5){for(const upper of this.floors)if(upper.index>=f.index&&!upper.dynamic)upper.releaseAt=Math.min(upper.releaseAt,this.clock+.15+(upper.index-f.index)*.14);}
    }
    const groundRemaining=this.foundation.entities.filter(e=>e.alive&&Math.abs(e.mesh.position.x)<12&&Math.abs(e.mesh.position.z)<12).length;
    if(groundRemaining<9)for(const floor of this.floors)if(floor.index>=0)floor.releaseAt=Math.min(floor.releaseAt,this.clock+.15+floor.index*.14);
  }
  releaseFloor(floor){
    if(floor.dynamic||floor.retired)return;floor.dynamic=true;floor.releaseAt=Infinity;floor.expires=this.clock+5;this.collapsedCount++;
    const b=floor.body;b.type=CANNON.Body.DYNAMIC;b.mass=floor.entities.filter(e=>e.alive).reduce((s,e)=>s+e.mass,0);b.updateMassProperties();b.wakeUp();
    // Center of surviving supports biases the initial topple direction.
    const below=this.floors.find(f=>f.index===floor.index-1);let x=0,z=0,count=0;
    if(below)for(const e of below.entities)if(e.kind==='column'&&e.alive){x+=e.mesh.position.x;z+=e.mesh.position.z;count++;}
    if(count){x/=count;z/=count;}else{x=.8;z=-.5;}
    b.angularVelocity.set(-z*.022,0,x*.022);b.velocity.set(-x*.13,-.35,-z*.13);
    // Once a rigid floor strikes the ground hard enough, loose fixtures break away.
    b.addEventListener('collide',event=>{
      const impact=Math.abs(event.contact.getImpactVelocityAlongNormal());
      if(impact>4&&this.clock-(floor.lastImpact||0)>.4){floor.lastImpact=this.clock;floor.impactBreak=true;this.shake=Math.max(this.shake,Math.min(.18,impact*.009));}
    });
  }
  makeExplosion(position,radius,color){
    const group=new THREE.Group();group.position.copy(position);this.scene.add(group);
    const flash=new THREE.Mesh(sphereGeometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending}));group.add(flash);
    const core=new THREE.Mesh(sphereGeometry,new THREE.MeshBasicMaterial({color:0xfff0c9,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));group.add(core);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.011,5,80),new THREE.MeshBasicMaterial({color:0xeec39c,transparent:true,opacity:.5,depthWrite:false}));ring.rotation.x=Math.PI/2;group.add(ring);
    const light=new THREE.PointLight(color,35,radius*4,1.5);group.add(light);
    const smoke=[];
    for(let i=0;i<22;i++){const mesh=new THREE.Mesh(sphereGeometry,new THREE.MeshStandardMaterial({color:i%3===0?0xb6aaa0:0xbfc2b6,transparent:true,opacity:.25,depthWrite:false,roughness:1}));const direction=new THREE.Vector3(Math.random()-.5,Math.random()*.65+.1,Math.random()-.5).normalize();mesh.position.copy(direction).multiplyScalar(Math.random()*radius*.15);mesh.scale.setScalar(.15);group.add(mesh);smoke.push({mesh,direction,speed:radius*(.12+Math.random()*.2),offset:Math.random()});}
    this.effects.push({group,flash,core,ring,light,smoke,age:0,radius});
  }
  disposeEffect(e){
    this.scene.remove(e.group);e.group.traverse(o=>{if(o.geometry&&o.geometry!==sphereGeometry)o.geometry.dispose();if(o.material)o.material.dispose();});
  }
  tick(realDelta){
    const dt=this.paused?0:Math.min(realDelta,.05)*this.timeScale;this.clock+=dt;
    if(dt>0){
      // Flight body is gravity compensated; collision response remains physical.
      if(this.player.collisionFilterMask)this.player.force.y+=this.player.mass*9.81;
      this.world.step(1/60,dt,5);
    }
    for(const f of this.floors){
      if(f.retired)continue;
      if(this.clock>=f.releaseAt)this.releaseFloor(f);
      f.group.position.copy(f.body.position);f.group.quaternion.copy(f.body.quaternion);
      if(f.shake>.00001&&!f.dynamic){const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(this.clock*17+f.index*.1)*f.shake,0,Math.cos(this.clock*14)*f.shake*.5));f.group.quaternion.multiply(rotation);f.shake*=Math.exp(-dt*2.2);}
      if(f.impactBreak){f.impactBreak=false;this.scene.updateMatrixWorld(true);let detached=0;const p=f.group.position.clone();p.y-=1;for(const e of f.entities){if(e.alive&&(e.kind==='glass'||e.kind==='furniture')&&Math.random()<.15){this.destroyEntity(e,p,3);if(++detached>18)break;}}this.hitMeshes=this.hitMeshes.filter(m=>m.userData.entity?.alive);}
      if(this.clock>=f.expires){
        this.scene.updateMatrixWorld(true);
        for(const c of this.charges)if(c.entity.floor===f&&c.mesh.parent)this.scene.attach(c.mesh);
        this.scene.remove(f.group);this.world.removeBody(f.body);f.retired=true;for(const e of f.entities){e.alive=false;e.hp=0;}this.hitMeshes=this.hitMeshes.filter(m=>m.userData.entity?.alive);
      }
    }
    for(let i=this.debris.length-1;i>=0;i--){
      const d=this.debris[i];d.mesh.position.copy(d.body.position);d.mesh.quaternion.copy(d.body.quaternion);
      if(this.clock>=d.expires){for(const c of this.charges)if(c.fragment===d.mesh)this.scene.attach(c.mesh);this.scene.remove(d.mesh);this.world.removeBody(d.body);if(d.ownedGeometry)d.mesh.geometry.dispose();this.debris.splice(i,1);}
    }
    for(let i=this.missiles.length-1;i>=0;i--){
      const m=this.missiles[i];m.life+=dt;const travel=80*dt;
      const hit=travel>0?this.raycast(m.mesh.position,m.direction,travel+.5):null;
      if(hit||m.life>8){if(hit)this.explode(hit.point,4);this.scene.remove(m.mesh);m.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});this.missiles.splice(i,1);}else m.mesh.position.addScaledVector(m.direction,travel);
    }
    for(let i=this.effects.length-1;i>=0;i--){
      const e=this.effects[i];e.age+=dt;const t=e.age;
      e.flash.scale.setScalar(Math.max(.01,e.radius*.62*Math.sin(Math.min(1,t/.45)*Math.PI)));e.flash.material.opacity=Math.max(0,.7-t*2);
      e.core.scale.setScalar(Math.max(.01,e.radius*.26*(1-t/.22)));e.core.material.opacity=Math.max(0,1-t*5);
      e.ring.scale.setScalar(Math.max(.01,e.radius*(.15+t*1.6)));e.ring.material.opacity=Math.max(0,.36-t*.4);e.light.intensity=Math.max(0,35-t*95);
      for(const s of e.smoke){s.mesh.position.addScaledVector(s.direction,dt*s.speed);s.mesh.position.y+=dt*.8;s.mesh.scale.setScalar((.2+t*.65+s.offset*.3)*e.radius*.18);s.mesh.material.opacity=Math.max(0,Math.min(.27,t*.9)*(1-t/4));}
      if(t>4){this.disposeEffect(e);this.effects.splice(i,1);}
    }
    if(this.clock-this.lastStructureCheck>.2){this.lastStructureCheck=this.clock;this.checkStructure();}
    this.shake*=Math.exp(-dt*3.2);
  }
  stats(){
    const structural=this.entities.filter(e=>e.kind==='column'||e.kind==='floor');
    const integrity=Math.round(structural.reduce((s,e)=>s+(e.alive?Math.max(0,e.hp/e.maxHp):0),0)/this.totalStructural*100);
    return {integrity,debris:this.debris.length+this.floors.filter(f=>f.dynamic&&!f.retired).length,charges:this.charges.length,floors:this.floors.filter(f=>f.index>=0).map(f=>({index:f.index,ratio:f.entities.filter(e=>e.kind==='column').reduce((s,e)=>s+(e.alive?Math.max(0,e.hp/e.maxHp):0),0)/10,dynamic:f.dynamic,retired:f.retired}))};
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  render(){this.renderer.render(this.scene,this.camera);}
}
