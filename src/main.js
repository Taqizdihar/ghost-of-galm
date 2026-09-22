import * as THREE from 'three';
import { createWorld, createAircraft } from './world.js';
import { FlightHUD, drawRadar } from './hud.js';
import { FlightAudio } from './audio.js';
import './style.css';

const icon = (name, size = 18) => {
  const paths = {
    volume: '<path d="m11 5-6 4H2v6h3l6 4z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute: '<path d="m11 5-6 4H2v6h3l6 4z"/><path d="m16 9 6 6m0-6-6 6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2m0 3h.01"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    plane: '<path d="m12 2 2 8 8 6v2l-8-3v5l2 2-4-1-4 1 2-2v-5l-8 3v-2l8-6z"/>',
    radio: '<path d="M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/><circle cx="12" cy="12" r="2"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plane}</svg>`;
};

document.querySelector('#app').innerHTML = `
  <main class="flight-shell">
    <header class="topbar">
      <a class="brand" href="./" aria-label="The Ghost of Galm home"><span class="brand-mark">${icon('plane', 27)}</span><span>GHOST <i>OF</i> GALM<span class="brand-sub">AERIAL COMBAT SIMULATOR</span></span></a>
      <div class="top-center"><span class="status-dot"></span> BELKAN COAST <span class="top-divider">/</span> <span id="local-time">17:42:08</span> <span class="muted">LOCAL</span></div>
      <nav class="top-actions" aria-label="Game options"><span class="build-label">FREE FLIGHT <b>01</b></span><button class="icon-button" id="sound-btn" aria-label="Enable sound" title="Toggle sound">${icon('mute')}</button><button class="icon-button" id="help-btn" aria-label="Flight controls" title="Flight controls (H)">${icon('help')}</button><button class="icon-button" id="fullscreen-btn" aria-label="Enter fullscreen" title="Fullscreen">${icon('expand')}</button><button class="icon-button" id="pause-btn" aria-label="Pause game" title="Pause (Esc)">${icon('pause')}</button></nav>
    </header>
    <section class="game" aria-label="Flight simulator">
      <canvas id="world" aria-label="3D coastal combat flight scene"></canvas>
      <div class="scene-vignette"></div>
      <div class="scene-grain"></div>
      <canvas id="hud" aria-hidden="true"></canvas>
      <div class="mission-intro" id="mission-intro">
        <div class="eyebrow"><span class="orange-line"></span> ACE COMBAT ZERO · FAN TRIBUTE</div>
        <h1>THE GHOST<br><span>OF GALM</span><span class="title-period">.</span></h1>
        <p class="intro-subtitle">Some aces never really disappear.</p>
        <div class="mission-location"><span class="tiny-cross">+</span><span>REYNIS COAST, BELKA<br><span class="muted">51° 24′ N &nbsp; 08° 32′ E</span></span></div>
      </div>
      <div class="mission-panel">
        <div class="panel-eyebrow"><span class="status-dot"></span><span id="mission-state">SORTIE READY</span><span class="panel-code">G / 01</span></div>
        <div class="mission-heading">OPERATION <span>SILENT TIDE</span></div>
        <p id="objective">Clear hostile aircraft from the coastline.</p>
        <div class="mission-stats"><span>TARGETS <strong id="target-count">00 <i>/ 06</i></strong></span><span>TIME <strong id="mission-time">00:00</strong></span><span>SCORE <strong id="score">000000</strong></span></div>
        <button id="launch-btn" class="launch-button"><span>LAUNCH SORTIE</span>${icon('chevron', 18)}</button>
        <div id="flight-active" class="flight-active" hidden><span class="status-dot"></span> WEAPONS FREE <span>GOOD HUNTING, GALM 1.</span></div>
      </div>
      <div class="sector-info"><span>AO <b>B7</b></span><div class="sector-rule"></div><span>VISIBILITY <b>24 KM</b></span><span>WIND <b>270° / 08 KT</b></span></div>
      <div class="camera-switch" role="group" aria-label="Camera view"><button id="chase-btn" class="selected" aria-pressed="true">CHASE</button><button id="cockpit-btn" aria-pressed="false">COCKPIT</button><kbd>C</kbd></div>
      <div class="warning" id="warning" aria-live="polite"></div>
      <section class="radar-panel" aria-label="Tactical radar"><div class="instrument-title">TAC / RADAR <span>8 KM</span></div><div class="radar-wrap"><canvas id="radar" width="176" height="176" aria-label="Enemy positions"></canvas><span class="radar-n">N</span></div><div class="radar-caption"><span class="status-dot"></span> GALM 1 <span>IFF ACTIVE</span></div></section>
      <div class="comms" id="comms"><div class="comms-speaker">${icon('radio', 15)} <span>AWACS <b>EAGLE EYE</b></span><span class="comms-bars"><i></i><i></i><i></i><i></i><i></i></span></div><p id="radio-text">“The coast is clear. The sky is another story.”</p><span class="comms-frequency">CH 01 &nbsp; / &nbsp; 243.00 MHz</span></div>
      <section class="weapons-panel" aria-label="Aircraft and weapons"><div class="instrument-title">F–15C EAGLE <span>GALM 1</span></div><div class="aircraft-status"><span class="aircraft-silhouette">${icon('plane', 56)}</span><div><div class="airframe-label">AIRFRAME <b id="health-value">100<span>%</span></b></div><div class="health-track"><span id="health-bar"></span></div><span class="airframe-state" id="airframe-state">ALL SYSTEMS NOMINAL</span></div></div><button class="weapon-row selected" id="missile-btn"><span class="weapon-symbol">↗</span><span>MSL <small>STANDARD MISSILE</small></span><strong id="missile-count">32</strong><kbd>1</kbd></button><button class="weapon-row" id="gun-btn"><span class="weapon-symbol gun-symbol">≡</span><span>GUN <small>20 MM CANNON</small></span><strong>∞</strong><kbd>2</kbd></button><div class="flares-row"><span>FLARES <b id="flare-count">06</b></span><button id="flare-btn" title="Deploy flares">DEPLOY <kbd>F</kbd></button></div></section>
      <div class="flight-data"><span><i class="status-dot"></i> FLIGHT ASSIST <b>ON</b></span><span id="g-force">1.0 G</span><span id="mach">M 0.72</span></div>
      <div class="touch-controls"><div class="touch-steering"><button data-key="ArrowUp" aria-label="Pitch up">↑</button><button data-key="ArrowLeft" aria-label="Turn left">←</button><button data-key="ArrowDown" aria-label="Pitch down">↓</button><button data-key="ArrowRight" aria-label="Turn right">→</button></div><button id="touch-fire">FIRE</button><button id="touch-target">TARGET</button></div>
      <div class="loading-cover" id="loading-cover"><span class="brand-mark">${icon('plane', 42)}</span><span>PREPARING YOUR SORTIE</span><div class="loading-track"><i></i></div></div>
    </section>
    <footer class="control-bar"><div class="controls-list"><span><kbd>W</kbd><kbd>S</kbd> PITCH</span><span><kbd>A</kbd><kbd>D</kbd> ROLL</span><span><kbd>SHIFT</kbd> THROTTLE</span><span><kbd>SPACE</kbd> FIRE</span><span><kbd>TAB</kbd> TARGET</span><span><kbd>C</kbd> CAMERA</span></div><button id="all-controls">ALL CONTROLS ${icon('chevron', 12)}</button><span class="footer-credit">AN UNOFFICIAL FAN EXPERIENCE</span></footer>
  </main>
  <dialog id="game-dialog" aria-labelledby="dialog-title"><div class="dialog-top"><span class="eyebrow">GALM SQUADRON / FLIGHT OPERATIONS</span><button class="icon-button" id="dialog-close" aria-label="Close dialog">${icon('close')}</button></div><div id="dialog-content"></div></dialog>
`;

const $ = (id) => document.getElementById(id);
const area = document.querySelector('.game');
const audio = new FlightAudio();
let muted = true;
let world;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setClearColor('#89a6b1');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  world = createWorld(THREE);
} catch (err) {
  $('loading-cover').innerHTML = '<h2>Unable to initialize the flight display.</h2><p>This game needs a browser with WebGL enabled. Try enabling hardware acceleration and reloading.</p>';
  console.error(err);
  throw err;
}
const { scene } = world;
const camera = new THREE.PerspectiveCamera(56, 1, 1, 250000);
const playerJet = createAircraft(THREE);
scene.add(playerJet);
const hud = new FlightHUD($('hud'));
const keys = new Set();
const player = { position: new THREE.Vector3(0, 460, 1400), heading: 0, pitch: 0, roll: 0, speed: 880, throttle: .64, health: 100, missiles: 32, flares: 6 };
let mode = 'ready', view = 'chase', weapon = 'MSL', elapsed = 0, score = 0, kills = 0, selectedId = 0;
let lockTime = 0, fireCooldown = 0, gunCooldown = 0, threatTime = 0, incoming = 0, flareProtect = 0, radioUntil = 0, currentWarning = '', lastUiTime = 0;
let width = 0, height = 0, visualTime = 0, lastTime = performance.now(), activeDialog = '', resumeAfterDialog = false;
let enemies = [], projectiles = [], particles = [];
const forward = new THREE.Vector3(), temp = new THREE.Vector3(), desiredCamera = new THREE.Vector3(), lookAt = new THREE.Vector3();
const enemyNames = ['MIG-29', 'SU-27', 'MIG-29', 'SU-27', 'MIG-29', 'SU-27'];

