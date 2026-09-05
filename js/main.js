import * as THREE from '../vendor/three.module.js';
import {Simulation, WEAPONS} from './simulation.js';
import {FLOOR_NAMES, FLOOR_HEIGHT} from './building.js';

const $=id=>document.getElementById(id);
const canvas=$('world');
let sim;
try{sim=new Simulation(canvas);}catch(error){$('loading-status').textContent='3D空間の起動に失敗しました。WebGLを有効にしてページを再読み込みしてください。';console.error('Simulation startup failed:',error);throw error;}
const camera=sim.camera;
const touch=matchMedia('(pointer:coarse)').matches;
if(touch)document.body.classList.add('touch');
let yaw=0,pitch=0,weapon=0,collision=false,soundEnabled=false,interiorFloor=-1;
let pointer=null,lastPointerX=0,lastPointerY=0,toastTimer,shotCooldown=0;
const keys=new Set();
const joystick={x:0,y:0,id:null};
let touchVertical=0;
const cameraPosition=new THREE.Vector3();
const euler=new THREE.Euler(0,0,0,'YXZ');
const forward=new THREE.Vector3(),right=new THREE.Vector3(),motion=new THREE.Vector3();
const worldUp=new THREE.Vector3(0,1,0);
let target=null,lastHitTime=0,audioContext;

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function setView(position,lookAt){
  cameraPosition.copy(position);camera.position.copy(position);camera.lookAt(lookAt);euler.setFromQuaternion(camera.quaternion,'YXZ');yaw=euler.y;pitch=euler.x;
  sim.player.position.copy(position);sim.player.velocity.setZero();sim.shake=0;
}
function exterior(){
  setView(new THREE.Vector3(55,34,72),new THREE.Vector3(-4,20,0));document.body.classList.remove('exploring');interiorFloor=-1;$('exterior-btn').classList.add('active');
}
function enterInterior(){
  interiorFloor=(interiorFloor+1)%10;
  let tries=0;while(sim.floors.find(f=>f.index===interiorFloor)?.retired&&tries<10){interiorFloor=(interiorFloor+1)%10;tries++;}
  if(tries===10){toast('すべての階が崩壊しています。リセットして再構築してください。');return;}
  const f=sim.floors.find(f=>f.index===interiorFloor);
  sim.scene.updateMatrixWorld(true);
  const p=f.group.localToWorld(new THREE.Vector3(1,1.8,7.7)),look=f.group.localToWorld(new THREE.Vector3(-1.9,1.7,-2));
  setView(p,look);document.body.classList.add('exploring');$('exterior-btn').classList.remove('active');toast(`${String(interiorFloor+1).padStart(2,'0')}F — ${FLOOR_NAMES[interiorFloor]}`);
}
exterior();

