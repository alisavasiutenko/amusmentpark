/* ============================================================
   JOHN LAND – scene.js  |  Three.js 3D Amusement Park
   KinitoPET inspired – "Your World" chapter
   ============================================================ */
'use strict';

// ─────────────────────────────────────────────────────────────
//  Constants & palette
// ─────────────────────────────────────────────────────────────
const PINK   = 0xff4da6;
const YELLOW = 0xffe94d;
const CYAN   = 0x4ddfff;
const PURPLE = 0xa64dff;
const GREEN  = 0x4dff91;
const WHITE  = 0xffffff;
const DARK   = 0x050510;
const MID    = 0x0d0d2b;

// ─────────────────────────────────────────────────────────────
//  THREE.js Setup
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('main-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x010112);
scene.fog = new THREE.FogExp2(0x020118, 0.018);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 18, 42);
camera.lookAt(0, 0, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─────────────────────────────────────────────────────────────
//  Camera Controls (Orbit + Walk)
// ─────────────────────────────────────────────────────────────
let isDragging = false, prevMouse = { x: 0, y: 0 };
let orbitTheta = 0, orbitPhi = Math.PI / 5, orbitRadius = 42;

let isWalkMode = true;
let walkYaw = 0, walkPitch = 0;
const walkPos = new THREE.Vector3(0, 1.8, 40);
const walkVelocity = new THREE.Vector3();
let moveFwd = false, moveBwd = false, moveLft = false, moveRgt = false, moveJump = false;
let walkVY = 0;

// HUD UI references for modes
const modeBtn = document.getElementById('mode-toggle-btn');
const orbitHints = document.querySelectorAll('.orbit-hint');
const walkHints = document.querySelectorAll('.walk-hint');
const crosshair = document.getElementById('crosshair');
const joystickZone = document.getElementById('joystick-zone');
const joystickStick = document.getElementById('joystick-stick');

// Initialize visual state for Walk Mode
crosshair.style.display = 'block';
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) joystickZone.style.display = 'block';

let joyActive = false;
let joyDir = new THREE.Vector2();
let joyId = null;

modeBtn.addEventListener('click', () => {
  isWalkMode = !isWalkMode;
  modeBtn.innerHTML = isWalkMode ? '🌎 Orbit' : '🚶 Walk';
  orbitHints.forEach(el => el.style.display = isWalkMode ? 'none' : 'flex');
  walkHints.forEach(el => el.style.display = isWalkMode ? 'flex' : 'none');
  
  if (isWalkMode) {
    // Transition to Walk
    walkPos.copy(camera.position);
    walkPos.y = 1.8; // eye level
    // derive initial yaw from orbit camera look
    walkYaw = orbitTheta + Math.PI;
    walkPitch = 0;
    crosshair.style.display = 'block';
    // Show joystick if touch device
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) joystickZone.style.display = 'block';
  } else {
    // Transition to Orbit
    crosshair.style.display = 'none';
    joystickZone.style.display = 'none';
    
    // Convert back position so Orbit is somewhat matching
    orbitRadius = camera.position.distanceTo(new THREE.Vector3(0,2,0));
    orbitTheta = Math.atan2(camera.position.x, camera.position.z);
  }
});

// Keyboard Input
window.addEventListener('keydown', e => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') moveFwd = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') moveBwd = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLft = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRgt = true;
  if (e.code === 'Space') moveJump = true;
});
window.addEventListener('keyup', e => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') moveFwd = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') moveBwd = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLft = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRgt = false;
  if (e.code === 'Space') moveJump = false;
});

// Joystick Input (Mobile)
joystickZone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (joyActive) return;
    const touch = e.changedTouches[0];
    joyId = touch.identifier;
    joyActive = true;
    updateJoystick(touch);
});
joystickZone.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!joyActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) {
            updateJoystick(e.changedTouches[i]);
            break;
        }
    }
});
const endJoystick = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) {
            joyActive = false;
            joyId = null;
            joyDir.set(0, 0);
            joystickStick.style.transform = `translate(-50%, -50%)`;
            break;
        }
    }
};
joystickZone.addEventListener('touchend', endJoystick);
joystickZone.addEventListener('touchcancel', endJoystick);

function updateJoystick(touch) {
    const rect = joystickZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxR = rect.width / 2;
    if (dist > maxR) { dx = (dx/dist)*maxR; dy = (dy/dist)*maxR; }
    joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyDir.set(dx / maxR, dy / maxR);
}

// Mouse/Touch Look (and Orbit)
// Track a generalized "pointer drag"
let dragStartDist = 0; // for detecting taps vs drags
canvas.addEventListener('mousedown', e => { 
    isDragging = true; 
    prevMouse = { x: e.clientX, y: e.clientY }; 
    dragStartDist = 0; 
});
window.addEventListener('mouseup', e => { 
    isDragging = false; 
    handleCanvasTap(e.clientX, e.clientY);
});
window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  dragStartDist += Math.abs(dx) + Math.abs(dy);
  if (isWalkMode) {
      walkYaw -= dx * 0.003;
      walkPitch -= dy * 0.003;
      walkPitch = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, walkPitch));
  } else {
      orbitTheta -= dx * 0.005;
      orbitPhi   = Math.max(0.15, Math.min(Math.PI / 2.2, orbitPhi + dy * 0.004));
  }
  prevMouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('wheel', e => {
  if (!isWalkMode) orbitRadius = Math.max(14, Math.min(80, orbitRadius + e.deltaY * 0.04));
});