function resetEnemies() {
  const geometries = new Set(), materials = new Set();
  enemies.forEach((e) => {
    scene.remove(e.mesh);
    e.mesh.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  enemies = Array.from({ length: 6 }, (_, i) => {
    const mesh = createAircraft(THREE, { enemy: true });
    const x = [-130, 410, -680, 140, -950, 540][i];
    mesh.position.set(x, [540, 720, 440, 800, 630, 920][i], -950 - i * 950);
    mesh.scale.setScalar(1.35);
    scene.add(mesh);
    return { id: i, mesh, name: enemyNames[i], alive: true, phase: i * 1.72, baseY: mesh.position.y, speed: 118 + i * 7, heading: 0, travel: -1, health: 3 };
  });
}
resetEnemies();

function resize() {
  width = area.clientWidth; height = area.clientHeight;
  camera.aspect = width / height; camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  hud.resize(width, height, Math.min(devicePixelRatio, 2));
}
new ResizeObserver(resize).observe(area);
resize();

function direction() {
  return forward.set(Math.sin(player.heading) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.heading) * Math.cos(player.pitch));
}
function selectedTarget() { return enemies.find((e) => e.id === selectedId && e.alive) || null; }
function targetInfo() {
  const e = selectedTarget();
  if (!e) return null;
  const delta = e.mesh.position.clone().sub(player.position);
  const distance = delta.length();
  const dot = delta.normalize().dot(direction());
  const p = e.mesh.position.clone().project(camera);
  return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, distance, name: e.name, behind: dot < 0, dot, enemy: e };
}
function cycleTarget() {
  const living = enemies.filter((e) => e.alive);
  if (!living.length) return;
  const index = living.findIndex((e) => e.id === selectedId);
  selectedId = living[(index + 1) % living.length].id;
  lockTime = 0;
  audio.play('click');
}
function selectBestTarget() {
  const d = direction().clone();
  const alive = enemies.filter(e => e.alive);
  const ahead = alive.filter(e => e.mesh.position.clone().sub(player.position).normalize().dot(d) > .4);
  const candidates = ahead.length ? ahead : alive;
  candidates.sort((a, b) => a.mesh.position.distanceToSquared(player.position) - b.mesh.position.distanceToSquared(player.position));
  if (candidates[0]) selectedId = candidates[0].id;
  lockTime = 0;
}
function say(text, seconds = 8) { $('radio-text').textContent = `“${text}”`; radioUntil = elapsed + seconds; }