for(let i=0;i<10;i++){const bar=document.createElement('span');bar.className='floor-bar';bar.title=`${i+1}F`;bar.dataset.floor=i;$('floor-bars').append(bar);}
function selectWeapon(index){weapon=index;document.querySelectorAll('.weapon').forEach((el,i)=>{el.classList.toggle('active',i===index);el.setAttribute('aria-pressed',String(i===index));});$('place-label').textContent=index===4?'↗ 発射する':'＋ 設置する';if(index===4)toast('MISSILE — 照準方向へ発射。直撃時に爆発します。');}
function aim(){camera.getWorldDirection(forward);target=sim.raycast(cameraPosition,forward,220);return target;}
function placeOrFire(){
  if(sim.paused){toast('一時停止を解除してから操作してください。');return;}
  if(performance.now()<shotCooldown)return;shotCooldown=performance.now()+220;
  if(weapon===4){camera.getWorldDirection(forward);sim.fireMissile(cameraPosition,forward);playLaunch();toast('MISSILE LAUNCHED / ミサイル発射');return;}
  const hit=aim();if(!hit){toast('照準をビル・床・地面に合わせてください。');return;}
  if(sim.addCharge(hit,weapon)){toast(`${WEAPONS[weapon].name} 設置完了 — 「起爆」または G で遠隔起爆`);playBeep();updateHUD();}
}
function detonate(){if(sim.paused){toast('一時停止を解除してから起爆してください。');return;}const count=sim.detonate();if(count)toast(`${count} CHARGES DETONATED / 遠隔起爆`);else toast('爆薬が未設置です。照準を合わせて設置してください。');updateHUD();}
function toggleCollision(){
  collision=!collision;sim.player.collisionFilterMask=collision?1:0;sim.player.position.copy(cameraPosition);sim.player.velocity.setZero();sim.player.wakeUp();
  $('collision-label').textContent=collision?'ON':'OFF';$('collision-btn').setAttribute('aria-pressed',String(collision));toast(collision?'当たり判定 ON — 壁・床・瓦礫に衝突します':'当たり判定 OFF — 壁を通り抜けて自由に飛行できます');
}
function togglePause(){sim.paused=!sim.paused;$('pause-btn').textContent=sim.paused?'▶':'Ⅱ';$('pause-btn').setAttribute('aria-pressed',String(sim.paused));$('pause-btn').setAttribute('aria-label',sim.paused?'再開':'一時停止');toast(sim.paused?'SIMULATION PAUSED / 一時停止':'SIMULATION RESUMED / 再開');}
function toggleSlow(){sim.timeScale=sim.timeScale===1?.2:1;$('speed-label').textContent=sim.timeScale===1?'1.0×':'0.2×';$('slow-btn').setAttribute('aria-pressed',String(sim.timeScale!==1));toast(sim.timeScale===1?'REAL TIME / 通常速度':'SLOW MOTION / 0.2倍速');}
function requestReset(){clearInputs();$('reset-dialog').showModal();}
function reset(){
  sim.reset();sim.player.collisionFilterMask=collision?1:0;exterior();$('pause-btn').textContent='Ⅱ';$('pause-btn').setAttribute('aria-pressed','false');$('speed-label').textContent='1.0×';$('slow-btn').setAttribute('aria-pressed','false');$('reset-dialog').close();updateHUD();toast('EXPERIMENT RESET / ビルを再構築しました');
}
function showHelp(){clearInputs();$('help-dialog').showModal();}
function clearInputs(){keys.clear();joystick.x=0;joystick.y=0;joystick.id=null;touchVertical=0;pointer=null;$('stick-knob').style.transform='';}

for(const el of document.querySelectorAll('.weapon'))el.addEventListener('click',()=>selectWeapon(Number(el.dataset.weapon)));
$('place-btn').addEventListener('click',placeOrFire);$('detonate-btn').addEventListener('click',detonate);
$('collision-btn').addEventListener('click',toggleCollision);$('slow-btn').addEventListener('click',toggleSlow);$('pause-btn').addEventListener('click',togglePause);
$('exterior-btn').addEventListener('click',exterior);$('interior-btn').addEventListener('click',enterInterior);$('next-floor-btn').addEventListener('click',enterInterior);
$('reset-btn').addEventListener('click',requestReset);$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());$('confirm-reset').addEventListener('click',reset);
$('help-btn').addEventListener('click',showHelp);$('close-help').addEventListener('click',()=>$('help-dialog').close());$('start-btn').addEventListener('click',()=>$('help-dialog').close());
$('fullscreen-btn').addEventListener('click',async()=>{
  try{if(!document.fullscreenElement){if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else if(document.documentElement.webkitRequestFullscreen)document.documentElement.webkitRequestFullscreen();else{toast('このブラウザでは全画面APIが非対応です。横向きでお楽しみください。');return;}if(screen.orientation?.lock)await screen.orientation.lock('landscape').catch(()=>{});}else await document.exitFullscreen();}catch(e){toast('全画面表示はこのブラウザでは利用できません。');}
});
$('portrait-dismiss').addEventListener('click',()=>$('portrait-notice').classList.add('dismissed'));