// Touch controls for look/orbit
let prevTouch = null;
let lookTouchId = null;
canvas.addEventListener('touchstart', e => {
    // If not in walk mode, or touch is on right half of screen
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (!isWalkMode || t.clientX > window.innerWidth / 2) {
            lookTouchId = t.identifier;
            prevTouch = { x: t.clientX, y: t.clientY };
            dragStartDist = 0;
            break;
        }
    }
});
canvas.addEventListener('touchmove', e => {
    if (lookTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === lookTouchId) {
            const dx = t.clientX - prevTouch.x;
            const dy = t.clientY - prevTouch.y;
            dragStartDist += Math.abs(dx) + Math.abs(dy);
            if (isWalkMode) {
                walkYaw -= dx * 0.004;
                walkPitch -= dy * 0.004;
                walkPitch = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, walkPitch));
            } else {
                orbitTheta -= dx * 0.005;
                orbitPhi = Math.max(0.15, Math.min(Math.PI / 2.2, orbitPhi + dy * 0.004));
            }
            prevTouch = { x: t.clientX, y: t.clientY };
            return;
        }
    }
});
canvas.addEventListener('touchend', e => {
   for (let i = 0; i < e.changedTouches.length; i++) {
       if (e.changedTouches[i].identifier === lookTouchId) {
           handleCanvasTap(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
           lookTouchId = null;
       }
   } 
});

function updateCamera(dt) {
  if (isWalkMode) {
      // Movement logic
      const speed = 15;
      const front = new THREE.Vector3(-Math.sin(walkYaw), 0, -Math.cos(walkYaw)); 
      const right = new THREE.Vector3(Math.cos(walkYaw), 0, -Math.sin(walkYaw));
      
      walkVelocity.set(0, 0, 0);
      
      // Keyboard
      if (moveFwd) walkVelocity.add(front);
      if (moveBwd) walkVelocity.sub(front);
      if (moveLft) walkVelocity.sub(right);
      if (moveRgt) walkVelocity.add(right);
      
      // Joystick
      if (joyActive) {
          walkVelocity.add(front.clone().multiplyScalar(-joyDir.y));
          walkVelocity.add(right.clone().multiplyScalar(joyDir.x));
      }
      
      if (walkVelocity.length() > 0) walkVelocity.normalize().multiplyScalar(speed * dt);
      
      function isBlocked(px, pz) {
          if (Math.hypot(px - (-18), pz - (-5)) < 11.5) return true; // Ferris
          if (Math.hypot(px - 14, pz - (-6)) < 8) return true; // Carousel
          if (px > -36 && px < -24 && pz > -21 && pz < -9) return true; // Coaster
          if (px > 26 && px < 34 && pz > 9 && pz < 15) return true; // Spit Toss
          if (px > 26 && px < 34 && pz > 25 && pz < 31) return true; // Shoot
          return false;
      }
      
      const nX = walkPos.x + walkVelocity.x;
      if (!isBlocked(nX, walkPos.z)) walkPos.x = nX;
      
      const nZ = walkPos.z + walkVelocity.z;
      if (!isBlocked(walkPos.x, nZ)) walkPos.z = nZ;
      
      // Jump & Gravity
      if (moveJump && walkPos.y <= 1.81) walkVY = 12;
      walkVY -= 35 * dt;
      walkPos.y += walkVY * dt;
      if (walkPos.y < 1.8) { walkPos.y = 1.8; walkVY = 0; }
      
      // park bounds
      walkPos.x = Math.max(-55, Math.min(55, walkPos.x));
      walkPos.z = Math.max(-55, Math.min(55, walkPos.z));
      
      camera.position.copy(walkPos);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(walkPitch, walkYaw, 0);
  } else {
      camera.position.x = Math.sin(orbitTheta) * Math.cos(orbitPhi) * orbitRadius;
      camera.position.y = Math.sin(orbitPhi) * orbitRadius;
      camera.position.z = Math.cos(orbitTheta) * Math.cos(orbitPhi) * orbitRadius;
      camera.lookAt(0, 2, 0);
  }
}

// ─────────────────────────────────────────────────────────────
//  LIGHTS
// ─────────────────────────────────────────────────────────────
const ambLight = new THREE.AmbientLight(0x1a1040, 1.6);
scene.add(ambLight);

const moonLight = new THREE.DirectionalLight(0x8899ff, 0.6);
moonLight.position.set(-30, 60, -20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near = 0.5;
moonLight.shadow.camera.far = 200;
moonLight.shadow.camera.left = -80; moonLight.shadow.camera.right = 80;
moonLight.shadow.camera.top  =  80; moonLight.shadow.camera.bottom = -80;
scene.add(moonLight);

function addPointLight(color, intensity, x, y, z, dist = 18) {
  const l = new THREE.PointLight(color, intensity, dist);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}
addPointLight(PINK,   2.5,  12, 8, 0,  22);
addPointLight(CYAN,   2.5, -12, 8, 0,  22);
addPointLight(YELLOW, 2.0,   0, 8, 12, 20);
addPointLight(PURPLE, 1.8,   0, 8,-12, 20);

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function mat(color, emissive = 0x000000, emissiveIntensity = 0, rough = 0.7, metal = 0.1) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: rough, metalness: metal });
}
function box(w, h, d, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// ─────────────────────────────────────────────────────────────
//  GROUND
// ─────────────────────────────────────────────────────────────
function buildGround() {
  // Checkerboard ground in KinitoPET style
  const size = 120;
  const div  = 40;
  const geo  = new THREE.PlaneGeometry(size, size, div, div);
  const colors = [];
  for (let i = 0; i <= div; i++) {
    for (let j = 0; j <= div; j++) {
      const c = (i + j) % 2 === 0 ? new THREE.Color(0x1a0044) : new THREE.Color(0x0d0028);
      colors.push(c.r, c.g, c.b);
    }
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Glowing edge strip
  const edgeGeo = new THREE.RingGeometry(48, 50, 64);
  const edgeMat = new THREE.MeshBasicMaterial({ color: PINK, side: THREE.DoubleSide });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.01;
  scene.add(edge);
}
buildGround();

// ─────────────────────────────────────────────────────────────
//  STARS
// ─────────────────────────────────────────────────────────────
function buildStars() {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  for (let i = 0; i < 3000; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 150 + Math.random() * 50;
    verts.push(
      r * Math.sin(phi) * Math.cos(theta),
      Math.abs(r * Math.cos(phi)) + 20,
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat2 = new THREE.PointsMaterial({ color: WHITE, size: 0.4, sizeAttenuation: true });
  scene.add(new THREE.Points(geo, mat2));
}
buildStars();

// ─────────────────────────────────────────────────────────────
//  ENTRANCE ARCH
// ─────────────────────────────────────────────────────────────
function buildEntrance() {
  const g = new THREE.Group();
  // Posts
  g.add(box(1.4, 12, 1.4, mat(PINK, PINK, 0.4), -6, 6, 20));
  g.add(box(1.4, 12, 1.4, mat(PINK, PINK, 0.4),  6, 6, 20));
  // Arch beam
  g.add(box(14, 1.5, 1.4, mat(YELLOW, YELLOW, 0.5), 0, 12.7, 20));
  // Bulb decorations on beam
  for (let i = -5; i <= 5; i += 2) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat(WHITE, WHITE, 1));
    bulb.position.set(i, 13.8, 20);
    g.add(bulb);
    addGlowSprite(WHITE, 0.9, i, 13.8, 20);
  }
  // "AMUSEMENT PARK" sign text (canvas texture)
  const signTex = makeTextTexture('AMUSEMENT PARK', 1024, 128, '#ffe94d', '#1a0044', 40);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.5), signMat);
  sign.position.set(0, 12.3, 19);
  g.add(sign);

  scene.add(g);
}