async function startSortie() {
  closeDialog(false);
  if (mode === 'won' || mode === 'lost') resetGame();
  mode = 'playing';
  area.classList.add('is-playing');
  $('launch-btn').hidden = true;
  $('flight-active').hidden = false;
  $('mission-state').textContent = 'MISSION IN PROGRESS';
  $('pause-btn').innerHTML = icon('pause');
  await audio.start(); audio.setMuted(muted);
  say('Galm 1, you are cleared to engage. Take back our skies.', 10);
  area.focus({ preventScroll: true });
}
function resetGame() {
  player.position.set(0, 460, 1400); Object.assign(player, { heading: 0, pitch: 0, roll: 0, speed: 880, throttle: .64, health: 100, missiles: 32, flares: 6 });
  elapsed = 0; score = 0; kills = 0; selectedId = 0; lockTime = 0; threatTime = 0; incoming = 0; flareProtect = 0; fireCooldown = 0; gunCooldown = 0; currentWarning = '';
  projectiles.forEach(p => disposeEffect(p.mesh)); particles.forEach(p => disposeEffect(p.mesh)); projectiles = []; particles = [];
  resetEnemies(); setWeapon('MSL'); view = 'chase'; setView('chase'); mode = 'ready'; keys.clear();
}
function setWeapon(next) {
  weapon = next;
  $('missile-btn').classList.toggle('selected', weapon === 'MSL');
  $('gun-btn').classList.toggle('selected', weapon === 'GUN');
  $('missile-btn').setAttribute('aria-pressed', weapon === 'MSL');
  $('gun-btn').setAttribute('aria-pressed', weapon === 'GUN');
}
function setView(next) {
  view = next; playerJet.visible = view === 'chase';
  $('chase-btn').classList.toggle('selected', view === 'chase'); $('cockpit-btn').classList.toggle('selected', view === 'cockpit');
  $('chase-btn').setAttribute('aria-pressed', view === 'chase'); $('cockpit-btn').setAttribute('aria-pressed', view === 'cockpit');
}
function deployFlares() {
  if (mode !== 'playing' || player.flares <= 0) return;
  player.flares--; flareProtect = 6; incoming = 0; audio.play('missile');
  for (let i = 0; i < 14; i++) spawnParticle(player.position.clone(), new THREE.Vector3((Math.random()-.5)*100, -15-Math.random()*30, (Math.random()-.5)*100), 0xffd38a, 2.4, 1.8);
  say('Countermeasures deployed. Keep moving.', 5);
}

