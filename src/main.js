// === Import Dependencies ===
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as TWEEN from '@tweenjs/tween.js';

// === Scene Setup ===
const scene = new THREE.Scene();
const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
renderer.shadowMap.enabled = true;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = true;
controls.enableDamping = true;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// === Loader ===
const loader = new GLTFLoader();
const modelNames = [
  'car', 'cart', 'lamp', 'hood', 'generator', 'table',
  'ground', 'robot', 'sign', 'menu', 'back', 'guide'
];

const mixers = [];
const shapeKeyObjects = {};
let camTargets = {};
let currentFocus = null;
let mainCamTransform = null;
let allowHover = { hood: true, back: true };
const hoverTimers = {};

function loadModel(name) {
  loader.load(`/models/${name}.glb`, (gltf) => {
    const model = gltf.scene;
    model.name = name;
    scene.add(model);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.morphTargetInfluences) {
          if (!shapeKeyObjects[name]) shapeKeyObjects[name] = [];
          shapeKeyObjects[name].push(child);
        }
      }
      if (child.isCamera) {
        camTargets[child.name] = child;
      }
    });

    if (name === 'ground') {
      const checkCam = () => {
        const cam = camTargets['MainCam'];
        if (cam) {
          camera.position.copy(cam.position);
          camera.quaternion.copy(cam.quaternion);
          mainCamTransform = cam;
          controls.enabled = true;
        } else {
          setTimeout(checkCam, 100);
        }
      };
      checkCam();
    }
  });
}

modelNames.forEach(loadModel);

function tweenToCamera(target) {
  currentFocus = target.name;
  controls.enabled = false;

  new TWEEN.Tween(camera.position)
    .to({ x: target.position.x, y: target.position.y, z: target.position.z }, 1000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();

  const camRot = new THREE.Quaternion().copy(target.quaternion);
  new TWEEN.Tween(camera.quaternion)
    .to({ x: camRot.x, y: camRot.y, z: camRot.z, w: camRot.w }, 1000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentFocus && mainCamTransform) {
    tweenToCamera(mainCamTransform);
    controls.enabled = true;
    currentFocus = null;
    allowHover = { hood: true, back: true };
  }
});

const shapeLoopers = {
  lamp: { duration: 2000 },
  robot: { duration: 1000 },
  generator: { duration: 1000 },
  menu: { duration: 2000, step: (t) => ((t % 1) < 0.2 ? 1 : 0) },
};

function animateShapeKeys(name, duration = 2000, stepFunc) {
  const objs = shapeKeyObjects[name];
  if (!objs) return;
  const t = performance.now() / duration;
  const value = stepFunc ? stepFunc(t) : (t % 2 < 1 ? t % 1 : 1 - (t % 1));
  objs.forEach((mesh) => {
    for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
      mesh.morphTargetInfluences[i] = value;
    }
  });
}

function setMorphValue(name, index, value) {
  shapeKeyObjects[name]?.forEach(m => {
    if (m.morphTargetInfluences.length > index) m.morphTargetInfluences[index] = value;
  });
}

// === Raycaster ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  document.body.style.cursor = 'default';

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    const obj = intersects[0].object.parent;
    const name = obj.name;
    if (["hood", "back", "table", "menu", "guide"].includes(name)) {
      document.body.style.cursor = 'pointer';
    }

    if ((name === 'hood' || name === 'back') && allowHover[name]) {
      clearTimeout(hoverTimers[name]);
      hoverTimers[name] = setTimeout(() => {
        setMorphValue(name, 0, name === 'hood' ? 0.1 : 0);
      }, 250);
    } else if (name === 'table') {
      setMorphValue('table', 1, 1);
      setTimeout(() => setMorphValue('table', 1, 0), 1000);
      setMorphValue('table', 2, 1);
    }
  } else {
    Object.keys(hoverTimers).forEach(k => clearTimeout(hoverTimers[k]));
    if (allowHover.hood) setMorphValue('hood', 0, 0);
    if (allowHover.back) setMorphValue('back', 0, 1);
    setMorphValue('table', 2, 0);
  }
}

function onClick() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    const name = intersects[0].object.parent.name;
    if (name === 'hood') {
      allowHover.hood = false;
      setMorphValue('hood', 0, 1);
      tweenToCamera(camTargets['CamEngine']);
    }
    if (name === 'back') {
      allowHover.back = false;
      setMorphValue('back', 0, 0);
      tweenToCamera(camTargets['CamCustom']);
    }
    if (name === 'menu') tweenToCamera(camTargets['CamMenu']);
    if (name === 'guide') tweenToCamera(camTargets['CamGuide']);
  }
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Animate ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  TWEEN.update();

  for (const name in shapeLoopers) {
    const { duration, step } = shapeLoopers[name];
    animateShapeKeys(name, duration, step);
  }

  renderer.render(scene, camera);
}
animate();