function makeTextTexture(text, w, h, color, bg, fontSize) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px 'Press Start 2P', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

buildEntrance();

// ─────────────────────────────────────────────────────────────
//  FERRIS WHEEL
// ─────────────────────────────────────────────────────────────
let ferrisGroup, ferrisCarsGroup;
function buildFerrisWheel(cx, cz) {
  const base = new THREE.Group();
  const wheel = new THREE.Group();
  const carG = new THREE.Group();

  // Support legs
  const legMat = mat(0x334466, 0, 0, 0.8, 0.3);
  for (let side = -1; side <= 1; side += 2) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 14, 8), legMat);
    leg.position.set(side * 4, 7, 0);
    leg.rotation.z = side * 0.25;
    leg.castShadow = true;
    base.add(leg);
  }
  // Axle
  const axle = cyl(0.35, 0.35, 1.5, 16, mat(0x888888, 0, 0, 0.3, 0.8), 0, 14, 0);
  axle.rotation.x = Math.PI / 2;
  base.add(axle);

  // Rim (part of wheel)
  const rimSeg = 16;
  for (let i = 0; i < rimSeg; i++) {
    const a0 = (i / rimSeg) * Math.PI * 2;
    const a1 = ((i + 1) / rimSeg) * Math.PI * 2;
    const r  = 9;
    const x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    const rimColor = [PINK, CYAN, YELLOW, PURPLE, GREEN][i % 5];
    const rimPiece = box(len, 0.4, 0.4, mat(rimColor, rimColor, 0.5),
      (x0 + x1) / 2, (y0 + y1) / 2, 0,
      0, 0, Math.atan2(dy, dx));
    wheel.add(rimPiece);
  }

  // Spokes and cars
  const carColors = [PINK, CYAN, YELLOW, PURPLE, GREEN, 0xff9933, 0x33ff99, 0xff3399];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 9;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    // Spoke (part of wheel)
    const spokeLen = Math.sqrt(sx * sx + sy * sy);
    const spoke = box(0.18, spokeLen, 0.18, mat(0x556688, 0, 0, 0.6, 0.4),
      sx / 2, sy / 2, 0, 0, 0, Math.atan2(sx, sy));
    wheel.add(spoke);

    // Car (gondola) (inside carG)
    const carColor = carColors[i % carColors.length];
    const carMesh = new THREE.Group();
    const carBody = box(1.6, 1, 1.2, mat(carColor, carColor, 0.3), 0, -1.2, 0); // Dropped a bit
    const carRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 6), mat(0xffffff, WHITE, 0.2));
    carRoof.position.y = -0.55;
    const string1 = cyl(0.05, 0.05, 1.2, 4, mat(0xffffff), -0.6, -0.6, 0);
    const string2 = cyl(0.05, 0.05, 1.2, 4, mat(0xffffff), 0.6, -0.6, 0);
    
    carMesh.add(carBody, carRoof, string1, string2);
    carMesh.position.set(sx, sy, 0);
    carG.add(carMesh);
  }

  wheel.position.set(cx, 14, cz);
  carG.position.set(cx, 14, cz);
  base.position.set(cx, 0, cz);

  scene.add(base);
  scene.add(wheel);
  scene.add(carG);

  ferrisGroup = wheel;
  ferrisCarsGroup = carG;

  // Spot light
  const spot = new THREE.SpotLight(YELLOW, 2.5, 40, 0.5, 0.4);
  spot.position.set(cx, 35, cz + 5);
  spot.target.position.set(cx, 14, cz);
  scene.add(spot); scene.add(spot.target);
}
buildFerrisWheel(-18, -5);