function disposeEffect(mesh) { scene.remove(mesh); mesh.geometry?.dispose(); mesh.material?.dispose(); }
function spawnParticle(position, velocity, color, life, size) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 5, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95, depthWrite: false }));
  mesh.position.copy(position); scene.add(mesh); particles.push({ mesh, velocity, life, maxLife: life });
}
function fire() {
  if (mode !== 'playing') return;
  if (weapon === 'MSL') {
    if (fireCooldown > 0 || player.missiles <= 0) return;
    const info = targetInfo();
    if (!info || lockTime < .65) { say('Bring the target into your sights. Wait for a lock.', 4); fireCooldown = .6; return; }
    if (projectiles.some(projectile => projectile.target === info.enemy && projectile.target.alive)) return;
    player.missiles--; fireCooldown = .9; audio.play('missile');
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.24, .32, 3.2, 6), new THREE.MeshBasicMaterial({ color: 0xffe7b5 }));
    mesh.position.copy(player.position).addScaledVector(direction(), 14); mesh.position.y -= 2;
    scene.add(mesh); projectiles.push({ mesh, target: info.enemy, life: 13, trail: 0, velocity: direction().clone().multiplyScalar(860) });
    say('Fox two. Missile away.', 3);
  } else {
    if (gunCooldown > 0) return;
    gunCooldown = .09; audio.play('gun');
    const info = targetInfo();
    const aim = direction().clone();
    if (info && info.dot > .994 && info.distance < 1800) {
      info.enemy.health--; if (info.enemy.health <= 0) destroyEnemy(info.enemy);
    }
    for (let i = 0; i < 2; i++) spawnParticle(player.position.clone().addScaledVector(aim, 18 + i * 28), aim.clone().multiplyScalar(1300), 0xffe4a1, .7, .55);
  }
}
function destroyEnemy(enemy) {
  if (!enemy.alive) return;
  enemy.alive = false; scene.remove(enemy.mesh); kills++; score += 1200;
  audio.play('destroy');
  for (let i = 0; i < 25; i++) spawnParticle(enemy.mesh.position.clone(), new THREE.Vector3((Math.random()-.5)*90,(Math.random()-.3)*70,(Math.random()-.5)*90), i % 3 === 0 ? 0x38494d : 0xffa35b, 1.3+Math.random()*1.4, 1.5+Math.random()*3);
  say(kills === 5 ? 'One bandit left. Finish the job, Galm 1.' : ['Confirmed hit. Target destroyed.', 'Splash one. Keep your eyes on the sky.', 'Good kill, Galm 1. On to the next.'][kills % 3], 7);
  if (enemy.id === selectedId) selectBestTarget();
  if (kills === 6) finishMission(true);
}
function finishMission(won) {
  mode = won ? 'won' : 'lost'; keys.clear(); incoming = 0;
  $('mission-state').textContent = won ? 'MISSION COMPLETE' : 'SORTIE LOST';
  audio.play(won ? 'victory' : 'warning');
  showDialog(won ? 'won' : 'lost');
}