// Web Audio uses locally synthesized effects; no remote audio or microphone access.
function getAudio(){if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();return audioContext;}
$('sound-btn').addEventListener('click',()=>{try{soundEnabled=!soundEnabled;if(soundEnabled)getAudio();$('sound-btn').setAttribute('aria-pressed',String(soundEnabled));$('sound-btn').innerHTML=soundEnabled?'<svg viewBox="0 0 24 24"><path d="m11 4-6 5H2v6h3l6 5V4ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m11 4-6 5H2v6h3l6 5V4ZM16 9l5 6m0-6-5 6"/></svg>';toast(soundEnabled?'SOUND ON / 効果音を有効にしました':'SOUND OFF / ミュート');}catch(e){soundEnabled=false;toast('このブラウザでは音声を利用できません。');}});
function playBeep(){if(!soundEnabled)return;const ctx=getAudio(),o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(860,ctx.currentTime);g.gain.setValueAtTime(.025,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.09);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1);}
function playNoise(duration,volume,cutoff){if(!soundEnabled)return;const ctx=getAudio(),buffer=ctx.createBuffer(1,ctx.sampleRate*duration,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,ctx.currentTime);filter.frequency.exponentialRampToValueAtTime(65,ctx.currentTime+duration);gain.gain.setValueAtTime(Math.min(.28,volume),ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();source.stop(ctx.currentTime+duration);}
function playLaunch(){playNoise(.45,.075,2400);}
sim.onExplosion=(position,radius)=>{const distance=position.distanceTo(cameraPosition);playNoise(1.25,.2*Math.min(1,30/(distance+1)),900);if(navigator.vibrate&&touch)navigator.vibrate(Math.min(100,radius*5));};

canvas.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;lastPointerX=e.clientX;lastPointerY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;const dx=e.clientX-lastPointerX,dy=e.clientY-lastPointerY;lastPointerX=e.clientX;lastPointerY=e.clientY;yaw-=dx*(touch?.004:.003);pitch-=dy*(touch?.004:.003);pitch=THREE.MathUtils.clamp(pitch,-Math.PI/2+.03,Math.PI/2-.03);});
function endLook(e){if(e.pointerId===pointer){pointer=null;canvas.style.cursor='grab';}}
canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);canvas.addEventListener('lostpointercapture',endLook);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();if(collision)return;camera.getWorldDirection(forward);cameraPosition.addScaledVector(forward,-Math.sign(e.deltaY)*2.5);cameraPosition.y=Math.max(.4,cameraPosition.y);},{passive:false});

const stick=$('move-stick');
function moveStick(e){if(e.pointerId!==joystick.id)return;const rect=stick.getBoundingClientRect(),radius=rect.width*.32;let x=(e.clientX-rect.left-rect.width/2)/radius,y=(e.clientY-rect.top-rect.height/2)/radius;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}joystick.x=x;joystick.y=y;$('stick-knob').style.transform=`translate(${x*radius}px,${y*radius}px)`;}
stick.addEventListener('pointerdown',e=>{e.preventDefault();joystick.id=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});stick.addEventListener('pointermove',moveStick);
function endStick(e){if(e.pointerId!==joystick.id)return;joystick.id=null;joystick.x=joystick.y=0;$('stick-knob').style.transform='';}
stick.addEventListener('pointerup',endStick);stick.addEventListener('pointercancel',endStick);stick.addEventListener('lostpointercapture',endStick);
for(const [id,value] of [['fly-up',1],['fly-down',-1]]){const el=$(id);el.addEventListener('pointerdown',e=>{touchVertical=value;el.setPointerCapture(e.pointerId);e.preventDefault();});for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,()=>{touchVertical=0;});}

window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  if(['Space','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(/^Digit[1-5]$/.test(e.code))selectWeapon(Number(e.code.slice(-1))-1);
  if(e.code==='Space')placeOrFire();if(e.code==='KeyG')detonate();if(e.code==='KeyC')toggleCollision();if(e.code==='KeyP')togglePause();if(e.code==='KeyT')toggleSlow();if(e.code==='KeyR')requestReset();if(e.code==='KeyH')showHelp();if(e.code==='KeyF')enterInterior();
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInputs);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs();});
window.addEventListener('resize',()=>sim.resize());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loading').classList.remove('hidden');$('loading-status').textContent='描画コンテキストが失われました。ページを再読み込みしてください。';});