// ─────────────────────────────────────────────────────────────
//  MERRY-GO-ROUND (Carousel)
// ─────────────────────────────────────────────────────────────
let carouselGroup;
function buildCarousel(cx, cz) {
  const g = new THREE.Group();

  // Base platform
  const base = cyl(5.5, 5.5, 0.6, 32, mat(0xaa3399, PURPLE, 0.15), 0, 0.3, 0);
  g.add(base);

  // Center pole
  g.add(cyl(0.35, 0.35, 9, 8, mat(0xffd700, YELLOW, 0.4), 0, 4.5, 0));

  // Roof
  const roofGeo = new THREE.ConeGeometry(6.2, 2.5, 32);
  for (let i = 0; i < roofGeo.attributes.position.count; i++) {
    // alternating stripes (color via vertex color)
  }
  const roof = new THREE.Mesh(roofGeo, mat(PINK, PINK, 0.3));
  roof.position.y = 10;
  g.add(roof);

  // Stripe panels on roof
  const stripeColors = [YELLOW, CYAN, YELLOW, CYAN, YELLOW, CYAN, YELLOW, CYAN];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = stripeColors[i];
    const stripe = box(0.2, 2.4, 0.2, mat(c, c, 0.5),
      Math.cos(a) * 3.5, 10, Math.sin(a) * 3.5);
    g.add(stripe);
  }

  // Horses (simplified as colourful animals)
  const horseColors = [0xffffff, PINK, CYAN, YELLOW, PURPLE, GREEN, 0xff9900, 0xff4444];
  for (let i = 0; i < 8; i++) {
    const a    = (i / 8) * Math.PI * 2;
    const r    = 3.8;
    const hx   = Math.cos(a) * r;
    const hz   = Math.sin(a) * r;
    const horse = new THREE.Group();
    // body
    const body = box(0.7, 0.8, 1.4, mat(horseColors[i], horseColors[i], 0.2));
    // head
    const head = box(0.5, 0.5, 0.5, mat(horseColors[i], horseColors[i], 0.2), 0, 0.6, 0.6);
    // pole
    const pole = cyl(0.07, 0.07, 4, 6, mat(YELLOW, YELLOW, 0.5), 0, 1.5, 0);
    horse.add(body); horse.add(head); horse.add(pole);
    horse.position.set(hx, 1.2, hz);
    horse.rotation.y = -a + Math.PI / 2;
    g.add(horse);
  }

  // Outer hanging bulbs
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat(WHITE, WHITE, 1));
    b.position.set(Math.cos(a) * 5.8, 7.5, Math.sin(a) * 5.8);
    g.add(b);
  }

  g.position.set(cx, 0, cz);
  scene.add(g);
  carouselGroup = g;
}
buildCarousel(14, -6);