function updateFlight(dt) {
  elapsed += dt;
  const horizontal = Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft'));
  const vertical = Number(keys.has('w') || keys.has('ArrowUp')) - Number(keys.has('s') || keys.has('ArrowDown'));
  const boosting = keys.has('Shift'), braking = keys.has('b');
  player.throttle = THREE.MathUtils.damp(player.throttle, boosting ? 1 : braking ? .12 : .64, 2.5, dt);
  player.speed = THREE.MathUtils.damp(player.speed, 390 + player.throttle * 770 - Math.sin(player.pitch) * 95, .45, dt);
  player.roll = THREE.MathUtils.damp(player.roll, -horizontal * .85, 2.4, dt);
  player.heading += horizontal * .32 * dt + (Number(keys.has('e')) - Number(keys.has('q'))) * .18 * dt;
  player.pitch = THREE.MathUtils.clamp(player.pitch + vertical * .3 * dt, -.95, 1.05);
  if (!vertical) player.pitch = THREE.MathUtils.damp(player.pitch, 0, .14, dt);
  player.position.addScaledVector(direction(), player.speed / 3.6 * dt);
  player.position.y = Math.min(player.position.y, 9500);
  const ground = Math.max(0, world.terrainHeight(player.position.x, player.position.z));
  if (player.position.y < ground + 8) { player.health = 0; finishMission(false); return; }
  if (Math.abs(player.position.x) > 18000 || Math.abs(player.position.z) > 47000) {
    player.heading = Math.atan2(-player.position.x, player.position.z); say('You are leaving the combat zone. Returning to the operation area.', 6);
  }
  enemies.forEach((e) => {
    if (!e.alive) return;
    if (e.mesh.position.z < -35000) e.travel = 1;
    if (e.mesh.position.z > 12000) e.travel = -1;
    e.mesh.position.z += e.travel * e.speed * dt;
    e.mesh.position.x += Math.sin(elapsed*.14 + e.phase) * 13 * dt;
    e.mesh.position.y = e.baseY + Math.sin(elapsed*.2 + e.phase) * 65;
    const eh = world.terrainHeight(e.mesh.position.x, e.mesh.position.z);
    e.mesh.position.y = Math.max(e.mesh.position.y, eh + 150);
    e.heading = THREE.MathUtils.damp(e.heading, e.travel === 1 ? Math.PI : 0, 2, dt);
    e.mesh.rotation.set(Math.cos(elapsed*.2 + e.phase)*.025, e.heading, Math.cos(elapsed*.14 + e.phase)*.12);
  });
  const info = targetInfo();
  if (info && info.distance < 8200 && info.dot > .974) {
    const old = lockTime; lockTime += dt;
    if (old < .65 && lockTime >= .65) audio.play('lock');
  } else lockTime = 0;
  fireCooldown = Math.max(0, fireCooldown-dt); gunCooldown = Math.max(0, gunCooldown-dt); flareProtect = Math.max(0, flareProtect-dt);
  if (keys.has(' ')) fire();
  threatTime += dt;
  if (threatTime > 27 && enemies.some(e => e.alive && e.mesh.position.distanceTo(player.position) < 7000)) { incoming = 5; threatTime = 0; say('Missile inbound. Deploy flares!', 6); audio.play('warning'); }
  if (incoming > 0) {
    incoming -= dt;
    if (incoming <= 0 && flareProtect <= 0) { player.health = Math.max(0, player.health - 24); audio.play('hit'); area.classList.add('damage-flash'); setTimeout(() => area.classList.remove('damage-flash'), 350); if (!player.health) finishMission(false); }
  }
  const clearance = player.position.y - ground;
  currentWarning = incoming > 0 ? 'MISSILE ALERT · DEPLOY FLARES [F]' : clearance < 130 ? 'CAUTION · PULL UP' : '';
  if (radioUntil < elapsed) { $('radio-text').textContent = '“Stay sharp, Galm 1. We have your six.”'; radioUntil = Infinity; }
}