function updateHUD(){
  const stats=sim.stats();$('integrity-value').innerHTML=`${stats.integrity}<span>%</span>`;$('integrity-bar').style.width=`${stats.integrity}%`;$('integrity-bar').style.background=stats.integrity<50?'#d16d4c':stats.integrity<85?'#c5a373':'#6b8771';
  $('debris-count').textContent=String(stats.debris).padStart(4,'0');$('charge-count').textContent=String(stats.charges).padStart(2,'0');
  const unstable=stats.floors.some(f=>f.dynamic&&!f.retired);$('structure-state').textContent=unstable?'COLLAPSING':stats.integrity<25?'CRITICAL':stats.integrity<85?'DAMAGED':'STABLE';$('structure-state').style.color=unstable||stats.integrity<25?'#d16d4c':stats.integrity<85?'#b08b53':'#68836e';
  for(const state of stats.floors){const bar=$('floor-bars').children[state.index];bar.className=`floor-bar${state.dynamic||state.retired?' lost':state.ratio<.99?' damaged':''}`;bar.title=`${state.index+1}F / 支柱健全度 ${Math.round(state.ratio*100)}%`;}
  $('altitude').textContent=cameraPosition.y.toFixed(1);
  const inside=Math.abs(cameraPosition.x)<11&&Math.abs(cameraPosition.z)<9&&cameraPosition.y<42.5;
  $('location-label').textContent=inside?`${Math.min(10,Math.max(1,Math.floor(cameraPosition.y/FLOOR_HEIGHT)+1))}F INTERIOR`:'EXTERIOR';
  document.body.classList.toggle('exploring',inside);$('exterior-btn').classList.toggle('active',!inside);
}

let previous=performance.now(),frames=0,fpsTime=previous,hudTime=previous;
function animate(now){
  requestAnimationFrame(animate);
  const delta=Math.min((now-previous)/1000,.05);previous=now;
  euler.set(pitch,yaw,0,'YXZ');camera.quaternion.setFromEuler(euler);
  camera.getWorldDirection(forward);right.crossVectors(forward,worldUp).normalize();
  motion.set(0,0,0);
  if(!document.querySelector('dialog[open]')){
    const vertical=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0)+touchVertical;
    const longitudinal=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
    const lateral=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
    motion.addScaledVector(forward,longitudinal).addScaledVector(right,lateral);motion.y+=vertical;if(motion.length()>1)motion.normalize();
  }
  const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?30:10;
  if(collision){sim.player.velocity.set(motion.x*speed,motion.y*speed,motion.z*speed);sim.player.wakeUp();}else{cameraPosition.addScaledVector(motion,speed*delta);cameraPosition.y=Math.max(.4,Math.min(240,cameraPosition.y));sim.player.position.copy(cameraPosition);sim.player.velocity.setZero();}
  sim.tick(delta);
  if(collision&&!sim.paused){cameraPosition.copy(sim.player.position);if(cameraPosition.y<-10){exterior();toast('安全高度へ復帰しました');}}
  camera.position.copy(cameraPosition);
  if(sim.shake>.001){camera.position.x+=(Math.random()-.5)*sim.shake;camera.position.y+=(Math.random()-.5)*sim.shake;}
  sim.render();
  if(now-lastHitTime>160){
    lastHitTime=now;aim();$('crosshair').classList.toggle('targeting',!!target);
    if(target){const entity=target.object.userData.entity;const labels={glass:'GLASS PANEL',column:'RC COLUMN',floor:'CONCRETE SLAB',frame:'ALUMINUM FRAME',furniture:'INTERIOR OBJECT',wall:'PARTITION',ground:'FOUNDATION',finish:'FLOOR FINISH'};$('target-readout').innerHTML=`${entity.floor.index>=0?String(entity.floor.index+1).padStart(2,'0')+'F / ':''}${labels[entity.kind]||'STRUCTURE'}<span>${target.distance.toFixed(1)} M</span>`;$('target-readout').style.opacity='.8';}else{$('target-readout').innerHTML='FREE FLIGHT <span>NO TARGET</span>';$('target-readout').style.opacity='.5';}
  }
  frames++;if(now-fpsTime>1000){$('fps').textContent=`${Math.round(frames*1000/(now-fpsTime))} FPS`;frames=0;fpsTime=now;}
  if(now-hudTime>240){updateHUD();hudTime=now;}
}
const entryParams=new URLSearchParams(location.search);
if(entryParams.get('view')==='interior'){
  const requestedFloor=Number(entryParams.get('floor')||1);
  interiorFloor=(Number.isFinite(requestedFloor)?THREE.MathUtils.clamp(Math.floor(requestedFloor),1,10):1)-2;
  enterInterior();
}
if(entryParams.get('portrait')==='continue')$('portrait-notice').classList.add('dismissed');
updateHUD();requestAnimationFrame(animate);
setTimeout(()=>{$('loading').classList.add('hidden');},450);
console.info(`FRACTURE ready: ${sim.totalEntities} building elements, 10 fully furnished floors, Cannon-es rigid-body physics.`);