// ─────────────────────────────────────────────────────────────
//  ROLLER COASTER TRACK
// ─────────────────────────────────────────────────────────────
let coasterCartGroup;
function buildRollerCoaster() {
  const g = new THREE.Group();
  const TRACK_COLOR = mat(0xdddddd, 0, 0, 0.5, 0.6);
  const SUPPORT_COLOR = mat(0x886655, 0, 0, 0.8, 0.2);

  // Build a curved track using a CatmullRom curve
  const trackPoints = [
    new THREE.Vector3(-30, 0.5, -15),
    new THREE.Vector3(-28, 6, -22),
    new THREE.Vector3(-18, 12, -26),
    new THREE.Vector3(-5,  14, -24),
    new THREE.Vector3( 5,  10, -20),
    new THREE.Vector3( 15,  5, -24),
    new THREE.Vector3( 24,  2, -18),
    new THREE.Vector3( 28,  8, -8),
    new THREE.Vector3( 22, 14, 0),
    new THREE.Vector3( 10, 16, 6),
    new THREE.Vector3(-2,  12, 10),
    new THREE.Vector3(-14,  6, 8),
    new THREE.Vector3(-22,  3, 2),
    new THREE.Vector3(-30, 0.5, -15),
  ];
  const curve = new THREE.CatmullRomCurve3(trackPoints, true);

  // Track tubes
  const tubeGeo = new THREE.TubeGeometry(curve, 200, 0.22, 8, true);
  const trackMesh = new THREE.Mesh(tubeGeo, TRACK_COLOR);
  trackMesh.castShadow = true;
  g.add(trackMesh);

  // Support pillars at intervals
  const pts = curve.getPoints(60);
  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i];
    if (p.y > 1.5) {
      const h = p.y;
      const pillar = cyl(0.18, 0.22, h, 6, SUPPORT_COLOR, p.x, h / 2, p.z);
      g.add(pillar);
    }
  }

  // Coaster cart (rides the track)
  coasterCartGroup = new THREE.Group();
  const cartBody = box(2, 0.9, 1, mat(PINK, PINK, 0.3));
  const cartFront = box(0.4, 0.5, 1, mat(YELLOW, YELLOW, 0.4), 1.1, -0.1, 0);
  coasterCartGroup.add(cartBody);
  coasterCartGroup.add(cartFront);
  scene.add(coasterCartGroup);

  scene.add(g);

  // Store curve for animation
  window._coasterCurve = curve;
}
buildRollerCoaster();

let coasterT = 0;

// ─────────────────────────────────────────────────────────────
//  GAME STALLS / BOOTHS
// ─────────────────────────────────────────────────────────────
function buildStalls() {
  const stallData = [
    { x:  6, z: 12, color: CYAN,   label: 'SHOOT' },
    { x: -6, z: 14, color: GREEN,  label: 'SPIN'  },
    { x:  0, z:  8, color: YELLOW, label: 'TOSS'  },
  ];
  stallData.forEach(s => {
    const g = new THREE.Group();
    // Booth body
    g.add(box(4.5, 3.2, 2.8, mat(s.color, s.color, 0.15), 0, 1.6, 0));
    // Counter
    g.add(box(4.5, 0.25, 1, mat(0xffffff, WHITE, 0.1), 0, 0.8, 1.5));
    // Roof awning
    const awning = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.2, 2), mat(PINK, PINK, 0.2));
    awning.position.set(0, 3.35, 0.4); g.add(awning);
    // Sign
    const signTex = makeTextTexture(s.label, 256, 96, '#ffe94d', '#000000', 40);
    const signM   = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
    const sign    = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.1), signM);
    sign.position.set(0, 2.6, 1.42);
    g.add(sign);
    // Glowing prize teddies (spheres)
    for (let i = -1.2; i <= 1.2; i += 1.2) {
      const teddy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0xff99cc, PINK, 0.3));
      teddy.position.set(i, 3.8, -0.5);
      g.add(teddy);
    }
    g.position.set(s.x, 0, s.z);
    scene.add(g);
  });
}
buildStalls();

// ─────────────────────────────────────────────────────────────
//  FOOD CART
// ─────────────────────────────────────────────────────────────
function buildFoodCart(cx, cz) {
  const g = new THREE.Group();
  // Cart body
  g.add(box(3, 2, 2, mat(0xeeaa00, YELLOW, 0.2), 0, 1, 0));
  // Umbrella pole
  g.add(cyl(0.08, 0.08, 4, 8, mat(0xffffff), 0, 3, 0));
  // Umbrella
  g.add(new THREE.Mesh(new THREE.ConeGeometry(2.8, 0.4, 8), mat(PINK, PINK, 0.3)));
  // Wheels
  for (let sx = -1; sx <= 1; sx += 2) {
    const wh = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.14, 8, 24), mat(0x333333));
    wh.position.set(sx * 1.6, 0.5, 0);
    wh.rotation.y = Math.PI / 2;
    g.add(wh);
  }
  const umbtop = g.children[2];
  umbtop.position.set(0, 5, 0);
  g.position.set(cx, 0, cz);
  scene.add(g);
}
buildFoodCart(-4, 18);
buildFoodCart(10, 16);

// ─────────────────────────────────────────────────────────────
//  BALLOONS
// ─────────────────────────────────────────────────────────────
const balloonObjs = [];
function buildBalloons() {
  const colors = [PINK, CYAN, YELLOW, PURPLE, GREEN, 0xff9933, 0xff4444, 0x33ccff];
  for (let i = 0; i < 30; i++) {
    const c = colors[i % colors.length];
    const bal = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random() * 0.2, 10, 8), mat(c, c, 0.4));
    bal.position.set(
      (Math.random() - 0.5) * 60,
      4 + Math.random() * 14,
      (Math.random() - 0.5) * 60
    );
    bal.userData.floatOffset = Math.random() * Math.PI * 2;
    scene.add(bal);
    balloonObjs.push(bal);
    // String
    const strGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1.4, 0),
    ]);
    const strMesh = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }));
    strMesh.position.copy(bal.position);
    scene.add(strMesh);
    bal.userData.string = strMesh;
  }
}
buildBalloons();

