import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min';

// === Scene Setup ===
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
renderer.shadowMap.enabled = true;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// === Loaders and Variables ===
const loader = new GLTFLoader();
const modelNames = [
  'car', 'cart', 'lamp', 'hood', 'generator',
  'table', 'ground', 'robot', 'sign', 'menu',
  'back', 'guide'
];
const mixers = [];
const clickable = {};
const cameras = {};
let mainCamera = null;
let inAltView = false;

// === Load Models ===
modelNames.forEach(name => {
  loader.load(`/models/${name}.glb`, gltf => {
    const model = gltf.scene;
    model.traverse(obj => {
      obj.castShadow = true;
      obj.receiveShadow = true;

      // Store special cameras
      if (['Main_Cam', 'Cam_Engine', 'Cam_Custom'].includes(obj.name)) cameras[obj.name] = obj;
      if (['Cam_Menu', 'Cam_Guide'].includes(obj.name)) cameras[obj.name] = obj;

      // Set Main_Cam as starting camera
      if (obj.name === 'Main_Cam' && !mainCamera) {
        camera.position.copy(obj.position);
        camera.quaternion.copy(obj.quaternion);
        mainCamera = obj;
      }
    });

    // Loop shape keys
    model.traverse(obj => {
      if (obj.morphTargetInfluences) {
        const duration = name === 'robot' ? 1000 : (name === 'lamp' ? 2000 : null);
        if (duration) {
          let direction = 1;
          setInterval(() => {
            for (let i = 0; i < obj.morphTargetInfluences.length; i++) {
              obj.morphTargetInfluences[i] += direction * 0.05;
              if (obj.morphTargetInfluences[i] > 1 || obj.morphTargetInfluences[i] < 0) {
                direction *= -1;
              }
            }
          }, duration / 20);
        }
      }
    });

    // Interactions
    if (['hood', 'back', 'table', 'menu', 'guide'].includes(name)) {
      clickable[name] = model;

      model.userData.name = name;
      model.traverse(obj => {
        obj.userData.parentModel = name;
      });
    }

    scene.add(model);
  });
});

// === Raycasting for interactions ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovered = null;
const clock = new THREE.Clock();

// === Animate shape keys ===
function animateMorph(obj, key, to, duration = 500) {
  const start = obj.morphTargetInfluences[key] ?? 0;
  const startTime = performance.now();

  function animate() {
    const now = performance.now();
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    obj.morphTargetInfluences[key] = start + (to - start) * t;
    if (t < 1) requestAnimationFrame(animate);
  }
  animate();
}

// === Camera Transition ===
function moveCameraTo(targetCam) {
  if (!cameras[targetCam]) return;
  const fromPos = camera.position.clone();
  const fromQuat = camera.quaternion.clone();
  const toPos = cameras[targetCam].getWorldPosition(new THREE.Vector3());
  const toQuat = cameras[targetCam].getWorldQuaternion(new THREE.Quaternion());

  new TWEEN.Tween(fromPos).to(toPos, 1000).easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => camera.position.copy(fromPos)).start();
  new TWEEN.Tween(fromQuat).to(toQuat, 1000).easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => camera.quaternion.copy(fromQuat)).start();

  controls.enabled = false;
  inAltView = true;
}

// === Mouse Events ===
window.addEventListener('mousemove', event => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('click', () => {
  if (hovered) {
    switch (hovered) {
      case 'hood':
        hoodClicked = true;
        animateMorph(clickable.hood.children[0], 0, 1);
        moveCameraTo('Cam_Engine');
        break;
      case 'back':
        backClicked = true;
        animateMorph(clickable.back.children[0], 1, 1);
        moveCameraTo('Cam_Custom');
        break;
      case 'menu':
        moveCameraTo('Cam_Menu');
        break;
      case 'guide':
        moveCameraTo('Cam_Guide');
        break;
    }
  }
});

window.addEventListener('wheel', () => {
  if (inAltView) {
    controls.enabled = true;
    inAltView = false;
    moveCameraTo('Main_Cam');
  }
});

let hoodClicked = false;
let backClicked = false;

// === Hover Logic ===
function handleHover() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    const name = intersects[0].object.userData.parentModel;
    if (name !== hovered) hovered = name;

    const obj = clickable[name]?.children[0];
    if (!obj || !obj.morphTargetInfluences) return;

    switch (name) {
      case 'hood':
        if (!hoodClicked) {
          animateMorph(obj, 0, 0.2);
        }
        break;
      case 'back':
        if (!backClicked) {
          animateMorph(obj, 1, 0);
        }
        break;
      case 'table':
        animateMorph(obj, 1, 1, 500);
        animateMorph(obj, 2, 1, 500);
        break;
    }
  } else {
    if (hovered) {
      const obj = clickable[hovered]?.children[0];
      if (!obj || !obj.morphTargetInfluences) return;

      switch (hovered) {
        case 'hood':
          if (!hoodClicked) animateMorph(obj, 0, 0);
          break;
        case 'back':
          if (!backClicked) animateMorph(obj, 1, 1);
          break;
        case 'table':
          animateMorph(obj, 1, 0, 500);
          animateMorph(obj, 2, 0, 500);
          break;
      }
    }
    hovered = null;
  }
}

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
  handleHover();
  renderer.render(scene, camera);
}
animate();