function updateEffects(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.life -= dt;
    if (p.target.alive) {
      temp.copy(p.target.mesh.position).sub(p.mesh.position);
      if (temp.length() < 32 + dt * 900) { destroyEnemy(p.target); disposeEffect(p.mesh); projectiles.splice(i, 1); continue; }
      p.velocity.lerp(temp.normalize().multiplyScalar(970), Math.min(1, dt * 4));
    }
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.velocity.clone().normalize());
    p.trail += dt;
    if (p.trail > .055) { p.trail = 0; spawnParticle(p.mesh.position.clone(), new THREE.Vector3(0, 2, 0), 0xc6d0c8, 1.8, .7); }
    if (p.life <= 0) { disposeEffect(p.mesh); projectiles.splice(i, 1); }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { disposeEffect(p.mesh); particles.splice(i, 1); continue; }
    p.mesh.position.addScaledVector(p.velocity, dt); p.mesh.material.opacity = p.life / p.maxLife; p.mesh.scale.multiplyScalar(1 + dt * .35);
  }
}

function updateCamera(dt) {
  playerJet.position.copy(player.position);
  playerJet.rotation.set(player.pitch, -player.heading, player.roll, 'YXZ');
  playerJet.userData.setThrust?.(player.throttle, visualTime);
  const f = direction().clone();
  if (view === 'chase') {
    desiredCamera.copy(player.position).addScaledVector(f, -80); desiredCamera.y += 27;
    camera.position.lerp(desiredCamera, mode === 'ready' ? 1 : 1 - Math.exp(-dt * 8));
    lookAt.copy(player.position).addScaledVector(f, 170); lookAt.y -= 8;
  } else {
    camera.position.copy(player.position).addScaledVector(f, 7); camera.position.y += 2;
    lookAt.copy(camera.position).addScaledVector(f, 300);
  }
  camera.up.set(-Math.sin(player.roll * (view === 'cockpit' ? .85 : .12)), Math.cos(player.roll * (view === 'cockpit' ? .85 : .12)), 0);
  camera.lookAt(lookAt);
  camera.updateMatrixWorld();
}
function updateUI() {
  $('target-count').innerHTML = `${String(kills).padStart(2,'0')} <i>/ 06</i>`;
  $('mission-time').textContent = `${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;
  $('score').textContent = String(score).padStart(6,'0');
  $('missile-count').textContent = String(player.missiles).padStart(2,'0'); $('flare-count').textContent = String(player.flares).padStart(2,'0');
  $('health-value').innerHTML = `${player.health}<span>%</span>`; $('health-bar').style.width = `${player.health}%`;
  $('airframe-state').textContent = player.health > 70 ? 'ALL SYSTEMS NOMINAL' : player.health > 30 ? 'AIRFRAME DAMAGE' : 'CRITICAL DAMAGE';
  $('g-force').textContent = `${(1 + Math.abs(player.roll)*3.8 + Math.abs(player.pitch)*1.2).toFixed(1)} G`;
  $('mach').textContent = `M ${(player.speed / 1225).toFixed(2)}`;
  $('warning').textContent = mode === 'playing' ? currentWarning : '';
  $('warning').classList.toggle('visible', mode === 'playing' && !!currentWarning);
  $('local-time').textContent = new Date(Date.UTC(2000, 0, 1, 17, 42, 8 + Math.floor(elapsed))).toISOString().slice(11,19);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, .05); lastTime = now; visualTime += dt;
  if (mode === 'playing') { updateFlight(dt); if (mode === 'playing') updateEffects(dt); }
  updateCamera(dt);
  world.update(visualTime, player.position);
  renderer.render(scene, camera);
  const state = { width, height, time: visualTime, heading: (THREE.MathUtils.radToDeg(player.heading)%360+360)%360, pitch: player.pitch, roll: player.roll, speed: player.speed, altitude: player.position.y, throttle: player.throttle, health: player.health, missiles: player.missiles, weapon, locked: lockTime >= .65, target: targetInfo(), enemies: enemies.filter(e => e.alive).map(e => ({ x: e.mesh.position.x-player.position.x, z: e.mesh.position.z-player.position.z, id:e.id, selected:e.id===selectedId })), playerHeading: player.heading, mode, warning: currentWarning };
  hud.draw(state); drawRadar($('radar'), state);
  audio.update({ speed: player.speed, throttle: player.throttle, mode });
  if (visualTime - lastUiTime > .12) { updateUI(); lastUiTime = visualTime; }
}
updateCamera(.016); requestAnimationFrame(frame);
requestAnimationFrame(() => { $('loading-cover').classList.add('loaded'); setTimeout(() => $('loading-cover').remove(), 750); });

const controls = [['W / ↑','Pitch up'],['S / ↓','Pitch down'],['A D / ← →','Bank & turn'],['Q / E','Rudder left / right'],['SHIFT','Afterburner'],['B','Air brake'],['SPACE','Fire weapon'],['TAB','Cycle target'],['1 / 2','Missiles / cannon'],['F','Deploy flares'],['C','Switch camera'],['ESC / P','Pause sortie']];
function showDialog(type) {
  if ($('game-dialog').open) $('game-dialog').close();
  activeDialog = type;
  if (type === 'help') {
    resumeAfterDialog = mode === 'playing'; if (resumeAfterDialog) mode = 'paused';
    $('dialog-content').innerHTML = `<h2 id="dialog-title">KNOW YOUR <em>AIRCRAFT.</em></h2><p class="dialog-description">You have the aircraft. Make the sky yours.</p><div class="controls-grid">${controls.map(([key,text])=>`<div><kbd>${key}</kbd><span>${text}</span></div>`).join('')}</div><div class="dialog-tip"><b>COMBAT TIP</b> Keep a target near the center of your HUD until you see LOCK, then fire. Missiles track automatically. Watch your radar and use flares when a missile is inbound.</div><button class="launch-button" id="dialog-primary">${resumeAfterDialog ? 'RETURN TO SORTIE' : 'READY TO FLY'} ${icon('chevron')}</button>`;
  } else if (type === 'pause') {
    $('dialog-content').innerHTML = `<h2 id="dialog-title">HOLDING <em>PATTERN.</em></h2><p class="dialog-description">Your sortie is paused. Take a breath, pilot.</p><div class="pause-summary"><span>OPERATION SILENT TIDE</span><b>${kills} / 6 TARGETS DESTROYED</b></div><button class="launch-button" id="dialog-primary">RESUME SORTIE ${icon('play')}</button><button class="secondary-button" id="restart-btn">RESTART MISSION</button>`;
  } else {
    const won = type === 'won';
    $('dialog-content').innerHTML = `<div class="result-eyebrow">${won ? 'ALL HOSTILES ELIMINATED' : 'AIRCRAFT LOST'}</div><h2 id="dialog-title">${won ? 'THE SKY IS <em>YOURS.</em>' : 'GHOSTS FLY <em>AGAIN.</em>'}</h2><p class="dialog-description">${won ? 'The coast is secure. Another story for the Demon Lord.' : 'The sortie is over. Regroup and take another run at the coast.'}</p><div class="result-stats"><div><span>SCORE</span><b>${String(score).padStart(6,'0')}</b></div><div><span>TARGETS</span><b>${kills} / 6</b></div><div><span>FLIGHT TIME</span><b>${$('mission-time').textContent}</b></div></div><button class="launch-button" id="dialog-primary">FLY AGAIN ${icon('chevron')}</button>`;
  }
  $('game-dialog').showModal();
  $('dialog-primary').onclick = () => { if (type === 'help') closeDialog(); else if (type === 'pause') resumeGame(); else startSortie(); };
  if ($('restart-btn')) $('restart-btn').onclick = () => { closeDialog(false); resetGame(); startSortie(); };
  keys.clear();
}
function closeDialog(resume = true) {
  $('game-dialog').close();
  if (resume && (activeDialog === 'pause' || (activeDialog === 'help' && resumeAfterDialog))) { mode = 'playing'; $('pause-btn').innerHTML = icon('pause'); }
  if (mode === 'won' || mode === 'lost') {
    $('launch-btn').hidden = false;
    $('launch-btn').innerHTML = `<span>FLY AGAIN</span>${icon('chevron', 18)}`;
    $('flight-active').hidden = true;
  }
  activeDialog = ''; resumeAfterDialog = false; keys.clear();
}
function resumeGame() { closeDialog(); mode = 'playing'; $('pause-btn').innerHTML = icon('pause'); $('pause-btn').setAttribute('aria-label','Pause game'); }
function pauseGame() {
  if (mode === 'playing') { mode = 'paused'; $('pause-btn').innerHTML = icon('play'); $('pause-btn').setAttribute('aria-label','Resume game'); showDialog('pause'); }
  else if (mode === 'paused') closeDialog();
}
$('launch-btn').onclick = startSortie;
$('help-btn').onclick = () => showDialog('help'); $('all-controls').onclick = () => showDialog('help');
$('pause-btn').onclick = pauseGame; $('dialog-close').onclick = () => closeDialog();
$('game-dialog').addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(); });
$('sound-btn').onclick = async () => { await audio.start(); muted = !muted; audio.setMuted(muted); $('sound-btn').innerHTML = icon(muted ? 'mute' : 'volume'); $('sound-btn').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound'); };
$('fullscreen-btn').onclick = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { say('Fullscreen is unavailable. Your sortie is ready in this window.'); } };
$('chase-btn').onclick = () => setView('chase'); $('cockpit-btn').onclick = () => setView('cockpit');
$('missile-btn').onclick = () => setWeapon('MSL'); $('gun-btn').onclick = () => setWeapon('GUN'); $('flare-btn').onclick = deployFlares;
window.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ($('game-dialog').open) { if (key === 'p' && activeDialog === 'pause') closeDialog(); return; }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Tab','Control','Shift'].includes(key) && mode === 'playing') e.preventDefault();
  if (!e.repeat) {
    if (key === 'Escape' || key === 'p') { e.preventDefault(); pauseGame(); }
    if (key === 'h') showDialog('help');
    if (key === 'c') setView(view === 'chase' ? 'cockpit' : 'chase');
    if (key === '1') setWeapon('MSL'); if (key === '2') setWeapon('GUN');
    if (key === 'Tab' && mode === 'playing') cycleTarget();
    if (key === 'f') deployFlares();
  }
  keys.add(key);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener('blur', () => { keys.clear(); if (mode === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pauseGame(); });
document.querySelectorAll('[data-key]').forEach(button => {
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); keys.add(button.dataset.key); });
  button.addEventListener('pointerup', () => keys.delete(button.dataset.key));
  button.addEventListener('pointercancel', () => keys.delete(button.dataset.key));
});
$('touch-fire').onpointerdown = e => { e.preventDefault(); e.target.setPointerCapture(e.pointerId); keys.add(' '); };
$('touch-fire').onpointerup = () => keys.delete(' '); $('touch-fire').onpointercancel = () => keys.delete(' ');
$('touch-target').onclick = cycleTarget;

// A read-only snapshot helps verify flight controls and mission state in the browser.
window.__flight = { getState: () => ({ mode, view, weapon, elapsed, score, kills, locked: lockTime >= .65, target: selectedTarget()?.name, targetPosition: selectedTarget()?.mesh.position.toArray(), position: player.position.toArray(), heading:player.heading, pitch:player.pitch, speed:player.speed, health:player.health, missiles:player.missiles, flares:player.flares, activeProjectiles:projectiles.length, enemies:enemies.filter(e=>e.alive).length }) };