// ─────────────────────────────────────────────────────────────
//  LAMP POSTS
// ─────────────────────────────────────────────────────────────
function buildLampPosts() {
  const positions = [
    [-8, 22], [8, 22], [-22, 8], [22, 8],
    [-22, -8],[22, -8],[-8,-22], [8,-22],
  ];
  positions.forEach(([x, z]) => {
    const g = new THREE.Group();
    // Pole
    g.add(cyl(0.12, 0.16, 7, 8, mat(0x223344), 0, 3.5, 0));
    // Curve
    g.add(box(0.1, 0.1, 1.8, mat(0x223344), 0.9, 7.2, 0, 0, 0, 0));
    // Bulb
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat(WHITE, WHITE, 1.5));
    bulb.position.set(1.8, 7.2, 0);
    g.add(bulb);
    addGlowSprite(YELLOW, 1.8, x + 1.8, 7.2, z);
    g.position.set(x, 0, z);
    scene.add(g);
  });
}
buildLampPosts();

// ─────────────────────────────────────────────────────────────
//  GLOW SPRITES
// ─────────────────────────────────────────────────────────────
function addGlowSprite(color, scale, x, y, z) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  const hex = '#' + new THREE.Color(color).getHexString();
  grad.addColorStop(0, hex + 'ff');
  grad.addColorStop(0.4, hex + '88');
  grad.addColorStop(1, hex + '00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false }));
  spr.position.set(x, y, z);
  spr.scale.set(scale * 3, scale * 3, 1);
  scene.add(spr);
  return spr;
}

// Glow bulbs on ferris wheel
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  const r = 9;
  addGlowSprite([PINK, CYAN, YELLOW, PURPLE, GREEN, PINK, CYAN, YELLOW][i], 0.8,
    -18 + Math.cos(a) * r, 14 + Math.sin(a) * r, -5);
}

// ─────────────────────────────────────────────────────────────
//  RIDE POPUPS  (click interaction)
// ─────────────────────────────────────────────────────────────
const ridePopup  = document.getElementById('ride-popup');
const popTitle   = document.getElementById('ride-popup-title');
const popDesc    = document.getElementById('ride-popup-desc');
const popAction  = document.getElementById('ride-action-btn');
const popClose   = document.getElementById('ride-close-btn');

const rideInfos = {
  ferris: {
    title: '🎡 FERRIS WHEEL',
    desc:  'Soar above the Park and see everything from high up. The view is beautiful!',
    action: () => { animateFerris = true; popupClose(); }
  },
  carousel: {
    title: '🎠 MERRY-GO-ROUND',
    desc:  'Classic carnival ride with colorful horses!',
    action: () => { animateCarousel = true; popupClose(); }
  },
  coaster: {
    title: '🎢 ROLLERCOASTER',
    desc:  'Hold on tight for a fast-paced ride around the park!',
    action: () => { popupClose(); launchCoasterScreen(); }
  },
  spittoss: {
    title: '🎯 SPIT TOSS',
    desc:  'Test your aim and win a prize! Step right up and give it a toss!',
    action: () => { popupClose(); alert("You threw the ball and hit the target! You won a stuffed bear!"); }
  },
  shootstand: {
    title: '🔫 SHOOT STAND',
    desc:  'Hit the moving targets to score points! Are you a sharpshooter?',
    action: () => { popupClose(); alert("Pew pew! Bullseye!"); }
  }
};

function buildCarnivalStand(x, z, hColor, label) {
  const g = new THREE.Group();
  // Base counter
  g.add(box(6, 2, 4, mat(0xffffff), 0, 1, 0));
  // Back wall
  g.add(box(6, 4, 0.4, mat(hColor), 0, 4, -1.8));
  // Pillars
  g.add(box(0.2, 3, 0.2, mat(0x555555), -2.8, 3.5, 1.8));
  g.add(box(0.2, 3, 0.2, mat(0x555555), 2.8, 3.5, 1.8));
  g.add(box(0.2, 3, 0.2, mat(0x555555), -2.8, 3.5, -1.8));
  g.add(box(0.2, 3, 0.2, mat(0x555555), 2.8, 3.5, -1.8));
  // Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2, 4), mat(hColor, hColor, 0.2));
  roof.position.set(0, 6, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const signTex = makeTextTexture(label, 512, 128, '#ffffff', '#000000', 40);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), signMat);
  sign.position.set(0, 6.3, 1.5);
  g.add(sign);

  g.position.set(x, 0, z);
  scene.add(g);
}

buildCarnivalStand(30, 12, PINK, 'SPIT TOSS');
buildCarnivalStand(30, 28, PURPLE, 'SHOOTING');

