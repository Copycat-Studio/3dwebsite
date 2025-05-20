// === Import Three.js Modules ===
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as TWEEN from '@tweenjs/tween.js';

// === Initialize Scene ===
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const mixers = [];

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
renderer.shadowMap.enabled = true;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

// === Controls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 3;
controls.maxDistance = 20;

// === Lighting ===
scene.add(new THREE.AmbientLight(0xffffff, 2));

// === Asset Management ===
const loader = new GLTFLoader();
const modelNames = [
  'car', 'cart', 'lamp', 'hood', 'generator', 'table',
  'ground', 'robot', 'sign1', 'sign2', 'menu', 'back', 'guide',
  'cam_engine', 'hitbox_menu', 'hitbox_table', 'hitbox_hood', 'hitbox_back', 'removelater'
];

const camTargets = {};
const modelRefs = {};
let currentFocus = null;
let mainCamTransform = null;

function loadModel(name) {
  loader.load(`/models/${name}.glb`, (gltf) => {
    const model = gltf.scene;
    model.name = name;
    scene.add(model);
    modelRefs[name] = model;

    if (gltf.animations && gltf.animations.length > 0) {
  const mixer = new THREE.AnimationMixer(model);
  model.userData.mixer = mixer;
  model.userData.clips = gltf.animations;
  mixers.push(mixer);

   gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopPingPong, Infinity); // 🔁 Ping-pong loop
    action.clampWhenFinished = true;              // Optional: stops at end frame if not looping
    action.timeScale = 0.5;                        // ⏳ 50% speed
    action.play();                                 // ▶️ Start the animation
  });
}


    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (name.startsWith('hitbox_')) {
          child.material.transparent = true;
          child.material.opacity = 0;
          child.renderOrder = 999;
          child.userData.isHitbox = true;
        }
      }

      if (child.isCamera) {
        camTargets[child.name] = child;
      }
    });

    if (name === 'ground') {
      const initMainCam = () => {
        const cam = camTargets['MainCam'];
        if (cam) {
          camera.position.copy(cam.position);
          camera.quaternion.copy(cam.quaternion);
          mainCamTransform = cam;
          controls.enabled = true;
        } else {
          setTimeout(initMainCam, 100);
        }
      };
      initMainCam();
    }
  });
}

modelNames.forEach(loadModel);

function tweenToCamera(target) {
  currentFocus = target.name;
  controls.enabled = false;

  new TWEEN.Tween(camera.position)
    .to(target.position, 1000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();

  new TWEEN.Tween(camera.quaternion)
    .to(target.quaternion, 1000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentFocus && mainCamTransform) {
    tweenToCamera(mainCamTransform);
    controls.enabled = true;
    currentFocus = null;
  }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredObject = null;

const hoverTriggered = {
  hitbox_hood: false,
  hitbox_back: false,
  hitbox_table: false,
};

function playPartialAnimation({ model, clipName, portion = 1.0, duration = 1000 }) {
  if (!model || !model.userData.mixer || !model.userData.clips) return;

  const clip = model.userData.clips.find(c => c.name === clipName);
  if (!clip) return;

  const action = model.userData.mixer.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;

  const portionDuration = clip.duration * portion;
  action.timeScale = portionDuration > 0 ? portionDuration / (duration / 1000) : 1;
  action.play();

  setTimeout(() => {
    action.stop();
  }, duration);
}

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  hoveredObject = null;

  for (const i of intersects) {
    let obj = i.object;
    while (obj.parent && obj.parent !== scene) obj = obj.parent;
    if (obj.name.startsWith('hitbox_')) {
      hoveredObject = obj;
      break;
    }
  }

  if (!hoveredObject) return;

  const name = hoveredObject.name;

  if (name === 'hitbox_hood' && !hoverTriggered[name]) {
    console.log('Hover triggered: HOOD');
    hoverTriggered[name] = true;
    const hoodModel = modelRefs['hood'];
    playPartialAnimation({
      model: hoodModel,
      clipName: 'HoodAction',
      portion: 0.1,
      duration: 1000
    });
  }
}

function onClick() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj.parent && obj.parent !== scene) obj = obj.parent;

    if (obj.name === 'hitbox_hood') {
      const hoodModel = modelRefs['hood'];
      playPartialAnimation({
        model: hoodModel,
        clipName: 'HoodAction',
        portion: 1.0,
        duration: 1500
      });
      const cam = camTargets['cam_engine'];
      if (cam) tweenToCamera(cam);
    }
  }
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let swapTimer = 0;
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controls.update();
  TWEEN.update();
  swapTimer += delta;

  mixers.forEach(mixer => mixer.update(delta));

  if (swapTimer >= 1 && modelRefs['sign1'] && modelRefs['sign2']) {
    swapTimer = 0;
    const v = modelRefs['sign1'].visible;
    modelRefs['sign1'].visible = !v;
    modelRefs['sign2'].visible = v;
  }

  renderer.render(scene, camera);
}
animate();