// Optional, explicit developer diagnostics. Nothing runs unless ?test=smoke is requested.
// This tests real simulation methods instead of a separate mock implementation.
if(entryParams.get('test')==='smoke'){
  setTimeout(()=>{
    try{
      const initial=sim.stats().integrity;if(initial!==100)throw new Error(`initial integrity ${initial}`);
      const hit=aim();if(!hit)throw new Error('default camera misses building');
      document.querySelector('.weapon[data-weapon="0"]').click();$('place-btn').click();
      if(sim.charges.length!==1)throw new Error('charge count mismatch');
      $('detonate-btn').click();if(sim.charges.length)throw new Error('charge not cleared');
      if(!sim.debris.length)throw new Error('explosion produced no physical debris');
      if(!sim.debris.every(d=>d.body.shapes.length&&d.expires===sim.clock+5))throw new Error('debris collider or lifetime missing');
      $('collision-btn').click();if(sim.player.collisionFilterMask!==1)throw new Error('collision toggle failed');$('collision-btn').click();
      $('slow-btn').click();if(sim.timeScale!==.2)throw new Error('slow button failed');$('slow-btn').click();
      $('pause-btn').click();const pausedTime=sim.clock;sim.tick(.05);if(sim.clock!==pausedTime)throw new Error('pause button failed');$('pause-btn').click();
      for(let floor=1;floor<=10;floor++){$('next-floor-btn').click();if(interiorFloor!==floor-1||Math.abs(cameraPosition.y-((floor-1)*FLOOR_HEIGHT+1.92))>.15)throw new Error('floor navigation failed');}
      $('exterior-btn').click();
      $('help-btn').click();if(!$('help-dialog').open)throw new Error('help dialog failed');$('close-help').click();
      selectWeapon(4);sim.fireMissile(new THREE.Vector3(0,9,12),new THREE.Vector3(0,0,-1));
      for(let i=0;i<12;i++)sim.tick(1/60);
      if(sim.missiles.length)throw new Error('missile did not collide with facade');
      if(!WEAPONS.slice(0,4).every((w,i,a)=>i===0||w.radius>a[i-1].radius&&w.power>a[i-1].power))throw new Error('remote weapon strength ordering');
      sim.reset();exterior();
      const supportFloor=sim.floors.find(f=>f.index===8);
      sim.scene.updateMatrixWorld(true);
      for(const column of supportFloor.entities.filter(e=>e.kind==='column').slice(0,6))sim.destroyEntity(column,new THREE.Vector3(5,36,2),3);
      sim.checkStructure();
      for(let i=0;i<24;i++)sim.tick(1/60);
      if(!sim.floors.some(f=>f.dynamic))throw new Error('structural collapse not triggered');
      if(!sim.debris.every(d=>Number.isFinite(d.body.position.x)))throw new Error('nonfinite physics body');
      const expiry=sim.clock+6;
      while(sim.clock<expiry)sim.tick(1/30);
      // Impact debris may be newer than five seconds; every remaining body must be unexpired.
      if(sim.debris.some(d=>d.expires<=sim.clock))throw new Error('expired debris retained');
      $('reset-btn').click();if(!$('reset-dialog').open)throw new Error('reset dialog failed');$('confirm-reset').click();if(sim.stats().integrity!==100||sim.charges.length||sim.debris.length)throw new Error('reset failed');
      console.info('SMOKE TEST PASS: initial scene, raycast, actual C4 placement/detonation buttons, colliders, 5-second lifetimes, collision/slow/pause buttons, navigation across all 10 floors, help/reset dialogs, missile collision, weapon strength ordering, cascading rigid-body collapse, finite positions, cleanup, reset.');
      document.body.dataset.testResult='pass';
    }catch(error){console.error('SMOKE TEST FAIL:',error);document.body.dataset.testResult='fail';}
  },2200);
}

if(entryParams.get('test')==='visual-damage'){
  setTimeout(()=>{
    sim.explode(new THREE.Vector3(9,22,6),1);
    for(let i=0;i<8;i++)sim.tick(1/60);
    sim.paused=true;updateHUD();sim.render();document.body.dataset.visualReady='true';
  },900);
}