function showRidePopup(key) {
  const info = rideInfos[key];
  popTitle.textContent = info.title;
  popDesc.textContent  = info.desc;
  popAction.onclick    = info.action;
  ridePopup.style.display = 'block';
}
function popupClose() { ridePopup.style.display = 'none'; }
popClose.onclick = popupClose;

// ─────────────────────────────────────────────────────────────
//  RAYCASTER for clicking rides
// ─────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

// Tag clickable objects
const clickables = [];
function tagClickable(obj, key) {
  obj.traverse(c => { if (c.isMesh) { c.userData.rideKey = key; clickables.push(c); } });
}

// We'll tag after building — store refs
let ferrisClickTarget, carouselClickTarget, coasterClickTarget;

// Build invisible click zones
function buildClickZones() {
  const zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  // Ferris wheel zone
  const fz = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 28, 16), zoneMat);
  fz.position.set(-18, 14, -5);
  fz.userData.rideKey = 'ferris';
  scene.add(fz); clickables.push(fz);

  // Carousel zone
  const cz = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 12, 16), zoneMat);
  cz.position.set(14, 6, -6);
  cz.userData.rideKey = 'carousel';
  scene.add(cz); clickables.push(cz);

  // Coaster zone (along start of track)
  const kz = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 10), zoneMat);
  kz.position.set(-30, 4, -15);
  kz.userData.rideKey = 'coaster';
  scene.add(kz); clickables.push(kz);
  
  // Spit Toss zone
  const sz1 = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), zoneMat);
  sz1.position.set(30, 4, 12);
  sz1.userData.rideKey = 'spittoss';
  scene.add(sz1); clickables.push(sz1);
  
  // Shoot Stand zone
  const sz2 = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), zoneMat);
  sz2.position.set(30, 4, 28);
  sz2.userData.rideKey = 'shootstand';
  scene.add(sz2); clickables.push(sz2);
}
buildClickZones();

function handleCanvasTap(clientX, clientY) {
  if (ridePopup.style.display === 'block') return;
  if (dragStartDist > 25) return; // ignore if it was a drag, not a tap
  
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  
  if (hits.length > 0 && hits[0].object.userData.rideKey) {
    showRidePopup(hits[0].object.userData.rideKey);
  }
}


// ─────────────────────────────────────────────────────────────
//  ROLLERCOASTER FPV SCREEN
// ─────────────────────────────────────────────────────────────
const coasterScreen = document.getElementById('coaster-screen');
const coasterCanvas = document.getElementById('coaster-canvas');
const coasterCtx    = coasterCanvas.getContext('2d');
const speedVal      = document.getElementById('speed-val');
let   coasterRide   = false;
let   coasterAnim   = 0;

function launchCoasterScreen() {
  coasterScreen.style.display = 'block';
  coasterRide  = true;
  coasterAnim  = 0;
  coasterCanvas.width  = window.innerWidth;
  coasterCanvas.height = window.innerHeight;
  runCoasterLoop();
}

window.exitCoaster = function() {
  coasterScreen.style.display = 'none';
  coasterRide = false;
};

