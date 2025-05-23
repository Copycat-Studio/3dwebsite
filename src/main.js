// === Import Three.js Modules ===
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Tween, Easing, Group } from '@tweenjs/tween.js';
const TWEEN = {
  Tween,
  Easing,
  Group
};

// === Globals ===
const tweenGroup = new Group();
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera);
const USE_LOADING_SCREEN = true; // ⬅️ flip to true to enable
const animationSpeeds = {
  generator: 1,
  lamp: 0.3,
  menu: 0.5,
  robot: 0.5

};
const DEBUG = true; // ✅ flip to false to silence logs
window.DEBUG = true; // 👈 make it global

if (!DEBUG) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}


const debugSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.05),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
scene.add(debugSphere);

function updateDebugMarker() {
  if (currentFocus) {
    const pos = new THREE.Vector3();
    currentFocus.getWorldPosition(pos);
    debugSphere.position.copy(pos);
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x888888);
renderer.shadowMap.enabled = true;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 1.5;
controls.maxDistance = 9;

scene.add(new THREE.AmbientLight(0xffffff, 0.75));

const loadingManager = new THREE.LoadingManager();

loadingManager.onError = function(url) {
  console.error("Got a problem loading: ${url");
} 

const loader = new GLTFLoader(loadingManager);
const percentText = document.querySelector('.percent-text');
const statusText = document.querySelector('.status-text');
const modelRefs = {};
const camTargets = {};
const captionMap = {
  'hitbox_hood': 'open<br>the engine',
  'hitbox_menu': 'click to see<br>portfolio',
  'hitbox_back': 'click to custom',
  'hitbox_guide': 'how to play',
  'hitbox_app': 'COMING<br>SOON',
  'hitbox_reel': 'showreel',
  'hitbox_vr': 'COMING<br>SOON',
  'hitbox_immersive': 'COMING<br>SOON'
};
const hitboxMap = {
  'hitbox_back': {
    cam: 'cam_custom',
    model: 'back'
  },
  'hitbox_menu': {
    cam: 'cam_menu',
    model: 'menu'
  },
  'hitbox_hood': {
    cam: 'cam_engine',
    model: 'hood'
  },
  'hitbox_guide': {
    cam: 'cam_guide',
    model: 'guide'
  },
  'hitbox_glb': {
    cam: 'cam_back',
    model: 'back'
  }
};



let currentFocus = null;
let mainCamTransform = null;
let swapTimer = 0;
let hoodHoverLocked = false;
let hasHoveredBack = false;

// === Enhanced Load State Flags ===
let domReady = false;
let canvasReady = false;

function checkEverythingLoaded() {
  if (domReady && canvasReady && loadedCount === modelNames.length) {
    console.log('✅ All assets and DOM fully loaded!');

   // if (USE_LOADING_SCREEN) {
   //   const loadingEl = document.getElementById('loading');
   //   if (loadingEl) {
   //     loadingEl.remove();
   //     console.log('🧹 Loader removed');
   //   } else {
   //     console.warn('⚠️ #loading not found in DOM.');
   //   }
   // }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  domReady = true;
  //if (!USE_LOADING_SCREEN) {
  //  const loadingEl = document.getElementById('loading');
  //  if (loadingEl) {
  //    loadingEl.remove(); // 💣 kill instantly if disabled
  //  }
  //}
  checkEverythingLoaded();
});


const observer = new MutationObserver(() => {
  if (renderer.domElement && document.body.contains(renderer.domElement)) {
    canvasReady = true;
    console.log('🖼️ WebGL canvas ready');
    observer.disconnect();
    checkEverythingLoaded();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

window.THREE = THREE;
window.modelRefs = modelRefs;
window.listModels = () => {
  console.log('📦 Loaded Models:');
  Object.entries(modelRefs).forEach(([name, model], i) => {
    console.log(`${i + 1}. ${name}`, model);
  });
};

function reverseAllCamClips(modelName = 'focus_cam', speed = 1) {
  const model = modelRefs[modelName];
  if (!model || !model.userData.clips) {
    console.warn(`❌ No animation clips found on model "${modelName}"`);
    return;
  }

  const mixer = model.userData.mixer || new THREE.AnimationMixer(model);
  if (!model.userData.mixer) {
    model.userData.mixer = mixer;
  }

  model.userData.clips.forEach((clip) => {
    if (clip.name.startsWith('nla_cam')) {
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
      action.timeScale = -speed; // 🧨 Negative = reversed
      action.paused = false;
      action.play();
      action.time = action.getClip().duration; // 🧠 Start at end
      console.log(`⏪ Reversing "${clip.name}" on "${modelName}"`);
    }
  });
}

scene.remove(debugSphere);

// === Tween Helper ===
function tweenValue(obj, key, toValue, duration, easing = TWEEN.Easing.Quadratic.Out, onUpdate, onComplete) {
  const params = { [key]: obj[key] };
  return new Tween(params, tweenGroup)
    .to({ [key]: toValue }, duration)
    .easing(easing)
    .onUpdate(() => {
      obj[key] = params[key];
      onUpdate?.();
    })
    .onComplete(() => {
      onComplete?.();
    })
    .start();
}

// === Hood Animation Controller ===
const hoodAnim = {
  mixer: null,
  action: null,
  clip: null,
  timeObj: { value: 0 },
  currentTarget: 0,
  tween: null,
};

function playHoodClip(clipName, speed = 1) {
  const hood = modelRefs['hood'];
  if (!hood || !hood.userData.clips) return;

  const clip = hood.userData.clips.find(c => c.name === clipName);
  if (!clip) {
    console.warn(`🚫 Clip "${clipName}" not found in hood.glb`);
    return;
  }

  const mixer = hoodAnim.mixer || new THREE.AnimationMixer(hood);
  const action = mixer.clipAction(clip);

  if (hoodAnim.action) {
    hoodAnim.action.stop();
  }

  action.reset();
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.timeScale = speed; // 🌀 << Playback speed injection
  action.play();

  hoodAnim.mixer = mixer;
  hoodAnim.action = action;
  hoodAnim.clip = clip;

  console.log(`🎞️ Playing "${clipName}" @ ${speed}x speed`);
}

function focusOrbitOnModel(modelName) {
  const model = modelRefs[modelName];
  if (!model) {
    console.warn(`🚫 Orbit target model "${modelName}" not found.`);
    return;
  }
  const pos = new THREE.Vector3();
  model.getWorldPosition(pos);
  controls.target.copy(pos);
  controls.update();
  console.log(`🧲 Orbit center updated to model "${modelName}"`);
}

// === Camera Tweening ===
function tweenToCamera(target) {
  const targetPos = new THREE.Vector3();
  const targetQuat = new THREE.Quaternion();

  target.getWorldPosition(targetPos);
  target.getWorldQuaternion(targetQuat);

  // 1️⃣ Create a dummy object that holds the starting transform
  const dummy = new THREE.Object3D();
  dummy.position.copy(camera.position);
  dummy.quaternion.copy(camera.quaternion);

  // 2️⃣ Tween dummy's position
new TWEEN.Tween(dummy.position, tweenGroup)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => {
      camera.position.copy(dummy.position); // ✅ Smoothly apply position
      // console.log('📍 Tween cam pos:', camera.position.toArray());
    })
    .start();

  // 3️⃣ Tween dummy's quaternion (slerp over `t`)
  const rotTween = { t: 0 };
  const startQuat = dummy.quaternion.clone();
  const endQuat = targetQuat.clone();

  new TWEEN.Tween(rotTween)
    .to({ t: 1 }, 1000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => {
      THREE.Quaternion.slerp(startQuat, endQuat, dummy.quaternion, rotTween.t);
      camera.quaternion.copy(dummy.quaternion); // ✅ Apply smoothed rotation
    })
    .start();
}

function cameraFocusToMesh(modelName, meshName) {
  const parent = modelRefs[modelName];
  if (!parent) {
    console.warn(`❌ Model "${modelName}" not found`);
    return;
  }

  const mesh = parent.getObjectByName(meshName.toLowerCase());
  if (!mesh) {
    console.warn(`❌ Mesh "${meshName}" not found in model "${modelName}"`);
    return;
  }

  currentFocus = mesh;

  // 👁️ Optional: update orbit controls
  const pos = new THREE.Vector3();
  mesh.getWorldPosition(pos);
  controls.target.copy(pos);
  controls.update();

  console.log(`🎯 Focused on ${meshName} inside ${modelName}`);
}


function logFocusPosition() {
  if (currentFocus) {
    const pos = new THREE.Vector3();
    currentFocus.getWorldPosition(pos);
    console.log(`📍 currentFocus: ${currentFocus.name} @`, pos.toArray());
  } else {
    console.log('⚠️ No currentFocus set.');
  }

  console.log('🎯 OrbitControls.target @', controls.target.toArray());
}


// === Model Loader ===
const modelNames = [
  'car', 'cart', 'lamp', 'hood', 'generator', 'table',
  'ground', 'robot', 'sign1', 'sign2', 'menu', 'back', 'guide',
  'cam_engine', 'cam_guide','cam_custom','cam_menu',
  'hitbox_menu', 'hitbox_table', 'hitbox_hood', 'hitbox_back', 
  'hitbox_app', 'removelater', 'focus_cam', 'hitbox_vr', 'hitbox_immersive', 'hitbox_guide',
  'hitbox_reel', 'background',
  'icon_app', 'icon_vr', 'icon_reel', 'icon_immersive'
];

const loadingText = document.querySelector('.loading-text');

loader.manager.onProgress = (url, loaded, total) => {
  const percent = Math.round((loaded / total) * 100);
  if (percentText) percentText.textContent = `${percent}%`;
  if (statusText) statusText.textContent = `Loading ${url.split('/').pop()}...`;
};

loader.manager.onLoad = () => {
  console.log('✅ All assets loaded (onLoad manager)');
  if (USE_LOADING_SCREEN) {
    const loadingEl = document.getElementById('loading');
    loadingEl?.remove();
  }
};


function loadModel(name) {
  loader.load(`/models/${name}.glb`, (gltf) => {
    const model = gltf.scene;
    model.name = name.toLowerCase();
    scene.add(model);
    modelRefs[model.name] = model;
    // 🔒 Hide icon_* models on load
if (['icon_app', 'icon_vr', 'icon_immersive', 'icon_reel'].includes(model.name)) {
  model.visible = false;
  console.log(`🙈 Hiding icon model: ${model.name}`);
}


    const worldPos = new THREE.Vector3();
model.getWorldPosition(worldPos);
console.log(`🌍 World position of "${model.name}":`, worldPos.toArray());

    onModelLoaded();

    if (gltf.animations?.length > 0) {
      model.userData.clips = gltf.animations;
    }

        // 🔁 Auto-play looped animation for specific models
    if (['generator', 'lamp', 'menu', 'robot'].includes(name.toLowerCase()) && gltf.animations?.length > 0) {
  const mixer = new THREE.AnimationMixer(model);
  const loopAction = mixer.clipAction(gltf.animations[0]);
  
  const speed = animationSpeeds[name.toLowerCase()] || 1.0; // fallback = 1.0x
  loopAction.setLoop(THREE.LoopPingPong);
  loopAction.timeScale = speed; // 🎚️ Apply model-specific speed
  loopAction.play();

  model.userData.mixer = mixer;

  console.log(`🔁 Playing "${name}" loop @ ${speed}x`);
}

    model.traverse((child) => {
  if (child.name) child.name = child.name.toLowerCase();

if (child.name && ['hitbox_app', 'hitbox_vr', 'hitbox_immersive', 'hitbox_reel'].includes(child.name)) {
  child.visible = false;
  child.userData.disabled = true;
}

  
  if (child.isMesh) {
    child.castShadow = true;
    child.receiveShadow = true;
    const childWorld = new THREE.Vector3();
    child.getWorldPosition(childWorld);
    console.log(`🧱 Mesh: ${child.name} → 🌍`, childWorld.toArray());

    // 🔍 Shape Key Debug Log
    if (child.morphTargetInfluences) {
      console.log('🧬 Morph Target Mesh:', child.name);
      console.log('🔑 Shape Keys:', child.morphTargetDictionary);
    }

    if (child.name.startsWith('hitbox_')) {
      child.material.transparent = true;
      child.material.opacity = 0;
      child.renderOrder = 999;
      child.userData.isHitbox = true;
    }
  }

  if (child.isCamera) {
    camTargets[child.name.toLowerCase()] = child;
  }
});

window.camTargets = camTargets;
window.camera = camera;
window.tweenToCamera = tweenToCamera;


    if (name === 'ground') {
      const initMainCam = () => {
        const cam = camTargets['maincam'];
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

if (!Array.isArray(modelNames) || modelNames.length === 0) {
  console.warn('⚠️ No models to load. Aborting model loading process.');
} else {
  modelNames.forEach(loadModel);
}

let loadedCount = 0;

function onModelLoaded() {
  loadedCount++;
  if (loadedCount === modelNames.length) {
    console.log('✅ All models loaded.');
    checkEverythingLoaded(); // Call the shared checker
        // 🔒 Focus camera on mesh_focus inside focus_cam.glb
    currentFocus = modelRefs['focus_cam'];
        debugSphere.visible = false;
  }
}

const waitForHood = setInterval(() => {
  if (modelRefs['hood']) {
    clearInterval(waitForHood);
    console.log('✅ Hood model loaded. Ready for animation.');
  }
}, 100);


window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    console.log('🔁 ESC pressed → resetting scene state...');
     reverseAllCamClips();
     
    // 🔁 Move camera to original default cam
    if (mainCamTransform) {
      tweenToCamera(mainCamTransform);
    }

    // 🔄 Clear focus & orbit
    currentFocus = null;
    controls.target.set(0, 0, 0); // center orbit (or your default)
    controls.enabled = true;

    // 🔓 Unlock UI logic
    hoodHoverLocked = false;
    hasHoveredBack = false;

    // ✅ Reset visibility for signs if needed
    if (modelRefs['sign1'] && modelRefs['sign2']) {
      modelRefs['sign1'].visible = true;
      modelRefs['sign2'].visible = false;
    }

    // 🧹 Re-add any hitboxes you previously removed (example: hood)
    const hood = modelRefs['hood'];
    if (hood) {
      const removed = hood.getObjectByName('hitbox_hood');
      if (!removed) {
        // 👁️ recreate hitbox only if needed
        const hitbox = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hitbox.name = 'hitbox_hood';
        hitbox.userData.isHitbox = true;
        hood.add(hitbox);
        console.log('♻️ Re-added hitbox_hood');
      }
    }

    // 🛑 Optionally stop any animations?
    // if (modelRefs['focus_cam']?.userData?.mixer) modelRefs['focus_cam'].userData.mixer.stopAllAction();

    console.log('✅ Reset complete.');
  }

  if (e.key === 'l' || e.key === 'L') {
    logFocusPosition(); // 🔍 press "L" to log
  }
});



const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastHoveredHitbox = null;

function playModelClip(modelName, clipName, direction = 1, speed = 1) {
  const model = modelRefs[modelName];
  if (!model || !model.userData.clips) return;

  const clip = model.userData.clips.find(c => c.name === clipName);
  if (!clip) {
    console.warn(`❌ Clip "${clipName}" not found on "${modelName}"`);
    return;
  }

  const mixer = model.userData.mixer || new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);

  action.reset();
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.timeScale = speed * direction;
  action.play();

  if (!model.userData.mixer) model.userData.mixer = mixer;

  console.log(`🎞️ Playing "${clipName}" on "${modelName}" dir: ${direction} speed: ${speed}`);
}

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  let newHoveredHitbox = null;
  let hoveredObj = null;

  for (const i of intersects) {
    let obj = i.object;
    while (obj.parent && obj.parent !== scene) obj = obj.parent;

    if (obj.name?.startsWith('hitbox_')) {
      if (obj.name === 'hitbox_hood' && obj.userData.disabled) continue;
      newHoveredHitbox = obj.name;
      hoveredObj = obj;
      break;
    }
  }

  const captionEl = document.getElementById('hood-caption');

if (newHoveredHitbox !== lastHoveredHitbox) {

  // === Hover out ===
  if (lastHoveredHitbox) {
    console.log(`👋 Hover out: ${lastHoveredHitbox}`);

    if (lastHoveredHitbox === 'hitbox_hood' && !hoodHoverLocked) {
      playHoodClip('nla_hoodClose', 5);
    }
    if (lastHoveredHitbox === 'hitbox_table') {
      playModelClip('table', 'nla_tableback', 1);
    }

    // 🛑 Stop icon animations
    const stopAnim = (modelName) => {
      const model = modelRefs[modelName];
      if (!model?.userData?.mixer) return;
      model.userData.mixer.stopAllAction();
      console.log(`🛑 Stopped animations on ${modelName}`);
    };

    switch (lastHoveredHitbox) {
      case 'hitbox_reel': stopAnim('icon_reel'); break;
      case 'hitbox_vr': stopAnim('icon_vr'); break;
      case 'hitbox_app': stopAnim('icon_app'); break;
      case 'hitbox_immersive': stopAnim('icon_immersive'); break;
    }
  }

  // === Hover in ===
  if (newHoveredHitbox) {
    console.log(`👀 Hover in: ${newHoveredHitbox}`);

    if (newHoveredHitbox === 'hitbox_hood' && !hoodHoverLocked) {
      playHoodClip('nla_hoodOpen', 5);
    }
    if (newHoveredHitbox === 'hitbox_back' && !hasHoveredBack) {
      playModelClip('back', 'nla_back', 1);
      hasHoveredBack = true;
    }
    if (newHoveredHitbox === 'hitbox_table') {
      playModelClip('table', 'nla_table', 1);
    }

// 🔁 Play icon animations with custom speed
const playAnim = (modelName, clipNames, playSpeed = 1) => {
  const model = modelRefs[modelName];
  if (!model || !model.userData.clips) return;

  const mixer = model.userData.mixer || new THREE.AnimationMixer(model);
  if (!model.userData.mixer) model.userData.mixer = mixer;

  (Array.isArray(clipNames) ? clipNames : [clipNames]).forEach(clipName => {
    const clip = model.userData.clips.find(c => c.name === clipName);
    if (!clip) {
      return console.warn(`❌ Clip "${clipName}" not found on "${modelName}"`);
    }

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopPingPong);
    action.clampWhenFinished = false;
    action.timeScale = playSpeed; // ⚡ Speed control here
    action.reset().play();

    console.log(`🔁 Playing "${clipName}" on "${modelName}" @ speed: ${playSpeed}x`);
  });
};


    switch (newHoveredHitbox) {
      case 'hitbox_reel': playAnim('icon_reel', 'nla_iconreel', 0.5); break;
      case 'hitbox_vr': playAnim('icon_vr', 'nla_iconvr', 0.5); break;
      case 'hitbox_app': playAnim('icon_app', 'nla_iconapp', 0.4); break;
      case 'hitbox_immersive': playAnim('icon_immersive', 'nla_iconim', 0.5); break;
    }

  }

  lastHoveredHitbox = newHoveredHitbox;
}



if (captionMap[newHoveredHitbox]) {
  captionEl.innerHTML = captionMap[newHoveredHitbox];
  captionEl.style.display = 'block';
  captionEl.style.left = `${e.clientX + 15}px`;
  captionEl.style.top = `${e.clientY + 15}px`;
} else {
  captionEl.style.display = 'none';
}

  document.body.style.cursor = newHoveredHitbox ? 'pointer' : 'default';


}


function onClick() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (!intersects.length) return;

  let obj = intersects[0].object;
  while (obj.parent && obj.parent !== scene) obj = obj.parent;

// camera movement

 if (obj.name?.startsWith('hitbox_')) {
  if (obj.name === 'hitbox_hood' && obj.userData.disabled) {
    console.log('🚫 hitbox_hood already removed – click ignored');
    return;
  }

  console.log(`🖱️ Clicked: ${obj.name}`);

const mapping = hitboxMap[obj.name];
if (mapping) {
  const { cam, model } = mapping;
  const camTarget = camTargets[cam];
  currentFocus = modelRefs['focus_cam'];

  console.log(`🎯 ${obj.name} clicked → camera: ${cam}, orbit: ${model}`);

  if (camTarget) {
    tweenToCamera(camTarget, model); // ✅ orbit centered on model
  } else {
    console.warn(`❌ Camera target "${cam}" not found.`);
  }

  // 🧹 Special logic for hood click
  if (obj.name === 'hitbox_hood') {
    playHoodClip('nla_hoodAction');
    playModelClip('focus_cam', 'nla_camhood', .65);
    hoodHoverLocked = true;

    if (obj.parent) {
      obj.parent.remove(obj);
      console.log('🧹 hitbox_hood removed from scene');
    }

    obj.userData.disabled = true;
    controls.enabled = false;
  }
}

if (obj.name === 'hitbox_menu') {
  playModelClip('focus_cam', 'nla_cammenu', 0.65);

  // 🔥 Fully remove hitbox_menu from scene
  if (obj.parent) {
    obj.parent.remove(obj);
    console.log('🧹 hitbox_menu removed from scene');
  }

  obj.userData.disabled = true;

  const DELAY_MS = 1000;
  setTimeout(() => {
    ['hitbox_app', 'hitbox_vr', 'hitbox_immersive', 'hitbox_reel'].forEach(name => {
      const hitbox = modelRefs['menu']?.getObjectByName(name);
      if (hitbox) {
        hitbox.visible = true;
        hitbox.userData.disabled = false;
        console.log(`🟢 Delayed unlock: ${name}`);
      } else {
        console.warn(`❌ Hitbox not found: ${name}`);
      }
    });

    const menuModel = modelRefs['menu'];
    if (menuModel) {
      menuModel.visible = false;
      console.log('⏱️ menu.glb hidden after delay');
      ['icon_app', 'icon_vr', 'icon_immersive', 'icon_reel'].forEach(iconName => {
      const icon = modelRefs[iconName];
      if (icon) {
        icon.visible = true;
        console.log(`✨ Icon "${iconName}" made visible`);
      } else {
        console.warn(`❌ Icon model "${iconName}" not found`);
      }
    });
    }

  }, DELAY_MS);
}



if (obj.name === 'hitbox_reel') {
  console.log('🔗 hitbox_reel clicked → Opening YouTube...');
  window.open('https://www.youtube.com/watch?v=hFs0UhpgJSE', '_blank');
  return;
}


if (obj.name === 'hitbox_guide') {
  playModelClip('focus_cam', 'nla_camguide', .65);
}

if (obj.name === 'hitbox_back') {
  console.log('🎯 hitbox_back clicked → move to cam_custom + play "nla_camback"');

  const camTarget = camTargets['cam_custom'];
  if (camTarget) {
    controls.enabled = false;

    // ✅ Lock focus to full model
    currentFocus = modelRefs['focus_cam'];

    // ✅ Move camera
    tweenToCamera(camTarget);

    // ✅ Play animation clip
    playModelClip('focus_cam', 'nla_camback', .65);
  } else {
    console.warn('❌ cam_custom not found');
  }
  return;
}

}
}

 

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);
window.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

  // Reuse raycasting logic
  onClick();
});


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controls.update();
  tweenGroup.update();

    if (hoodAnim.mixer) hoodAnim.mixer.update(delta);

  // mixer animation

['generator', 'lamp', 'back', 'table', 'menu', 'focus_cam', 'robot',
  'icon_app', 'icon_vr', 'icon_reel', 'icon_immersive'
].forEach(name => {
  const model = modelRefs[name];
  const mixer = model?.userData?.mixer;
  if (mixer) mixer.update(delta);
});



  swapTimer += delta;
  if (swapTimer >= 1 && modelRefs['sign1'] && modelRefs['sign2']) {
    swapTimer = 0;
    const v = modelRefs['sign1'].visible;
    modelRefs['sign1'].visible = !v;
    modelRefs['sign2'].visible = v;
  }

if (currentFocus) {
  const pos = new THREE.Vector3();
  currentFocus.getWorldPosition(pos);
  controls.target.copy(pos); // keep orbit synced if enabled
}
updateDebugMarker(); // 🧠 add this line here
controls.update();
renderer.render(scene, camera);


  renderer.render(scene, camera);
}

animate();