function drawCoasterFrame(t) {
  const W = coasterCanvas.width, H = coasterCanvas.height;
  const speed = 60 + Math.sin(t * 0.7) * 40;
  speedVal.textContent = Math.round(Math.abs(speed + Math.sin(t * 3) * 20));

  // Sky gradient
  const skyGrad = coasterCtx.createLinearGradient(0, 0, 0, H * 0.6);
  skyGrad.addColorStop(0, '#020118');
  skyGrad.addColorStop(1, '#1a0044');
  coasterCtx.fillStyle = skyGrad;
  coasterCtx.fillRect(0, 0, W, H);

  // Stars
  coasterCtx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 80; i++) {
    const sx = ((i * 137.5 + t * 20) % W);
    const sy = (i * 53) % (H * 0.55);
    coasterCtx.fillRect(sx, sy, 1.5, 1.5);
  }

  // Track rails (perspective lines) 
  const horizon = H * 0.45 + Math.sin(t * 1.1) * H * 0.06;
  const curveSin = Math.sin(t * 0.8) * W * 0.15;

  // Ground
  const groundGrad = coasterCtx.createLinearGradient(0, horizon, 0, H);
  groundGrad.addColorStop(0, '#1a0044');
  groundGrad.addColorStop(1, '#050510');
  coasterCtx.fillStyle = groundGrad;
  coasterCtx.fillRect(0, horizon, W, H - horizon);

  // Checkerboard ground tiles
  const tileH = H - horizon;
  const rows = 12;
  for (let r = 0; r < rows; r++) {
    const yTop = horizon + (r / rows) * tileH;
    const yBot = horizon + ((r + 1) / rows) * tileH;
    const persp = r / rows;
    const tiles = Math.max(2, Math.floor(persp * 18));
    for (let c = 0; c < tiles; c++) {
      const xLeft  = W * 0.5 - persp * W * 0.5 + (c / tiles) * persp * W;
      const xRight = xLeft + persp * W / tiles;
      if ((r + c + Math.floor(t * 2)) % 2 === 0) {
        coasterCtx.fillStyle = '#2a0066';
        coasterCtx.fillRect(xLeft, yTop, xRight - xLeft + 1, yBot - yTop + 1);
      }
    }
  }

  // Rail lines (left & right)
  const RAIL_SPREAD = 90;
  const vanishX = W * 0.5 + curveSin * 0.3;

  coasterCtx.strokeStyle = '#dddddd';
  coasterCtx.lineWidth = 4;
  for (let rail = -1; rail <= 1; rail += 2) {
    coasterCtx.beginPath();
    coasterCtx.moveTo(vanishX, horizon);
    coasterCtx.lineTo(W * 0.5 + rail * RAIL_SPREAD * 2.5 + curveSin, H);
    coasterCtx.stroke();
  }

  // Crossties
  const ties = 16;
  coasterCtx.strokeStyle = '#aa8855';
  coasterCtx.lineWidth = 6;
  for (let i = 0; i < ties; i++) {
    const frac  = ((i / ties) + (t * 0.3) % 1) % 1;
    const y     = horizon + frac * (H - horizon);
    const halfW = (frac * RAIL_SPREAD * 2.5) + 4;
    const cx2   = vanishX + (W * 0.5 + curveSin - vanishX) * frac;
    coasterCtx.beginPath();
    coasterCtx.moveTo(cx2 - halfW, y);
    coasterCtx.lineTo(cx2 + halfW, y);
    coasterCtx.stroke();
  }

  // Speed blur lines
  if (Math.abs(speed) > 70) {
    for (let b = 0; b < 20; b++) {
      const bx = Math.random() * W;
      const by = Math.random() * H * 0.4 + horizon * 0.6;
      const bLen = 30 + Math.random() * 60;
      coasterCtx.strokeStyle = `rgba(255,77,166,${Math.random() * 0.3})`;
      coasterCtx.lineWidth = 1;
      coasterCtx.beginPath();
      coasterCtx.moveTo(bx, by);
      coasterCtx.lineTo(bx + bLen, by + Math.random() * 4 - 2);
      coasterCtx.stroke();
    }
  }

  // Park lights in distance
  const lights = [[0.3, 0.42, PINK], [0.5, 0.38, YELLOW], [0.7, 0.40, CYAN]];
  lights.forEach(([lx, ly, lc]) => {
    const col = new THREE.Color(lc);
    const hex = `#${col.getHexString()}`;
    const grd = coasterCtx.createRadialGradient(lx * W, ly * H, 2, lx * W, ly * H, 30 + Math.sin(t * 3) * 8);
    grd.addColorStop(0, hex + 'ff');
    grd.addColorStop(1, hex + '00');
    coasterCtx.fillStyle = grd;
    coasterCtx.fillRect(lx * W - 40, ly * H - 40, 80, 80);
  });

  // Vignette
  const vig = coasterCtx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,20,0.7)');
  coasterCtx.fillStyle = vig;
  coasterCtx.fillRect(0, 0, W, H);

  // Face flash removed

}

function runCoasterLoop() {
  if (!coasterRide) return;
  coasterAnim += 0.016;
  drawCoasterFrame(coasterAnim);
  requestAnimationFrame(runCoasterLoop);
}

// ─────────────────────────────────────────────────────────────
//  ANIMATION FLAGS
// ─────────────────────────────────────────────────────────────
let animateFerris   = true;
let animateCarousel = true;

// ─────────────────────────────────────────────────────────────
//  MAIN RENDER LOOP
// ─────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  updateCamera(0.016);

  // Ferris wheel rotation
  if (ferrisGroup && ferrisCarsGroup && animateFerris) {
    ferrisGroup.rotation.z += 0.003;
    ferrisCarsGroup.rotation.z += 0.003;
    // Keep cars upright (rotate inverse)
    ferrisCarsGroup.children.forEach(car => {
      car.rotation.z -= 0.003;
    });
  }

  // Carousel rotation
  if (carouselGroup && animateCarousel) {
    carouselGroup.rotation.y += 0.007;
  }

  // Coaster cart on track
  if (window._coasterCurve && coasterCartGroup) {
    coasterT = (coasterT + 0.0012) % 1;
    const pos = window._coasterCurve.getPoint(coasterT);
    const tan = window._coasterCurve.getTangent(coasterT);
    coasterCartGroup.position.copy(pos);
    coasterCartGroup.position.y += 0.6;
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(up, tan).normalize();
    const angle = Math.acos(up.dot(tan.normalize()));
    coasterCartGroup.quaternion.setFromAxisAngle(axis, angle - Math.PI / 2);
  }

  // Balloons floating
  balloonObjs.forEach(b => {
    b.position.y += Math.sin(t + b.userData.floatOffset) * 0.005;
    b.position.x += Math.sin(t * 0.3 + b.userData.floatOffset) * 0.003;
    if (b.userData.string) {
      b.userData.string.position.copy(b.position);
    }
  });

  // Mascot animation removed


  // Pulsing entrance lights / hue cycling on point lights
  scene.children.forEach(child => {
    if (child.isPointLight) {
      child.intensity = 1.8 + Math.sin(t * 2 + child.position.x) * 0.7;
    }
  });

  renderer.render(scene, camera);
}

animate();
