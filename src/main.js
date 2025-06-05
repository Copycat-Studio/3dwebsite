// === Import Three.js Modules ===
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
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
const listener = new THREE.AudioListener();
camera.add(listener);
const animationSpeeds = {
  generator: 1,
  lamp: 0.3,
  menu: 0.5,
  robot: 0.4,
  robot1: 0.4,
  robot2: 0.4,
  engine_corebroken: 0.4,
  speaker: 2.1,
  icon_shoes: .3

};


const cursor = document.getElementById('custom-cursor');
const pointer = document.getElementById('custom-pointer');

window.addEventListener('mousemove', (e) => {
  const x = e.clientX;
  const y = e.clientY;

  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;

  pointer.style.left = `${x}px`;
  pointer.style.top = `${y}px`;
});

const DEBUG = true; // ✅ flip to false to silence logs
window.DEBUG = true; // 👈 make it global
const hitboxOriginalPositions = {};

if (!DEBUG) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

function updateDebugMarker() {
  if (currentFocus) {
    const pos = new THREE.Vector3();
    currentFocus.getWorldPosition(pos);
  }
}

function moveHitboxY(name, toOffsetY = 500, duration = 0) {
  let hitbox = null;

  for (const model of Object.values(modelRefs)) {
    const found = model.getObjectByName?.(name);
    if (found) {
      hitbox = found;
      break;
    }
  }

  if (!hitbox) {
    console.warn(`❌ Hitbox "${name}" not found.`);
    return;
  }

  // Store original position
  if (!hitboxOriginalPositions[name]) {
    hitboxOriginalPositions[name] = hitbox.position.clone();
  }

  const baseY = hitboxOriginalPositions[name].y;
  const currentY = hitbox.position.y;
  const targetY = baseY + toOffsetY;

  // Skip if already at target
  if (Math.abs(currentY - targetY) < 1e-2) {
    console.log(`⛔ "${name}" already at Y offset.`);
    return;
  }

  new TWEEN.Tween({ y: currentY }, tweenGroup)
    .to({ y: targetY }, duration)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(obj => {
      hitbox.position.y = obj.y;
    })
    .start();
}

function moveModelToOffsetXYZ(modelName, offset = { x: 0, y: 0, z: 0 }, duration = 650) {
  const model = modelRefs[modelName];
  if (!model) {
    console.warn(`❌ Model "${modelName}" not found.`);
    return;
  }

  // Cache original position if not already stored
  if (!hitboxOriginalPositions[modelName]) {
    hitboxOriginalPositions[modelName] = model.position.clone();
  }

  const base = hitboxOriginalPositions[modelName];
  const target = {
    x: base.x + (offset.x || 0),
    y: base.y + (offset.y || 0),
    z: base.z + (offset.z || 0)
  };

  new TWEEN.Tween({ ...model.position }, tweenGroup)
    .to(target, duration)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(obj => {
      model.position.set(obj.x, obj.y, obj.z);
    })
    .start();
}


const renderer = new THREE.WebGLRenderer({ antialias: true });
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1;               
renderer.outputEncoding = THREE.sRGBEncoding;      

//BACKGROUND
renderer.setClearColor(0x17021F);
renderer.shadowMap.enabled = true;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
renderer.domElement.style.outline = 'none';
renderer.domElement.style.touchAction = 'none';
renderer.domElement.style.userSelect = 'none';
renderer.domElement.style.cursor = 'none';


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 1.5;
controls.maxDistance = 12;
controls.minAzimuthAngle = -Infinity;
controls.maxAzimuthAngle = Infinity;
const defaultControlsRange = {
  minDistance: 1.5,
  maxDistance: 12
};



scene.add(new THREE.AmbientLight(0xffffff, .5));

//Loading part

const loadingManager = new THREE.LoadingManager();
const progressBar = document.getElementById('progress-bar');
const progressBarContainer = document.querySelector('.progress-bar-container');
const progressCaption = document.getElementById('progress-caption');

loadingManager.onProgress = function (url, loaded, total) {
  const progress = (loaded / total) * 100;
  
  // Update bar value
  if (progressBar) {
    progressBar.value = progress;
  }

  // Dynamic label update
  const label = document.getElementById('progress-label');
  if (label) {
    if (progress < 25) {
      label.textContent = 'On Parking...';
    } else if (progress < 50) {
      label.textContent = 'Unpack The Box...';
    } else if (progress < 75) {
      label.textContent = 'Turning On Stove...';
    } else if (progress < 99) {
      label.textContent = 'Preparing Food...';
    } else {
      label.textContent = 'Ready To Serve...';
    }
  }

  // Caption update (you already have this)
  if (progressCaption) {
    const file = url.split('/').pop();
    progressCaption.textContent = `Loading: ${file} (${loaded}/${total})`;
  }
};


loadingManager.onLoad = function () {
  if (progressCaption) {
    progressCaption.textContent = '✅ All assets loaded.';
  }
  setTimeout(() => {
    if (progressBarContainer) progressBarContainer.style.display = 'none';
  }, 300);
}

const gltfLoader = new GLTFLoader(loadingManager);

const rgbeLoader = new RGBELoader(loadingManager);

function setWorldPosition(mesh, worldPos) {
  if (!mesh.parent) {
    console.warn('⚠️ Mesh has no parent — cannot convert to local');
    return;
  }

  const localPos = new THREE.Vector3();
  mesh.parent.worldToLocal(localPos.copy(worldPos));
  mesh.position.copy(localPos);
}


loadingManager.onError = function(url) {
  console.error(`Got a problem loading: ${url}`);
} 


const loader = new GLTFLoader(loadingManager);
loader.load('/textures/my_bg.jpg', texture => {
  scene.background = texture;
});
const modelRefs = {};
const camTargets = {};
const captionMap = {
  'hitbox_hood': 'Open<br>The Engine',
  'hitbox_menu': 'Click To See<br>Portfolio',
  'hitbox_back': 'Product<br>Showcase',
  'hitbox_guide': 'Thanks to!',
  'hitbox_app': 'COMING<br>SOON',
  'hitbox_reel': 'Showreel',
  'hitbox_vr': 'COMING<br>SOON',
  'hitbox_immersive': 'CGI by Curio',
  'hitbox_engine' : 'Repair Me!',
  'hitbox_engine1' : 'Open The Cover!',
  'hitbox_engine2' : 'Lets Find The Problem!',
  'hitbox_engine3' : 'Change The Core',
  'hitbox_table' : 'Book Now!',
  'hitbox_cable' : 'Light Switch',
  'hitbox_speaker' : 'Music On/Off',
  'hitbox_shoes' : 'See Detail'
};


//======camera list=====

const hitboxMap = {
  'hitbox_back': {
    cam: {
    desktop: 'cam_custom',
    mobile: 'cam_custommobile'
    },
    model: 'back',
    controls: {
    minDistance: .5,
    maxDistance: 6.0,
  minAzimuthAngle: -Math.PI / 1, 
  maxAzimuthAngle: Math.PI / 1
  }
  },
  'hitbox_menu': {
    cam: {
    desktop: 'cam_menu',
    mobile: 'cam_menumobile'
    },
    model: 'menu',
    controls: {
    minDistance: .1,
    maxDistance: 6.0,
  minAzimuthAngle: -Math.PI / 1, 
  maxAzimuthAngle: Math.PI / 1
  }
  },
  'hitbox_hood': {
    cam: {
    desktop: 'cam_hood',
    mobile: 'cam_hoodmobile'
    },
    model: 'hood',
    controls: {
    minDistance: 2.0,
    maxDistance: 6.0,
  minAzimuthAngle: -Math.PI / 1, 
  maxAzimuthAngle: Math.PI / 1
  }
  },
   'hitbox_engine': {
    cam: {
    desktop: 'cam_engine',
    mobile: 'cam_enginemobile'
    },
    model: 'engine',
    controls: {
    minDistance: 1,
    maxDistance: 2,
  minAzimuthAngle: -Math.PI / -6, 
  maxAzimuthAngle: Math.PI / -1
  }
  },
   'hitbox_shoes': {
    cam: {
    desktop: 'cam_shoes',
    mobile: 'cam_shoes'
    },
    model: 'shoes',
  controls: {
    minDistance: .5,
    maxDistance: 1.5,
  minAzimuthAngle: -Math.PI / -3, 
  maxAzimuthAngle: Math.PI / -1 
  }
  },
  'hitbox_guide': {
    cam: {
    desktop: 'cam_guide',
    mobile: 'cam_guide'
    },
    model: 'guide',
  controls: {
    minDistance: 1,
    maxDistance: 10,
  minAzimuthAngle: -Math.PI / 1, 
  maxAzimuthAngle: Math.PI / 1
  }
  }
};

const toggleState = {
  speaker: true,
  // add more toggles here
};

//=====letlist=====
let currentFocus = null;
let mainCamTransform = null;
let swapTimer = 0;
let hoodHoverLocked = false;
let backHoverLocked = false;
let hasHoveredBack = false;
let inputLocked = false;
let signsSwapEnabled = true;
let visibilityLock = {};
let isHDREnabled = true;
let originalEnvMap = null; // for restoring later
let isMuted = false;


function resetSceneState() {
  console.log('🔁 Reset triggered (button or ESC)...');

  // 🔒 Hide reset button


  controls.minAzimuthAngle = -Infinity;
controls.maxAzimuthAngle = Infinity;
controls.minDistance = defaultControlsRange.minDistance;
controls.maxDistance = defaultControlsRange.maxDistance;
console.log('🔄 Reset controls zoom limits');


  playSFX('swoosh');
  signsSwapEnabled = true;
  toggleEntityState('generator', true);
  toggleEntityState('robot', true);


  // 🔄 Restore model visibility unless locked
Object.entries(modelRefs).forEach(([name, model]) => {
  if (name === 'engine_core') return; // 🚫 skip modifying engine_core

  model.visible = !visibilityLock[name];
  if (visibilityLock[name]) {
    console.log(`🔒 Locked: ${name} remains hidden`);
  }
});


  // 🔁 Restore hitbox positions
  Object.entries(hitboxOriginalPositions).forEach(([name, pos]) => {
    for (const model of Object.values(modelRefs)) {
      const hitbox = model.getObjectByName?.(name);
      if (hitbox) {
        new TWEEN.Tween({ y: hitbox.position.y }, tweenGroup)
          .to({ y: pos.y }, 1000)
          .easing(TWEEN.Easing.Quadratic.Out)
          .onUpdate(obj => hitbox.position.y = obj.y)
          .start();
        break;
      }
    }
  });

  // 🌀 Reset camera + controls
  reverseAllCamClips();
  if (mainCamTransform) tweenToCamera(mainCamTransform);
  controls.target.set(0, 0, 0);
  controls.enabled = true;

  currentFocus = null;
  hoodHoverLocked = false;
  backHoverLocked = false;
  hasHoveredBack = false;
  toggleShoeBackground(false);

  // 🧭 Restore sign swap state
  if (modelRefs['sign1']) modelRefs['sign1'].visible = true;
  if (modelRefs['sign2']) modelRefs['sign2'].visible = false;

  // ♻️ Rebuild missing hitbox_hood if deleted
  const hood = modelRefs['hood'];
  if (hood && !hood.getObjectByName('hitbox_hood')) {
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.name = 'hitbox_hood';
    hitbox.userData.isHitbox = true;
    hood.add(hitbox);
    console.log('♻️ Re-added hitbox_hood');
  }

  // 🎛️ Reset menu model and icons
  const menuModel = modelRefs['menu'];
  if (menuModel) {
    menuModel.visible = true;

    if (menuModel.userData.clips?.length > 0) {
      const clip = menuModel.userData.clips[0];
      const mixer = menuModel.userData.mixer || new THREE.AnimationMixer(menuModel);
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopPingPong);
      action.clampWhenFinished = false;
      action.play();
      menuModel.userData.mixer = mixer;
    }

    // Ensure hitbox_menu exists and is visible
    let hitboxMenu = menuModel.getObjectByName('hitbox_menu');
    if (hitboxMenu) {
      hitboxMenu.visible = true;
      if (!menuModel.children.includes(hitboxMenu)) {
        menuModel.add(hitboxMenu);
      }
    }

    // 🔇 Hide interactive menu hitboxes
    ['hitbox_app', 'hitbox_vr', 'hitbox_immersive', 'hitbox_reel'].forEach(name => {
      const hitbox = menuModel.getObjectByName(name);
      if (hitbox) {
        hitbox.visible = false;
        hitbox.userData.disabled = true;
      }
    });

['shoes_bot', 'shoes_body', 'shoes_plastic', 'shoes_rubber', 'shoes_carbon', 'shoes_sol', 'shoes_bg'].forEach(name => {
  const model = modelRefs[name];
  if (model) {
    model.visible = false;
    if (model.userData?.mixer) model.userData.mixer.stopAllAction();
  }
});

['back'].forEach(name => {
  const model = modelRefs[name];
  if (model) {
    if (model.userData?.mixer) model.userData.mixer.stopAllAction();
  }
});


    // 🕹️ Hide menu icons
    ['icon_app', 'icon_vr', 'icon_immersive', 'icon_reel', 'shoes', 'icon_shoes'].forEach(iconName => {
      const icon = modelRefs[iconName];
      if (icon) icon.visible = false;
    });

modelRefs['hitbox_shoes'].visible = false;

    console.log('🔁 Menu reset completed');
  }
}


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

function applyOrbitLimits(config) {
  controls.minDistance = config.minDistance ?? controls.minDistance;
  controls.maxDistance = config.maxDistance ?? controls.maxDistance;

  if ('minAzimuthAngle' in config && 'maxAzimuthAngle' in config) {
    controls.minAzimuthAngle = config.minAzimuthAngle;
    controls.maxAzimuthAngle = config.maxAzimuthAngle;
  } else {
    const currentAzimuth = controls.getAzimuthalAngle();
    const delta = Math.PI / 4;
    controls.minAzimuthAngle = currentAzimuth - delta;
    controls.maxAzimuthAngle = currentAzimuth + delta;
  }

  controls.update();
}

// ==== UI works =====

function toggleShoeBackground(show = true) {
  const bg = document.getElementById('shoe-bg');
  if (!bg) return;
  bg.classList.toggle('active', show);
}

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

function moveMultipleHitboxesY(hitboxNames = [], offsetY = 500, duration = 650) {
  hitboxNames.forEach(name => {
    moveHitboxY(name, offsetY, duration);
  });
}

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function pulseHighlight(modelName, color = 0xffff00, duration = 1000) {
  const model = modelRefs[modelName];
  if (!model) return console.warn(`❌ Model ${modelName} not found.`);

  model.traverse(child => {
    if (child.isMesh && child.material && 'emissive' in child.material) {
      const mat = child.material;
      const baseColor = mat.emissive.clone();

      new TWEEN.Tween({ intensity: 0 })
        .to({ intensity: 1 }, duration / 2)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(obj => {
          mat.emissive.set(color).multiplyScalar(obj.intensity);
        })
        .onComplete(() => {
          new TWEEN.Tween({ intensity: 1 })
            .to({ intensity: 0 }, duration / 2)
            .easing(TWEEN.Easing.Quadratic.In)
            .onUpdate(obj => {
              mat.emissive.set(color).multiplyScalar(obj.intensity);
            })
            .onComplete(() => {
              mat.emissive.copy(baseColor);
            })
            .start();
        })
        .start();
    }
  });
}

rgbeLoader.load('/textures/hdr.hdr', function (hdrEquirect) {
  const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;

  originalEnvMap = envMap;

  scene.environment = envMap;
  scene.background = null;

  hdrEquirect.dispose();

  console.log('🔥 HDR loaded → starting warm-up cycle...');

  // 🔥 Turn HDR OFF
  setTimeout(() => {
    scene.environment = null;
    scene.background = null;

    // 🔁 Turn HDR ON
    setTimeout(() => {
      scene.environment = originalEnvMap;
      scene.background = null;

      renderer.compile(scene, camera); // 🧠 optional: pre-compile shaders
      console.log('✅ HDR pre-warmed and ready');
    }, 100);
  }, 100);
});

const hdrEnvs = {};
const hdrLoader = new RGBELoader(loadingManager);

hdrLoader.load('/textures/hdr.hdr', (tex) => {
  hdrEnvs.hdrA = pmremGenerator.fromEquirectangular(tex).texture;
  tex.dispose();
});

hdrLoader.load('/textures/shoes_hdr.hdr', (tex) => {
  hdrEnvs.hdrB = pmremGenerator.fromEquirectangular(tex).texture;
  tex.dispose();
});

function throttle(func, limit) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

function launchHitboxLift1() {
  const targets = [
    'hitbox_menu', 'hitbox_table', 'hitbox_hood', 'hitbox_back', 'hitbox_guide', 'hitbox_cable', 'hitbox_shoes'
  ];
  
  moveMultipleHitboxesY(targets, 500);
}

function launchHitboxLift2() {
  const targets = [
    'hitbox_app', 'hitbox_vr', 'hitbox_reel', 'hitbox_immersive'
  ];
  
  moveMultipleHitboxesY(targets, 500); 
}

function launchHitboxLift3() {
  const targets = [
    'hitbox_engine', 'hitbox_engine1', 'hitbox_engine2', 'hitbox_engine3'
  ];
  
  moveMultipleHitboxesY(targets, 500);
}

function launchHitboxLift4() {
  const targets = [
    'hitbox_menu', 'hitbox_table', 'hitbox_hood', 'hitbox_back', 'hitbox_guide', 'hitbox_cable']
  
  moveMultipleHitboxesY(targets, 500);
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

// === AUDIO SECTION ===

const sfxMap = {};
const sfxLoader = new THREE.AudioLoader();

function loadSFX(name, url) {
  const sound = new THREE.Audio(listener);
  sfxLoader.load(url, buffer => {
    sound.setBuffer(buffer);
    sound.setVolume(1.0);
    sound.userData = { loaded: true };
    sfxMap[name] = sound;
  }, undefined, err => {
    console.warn(`⚠️ Failed to load SFX ${name}:`, err);
  });
}

function playSFX(name) {
  const sfx = sfxMap[name];
  if (!sfx || !sfx.userData?.loaded) {
    // Not ready yet
    return;
  }

  if (sfx.isPlaying) sfx.stop();
  sfx.play();
}

// 🚫 NO loadingManager here


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


// === Model List ===
const modelNames = [
  'car', 'cart', 'lamp', 'hood', 'generator', 'table', 'sky', 'speaker',
  'ground', 'robot', 'robot1', 'robot2', 'sign1', 'sign2', 'menu', 'back', 'guide',
  'background', 'logo', 'person',
  // shoes
   'shoes_bot', 'shoes_body', 'shoes_plastic', 'shoes_rubber', 'shoes_carbon', 'shoes_sol', 'shoes_bg1',
    //cam
  'cam_engine', 'cam_guide','cam_custom','cam_menu', 'cam_hood', 'cam_shoes',
  'cam_hoodmobile', 'cam_custommobile', 'cam_menumobile', 'cam_enginemobile',
    //hitbox
  'hitbox_menu', 'hitbox_table', 'hitbox_hood', 'hitbox_back', 'hitbox_cable', 'hitbox_shoes',
  'hitbox_app', 'focus_cam', 'hitbox_vr', 'hitbox_immersive', 'hitbox_guide', 'hitbox_speaker',
  'hitbox_reel', 'hitbox_engine', 'hitbox_engine1', 'hitbox_engine2', 'hitbox_engine3',
  'hitbox_block',
    //icon 
  'icon_shoes', 'icon_app', 'icon_vr', 'icon_reel', 'icon_immersive',
  'engine_corebroken','engine_core', 'engine_top', 'engine_cover', 'engine_fan', 'engine_base', 'engine_background'
];

function loadModel(name) {
  loader.load(`/models/${name}.glb`, (gltf) => {
    const model = gltf.scene;
    model.name = name.toLowerCase();
    scene.add(model);
    modelRefs[model.name] = model;

   if ([
    'engine_core', 'shoes', 'shoes_bot', 'shoes_body', 
    'shoes_plastic', 'shoes_rubber', 'shoes_carbon', 'shoes_sol', 'shoes_bg'
   ].includes(name)) {
  model.visible = false; // ✅ Hide on load
}

    // 💡 Dim HDRI lighting on all mesh materials
model.traverse(child => {
  if (child.isMesh && child.material && 'envMapIntensity' in child.material) {
    child.material.envMapIntensity = 0; // 🌓 Tweak 0.0–1.0 as needed
    child.material.needsUpdate = true;
  }
});
    
    // 🔒 Hide icon_* models on load
if (['icon_app', 'icon_vr', 'icon_immersive', 'icon_reel', 'icon_shoes'].includes(model.name)) {
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

        // ==== loop list=====
    if ([
      'generator', 'lamp', 'guide', 'person', 'menu', 'robot', 'icon_shoes',
     'robot1', 'robot2', 'engine_corebroken', 'engine_core', 'speaker'
    ].includes(name.toLowerCase()) && gltf.animations?.length > 0) {
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

  

  //====init hitbox hide====
if (child.name && ['hitbox_app', 'hitbox_vr', 'hitbox_immersive', 'hitbox_reel', 'hitbox_shoes'].includes(child.name)) {
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
    currentFocus = modelRefs['focus_cam'];

    if (isMobileDevice()) {
    console.log('📱 Mobile detected — enabling outline pulse');
    startAutoOutlinePulse(); // ✅ only on mobile
  } else {
    console.log('🖥️ Desktop detected — outline pulse skipped');
  }
  
  }
}



//====== FINISH LOADING=====

function triggerHitboxClick(name) {
  const model = Object.values(modelRefs).find(m => m.getObjectByName(name));
  const hitbox = model?.getObjectByName(name);
  if (hitbox) {
    handleHitboxClick(hitbox);
  } else {
    console.warn(`❌ No hitbox found: ${name}`);
  }
}


//==== Buttons =====

document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const hitboxName = btn.dataset.hitbox;
    triggerHitboxClick(hitboxName);
  });
});

const muteBtn = document.getElementById('button_speaker');

muteBtn?.addEventListener('click', () => {
  isMuted = !isMuted;

  muteBtn.src = isMuted 
    ? '/textures/button_mute2.png' 
    : '/textures/button_mute1.png';

  triggerHitboxClick('hitbox_speaker');

  console.log(`🔊 Mute button toggled: ${isMuted ? 'MUTED' : 'UNMUTED'}`);
});

const helpBtn = document.getElementById('button_extra');
  const helpImgBottom = document.getElementById('help-img-bottom');
  const helpImgCenter = document.getElementById('help-img-center');

  let helpVisible = false;

  helpBtn.addEventListener('click', () => {
    helpVisible = !helpVisible;
    helpImgBottom.style.display = helpVisible ? 'block' : 'none';
    helpImgCenter.style.display = helpVisible ? 'block' : 'none';
     });

function createOutline(model, color = 0xffff00, scale = 1.1) {
  const outlineGroup = new THREE.Group();
  model.traverse((child) => {
    if (child.isMesh) {
      const outline = child.clone();
      outline.material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.BackSide
      });
      outline.scale.multiplyScalar(scale);
      outline.renderOrder = 999;
      outlineGroup.add(outline);
    }
  });

  model.add(outlineGroup); // 🔗 Attach outline to original
  model.userData.outline = outlineGroup;
}

function removeOutline(model) {
  const outline = model.userData.outline;
  if (outline) {
    model.remove(outline);
    delete model.userData.outline;
  }
}

const pulsingModels = ['hood', 'back', 'table', 'menu', 'guide'];
let pulseInterval = null;

function startAutoOutlinePulse(color = 0x00ffff, scale = 1.1) {
  if (pulseInterval) return; // Already running

  pulseInterval = setInterval(() => {
    pulsingModels.forEach(name => {
      const model = modelRefs[name];
      if (!model) return;
      createOutline(model, color, scale);
    });

    setTimeout(() => {
      pulsingModels.forEach(name => {
        const model = modelRefs[name];
        if (!model) return;
        removeOutline(model);
      });
    }, 1000); // 💡 Outline stays on for 1s

  }, 4000); // ⏱️ Run every 4s
}

function stopAutoOutlinePulse() {
  clearInterval(pulseInterval);
  pulseInterval = null;
  pulsingModels.forEach(name => {
    const model = modelRefs[name];
    if (model) removeOutline(model);
  });
}

function disableAllLightAndGlow(modelName) {
  const model = modelRefs[modelName];
  if (!model) return;

  model.traverse(child => {
    if (child.isLight) {
      if (!('originalIntensity' in child.userData)) {
        child.userData.originalIntensity = child.intensity;
      }
      child.intensity = 0;
    }

    if (child.isMesh && child.material && 'emissive' in child.material) {
      if (!('originalEmissive' in child.userData)) {
        child.userData.originalEmissive = child.material.emissive.clone();
      }
      if (!('originalEmissiveIntensity' in child.userData)) {
        child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
      }

      child.material.emissive.setRGB(0, 0, 0);
      child.material.emissiveIntensity = 0;
    }
  });
}


function restoreAllLightAndGlow(modelName) {
  const model = modelRefs[modelName];
  if (!model) return;

  model.traverse(child => {
    if (child.isLight) {
      child.intensity = child.userData.originalIntensity ?? 1; // default to 1 if not stored
    }

    if (child.isMesh && child.material && 'emissive' in child.material) {
      const original = child.userData.originalEmissive ?? new THREE.Color(0x000000);
      const intensity = child.userData.originalEmissiveIntensity ?? 1;
      child.material.emissive.copy(original);
      child.material.emissiveIntensity = intensity;
    }
  });
}


// === SFX List ===
const sfxFiles = {
  backopen: '/audio/sfx_backopen.mp3',
  backfull: '/audio/sfx_backfull.mp3',
  hoodopen: '/audio/sfx_hoodopen.mp3',
  hoodclose: '/audio/sfx_hoodclose.mp3',
  hoodfull: '/audio/sfx_hoodall.mp3',
  gensound: '/audio/sfx_prox_generator.mp3',
  table: '/audio/sfx_table.mp3',
  menu: '/audio/sfx_menu.mp3',
  swoosh: '/audio/sfx_swoosh.mp3',
  right1: '/audio/sfx_right1.mp3',
  ON: '/audio/sfx_on.mp3',
  OFF: '/audio/sfx_off.mp3',
  core: '/audio/sfx_core.mp3',
  robotsfx: '/audio/sfx_robot.mp3',
  BGM: '/audio/bgm_web.mp3'
};

Object.entries(sfxFiles).forEach(([name, path]) => {
  loadSFX(name, path);
});

const waitForHood = setInterval(() => {
  if (modelRefs['hood']) {
    clearInterval(waitForHood);
    console.log('✅ Hood model loaded. Ready for animation.');
  }
}, 100);


const originalProximityValues = {};
const proximitySounds = [
  {
    position: new THREE.Vector3(
    -0.70647, 0.04338, 2.0774
    ),
    sound: 'gensound',
    radius: 5,
    minDist: 3,
    maxVol: .4,
    triggered: true,
  name: 'generator',
  enabled: true  
  },
  {
    position: new THREE.Vector3(
    -1.54716, 0.71864, 0.380925
    ),
    sound: 'robotsfx',
    radius: 5,
    minDist: 2,
    maxVol: 1,
    triggered: true,
  name: 'robot',
  enabled: true  
  },
 {
  position: new THREE.Vector3(0.78964, -0.31310, 1.55398),
  sound: 'BGM',
  radius: 20,
  minDist: 6,
  maxVol: .5,
  triggered: true,
  name: 'speaker',
  enabled: true  
},
    {
    position: new THREE.Vector3(
    2.02544, 0.27704, -0.31851
    ),
    sound: 'core',
    radius: 2.5,
    minDist: 0,
    maxVol: .5,
    triggered: true
  }
];

window.logWorldPos = (model, mesh) => {
  const obj = modelRefs[model]?.getObjectByName(mesh);
  if (obj) {
    const pos = new THREE.Vector3();
    obj.getWorldPosition(pos);
    console.log(`🌍 ${model}/${mesh} world pos:`, pos.toArray());
  } else {
    console.warn('❌ mesh not found');
  }
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    resetSceneState();
  }

  if (e.key === 'l' || e.key === 'L') {
    logFocusPosition();
  }
  
});

document.getElementById('reset-btn')?.addEventListener('click', resetSceneState);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastHoveredHitbox = null;

const hitboxAnimationState = {
  cable: false // false = off, true = on
};

function hideUntilRemoved(modelNameA, modelNameB) {
  const modelA = modelRefs[modelNameA];
  const modelB = modelRefs[modelNameB];

  if (!modelA || !modelB) {
    console.warn('❌ One or both models not found');
    return;
  }

  visibilityLock[modelNameA] = true; // 🔒 Lock visibility
  modelA.visible = false;

  const checkInterval = setInterval(() => {
    if (!modelB.parent) {
      clearInterval(checkInterval);
      visibilityLock[modelNameA] = false; // 🔓 Unlock
      modelA.visible = true;
      console.log(`👁️ ${modelNameA} is now visible after ${modelNameB} was removed`);
    }
  }, 100);
}

function playLoopingAnimation(modelName) {
  const model = modelRefs[modelName];
  const clips = model?.userData?.clips;
  if (!model || !clips?.length) return;

  const speed = animationSpeeds[modelName] || 1.0;
  const mixer = model.userData.mixer || new THREE.AnimationMixer(model);
  model.userData.mixer = mixer;

  const action = mixer.clipAction(clips[0]);
  action.setLoop(THREE.LoopPingPong);
  action.timeScale = speed; // ✅ Use custom speed
  action.clampWhenFinished = false;
  action.reset().play();

  model.userData.action = action;

  console.log(`▶️ Playing ${modelName} @ ${speed}x`);
}

function stopLoopingAnimation(modelName) {
  const action = modelRefs[modelName]?.userData?.action;
  if (action) {
    action.stop();
    console.log(`⏹️ Stopped ${modelName}`);
  }
}

function toggleEntityState(entityName, forceState = null) {
  const entry = proximitySounds.find(p => p.name === entityName);
  const sfxName = entry?.sound;
  const sfx = sfxMap[sfxName];
  const model = modelRefs[entityName];

  if (!entry || !sfx || !model) {
    console.warn(`⚠️ Entity "${entityName}" not found or incomplete.`);
    return;
  }

  const actuallyPlaying = sfx.isPlaying || model.userData?.action?.isRunning();

  // If no explicit value passed, toggle based on current state
  const shouldBeOn = forceState !== null ? forceState : !actuallyPlaying;

  toggleState[entityName] = shouldBeOn;

  if (shouldBeOn) {
    console.log(`🔊 ${entityName} ON`);
    playLoopingAnimation(entityName);
    enableProximitySound(entityName);

    if (originalProximityValues[entityName]) {
      entry.radius = originalProximityValues[entityName].radius;
      entry.minDist = originalProximityValues[entityName].minDist;
    }

    if (sfx && sfx.buffer) {
      sfx.setVolume(entry.maxVol ?? 1.0); // restore volume
    }
  } else {
    console.log(`🔇 ${entityName} OFF`);
    stopLoopingAnimation(entityName);
    disableProximitySound(entityName);

    if (!originalProximityValues[entityName]) {
      originalProximityValues[entityName] = {
        radius: entry.radius,
        minDist: entry.minDist
      };
    }

    entry.radius = 0.1;
    entry.minDist = 0;

    if (sfx?.isPlaying) {
      sfx.setVolume(0); // mute but don't stop
    }
  }
}


function enableProximitySound(name) {
  const entry = proximitySounds.find(p => p.name === name);
  if (entry) {
    entry.enabled = true;
    console.log(`🔊 Sound "${name}" enabled`);
  }
}

function disableProximitySound(name) {
  const entry = proximitySounds.find(p => p.name === name);
  if (!entry) return;

  entry.enabled = false;

  // Instead of stopping sound, mute it
  const sfx = sfxMap[entry.sound];
  if (sfx?.isPlaying) {
    sfx.setVolume(0); // 🔇 Mute but don't stop to avoid reset
    console.log(`🔇 Muted "${entry.sound}"`);
  }
}

function activateEntity(entityName) {
  const model = modelRefs[entityName];
  const entry = proximitySounds.find(p => p.name === entityName);

  if (model && model.userData?.clips?.length > 0) {
    playLoopingAnimation(entityName);
  }

  if (entry) {
    entry.enabled = true;
    if (originalProximityValues[entityName]) {
      entry.radius = originalProximityValues[entityName].radius;
      entry.minDist = originalProximityValues[entityName].minDist;
    }
    console.log(`✅ Activated: ${entityName}`);
  }
}

function deactivateEntity(entityName) {
  const model = modelRefs[entityName];
  const entry = proximitySounds.find(p => p.name === entityName);

  if (model) {
    stopLoopingAnimation(entityName);
  }

  if (entry) {
    // Cache original if not saved yet
    if (!originalProximityValues[entityName]) {
      originalProximityValues[entityName] = {
        radius: entry.radius,
        minDist: entry.minDist
      };
    }

    entry.enabled = false;
    entry.radius = 0.1;
    entry.minDist = 0;

    const sfx = sfxMap[entry.sound];
    if (sfx && sfx.isPlaying) {
      sfx.setVolume(0); // mute without stopping
    }

    console.log(`🚫 Deactivated: ${entityName}`);
  }
}


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

  // Stop previous action
  if (model.userData.action) {
    model.userData.action.stop();
  }

  action.reset();
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.timeScale = speed * direction;
  action.play();

  // Cache mixer/action/clip
  model.userData.mixer = mixer;
  model.userData.action = action;
  model.userData.clip = clip;

  console.log(`🎞️ Playing "${clipName}" on "${modelName}" dir: ${direction} speed: ${speed}`);
}

function playModelClipOnce(modelName, clipName, speed = 1) {
  const model = modelRefs[modelName];
  if (!model || !model.userData.clips) return;

  const clip = model.userData.clips.find(c => c.name === clipName);
  if (!clip) {
    console.warn(`❌ Clip "${clipName}" not found on "${modelName}"`);
    return;
  }

  const mixer = model.userData.mixer || new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);

  if (model.userData.action) {
    model.userData.action.stop();
  }

  action.reset();
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.timeScale = speed;
  action.play();

  model.userData.mixer = mixer;
  model.userData.action = action;
  model.userData.clip = clip;

  console.log(`🎬 Playing "${clipName}" once on "${modelName}"`);
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
    if (lastHoveredHitbox === 'hitbox_back' && !backHoverLocked) {
      playModelClip('back', 'nla_backclose', 1);
        playSFX('backopen');
    }
    if (lastHoveredHitbox === 'hitbox_hood' && !hoodHoverLocked) {
      playHoodClip('nla_hoodClose', 5);
      playSFX('hoodclose');
    }
    if (lastHoveredHitbox === 'hitbox_table') {
      Promise.all([
  playModelClip('table', 'nla_tableback', 1),
  playModelClip('tablefont', 'nla_tablerear', 1)
]);
playSFX('table');
    }

    // 🛑 Stop icon animations
    const stopAnim = (modelName) => {
      const model = modelRefs[modelName];
      if (!model?.userData?.mixer) return;
      model.userData.mixer.stopAllAction();
      console.log(`🛑 Stopped animations on ${modelName}`);
    };

    switch (lastHoveredHitbox) {
      case 'hitbox_reel':
        stopAnim('icon_reel');
            break;
      case 'hitbox_vr':
        stopAnim('icon_vr');
                break;
      case 'hitbox_app':
        stopAnim('icon_app');
        break;
      case 'hitbox_immersive':
        stopAnim('icon_immersive');
                break;
    }
  }

  // === Hover in ===
  if (newHoveredHitbox) {
    console.log(`👀 Hover in: ${newHoveredHitbox}`);

    if (newHoveredHitbox === 'hitbox_hood' && !hoodHoverLocked) {
      playHoodClip('nla_hoodOpen', 5);
      playSFX('hoodopen');
    }
    if (newHoveredHitbox === 'hitbox_back' && !backHoverLocked) {
      playModelClip('back', 'nla_backopen', 1);
      playSFX('backopen');
      hasHoveredBack = true;
    }
    if (newHoveredHitbox === 'hitbox_table') {
      Promise.all([
  playModelClip('table', 'nla_table', 1),
  playModelClip('tablefont', 'nla_tablefront', 1)
]);
playSFX('table');
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
  case 'hitbox_reel':
    playAnim('icon_reel', 'nla_iconreel', 0.5);
        break;
  case 'hitbox_vr':
    playAnim('icon_vr', 'nla_iconvr', 0.5);
       break;
  case 'hitbox_app':
    playAnim('icon_app', 'nla_iconapp', 0.4);
      break;
  case 'hitbox_immersive':
    playAnim('icon_immersive', 'nla_iconim', 0.5);
     break;
}


  }

  lastHoveredHitbox = newHoveredHitbox;
}



if (captionMap[newHoveredHitbox]) {
  captionEl.innerHTML = captionMap[newHoveredHitbox];
  captionEl.style.display = 'block';
 captionEl.style.left = `${e.clientX + 36}px`;
captionEl.style.top = `${e.clientY + 5}px`;
cursor.classList.add('pointer');


} else {
  cursor.classList.remove('pointer');

  captionEl.style.display = 'none';
}
  document.body.style.cursor = newHoveredHitbox ? 'pointer' : 'default';
}

function onClick(e) {
  if (inputLocked) return;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (!intersects.length) return;

  let obj = intersects[0].object;
  while (obj.parent && obj.parent !== scene) obj = obj.parent;

  if (obj.name?.startsWith('hitbox_')) {
    handleHitboxClick(obj);
    const disableBtnOn = ['hitbox_menu', 'hitbox_guide', 'hitbox_back', 'hitbox_hood'];
if (disableBtnOn.includes(obj.name)) {
  console.log(`🔒 Disabling buttons due to ${obj.name} click`);

  // disable specific buttons by ID
  document.getElementById('button_portfolio')?.classList.add('disabled');
  document.getElementById('button_show')?.classList.add('disabled');
   document.getElementById('button_contact')?.classList.add('disabled');
}

  }

// camera movement

 if (obj.name?.startsWith('hitbox_')) {

  console.log(`🖱️ Clicked: ${obj.name}`);


const mapping = hitboxMap[obj.name];
if (mapping) {
  let { cam, model, controls: controlLimits } = mapping;

  // pick correct camera
  if (typeof cam === 'object') {
    cam = isMobileDevice() ? cam.mobile : cam.desktop;
  }

  const camTarget = camTargets[cam];
  currentFocus = modelRefs['focus_cam'];

  // ⛳ Update camera zoom ranges if defined
if (controlLimits) {
  controls.minDistance = controlLimits.minDistance ?? controls.minDistance;
  controls.maxDistance = controlLimits.maxDistance ?? controls.maxDistance;

    if ('minAzimuthAngle' in controlLimits && 'maxAzimuthAngle' in controlLimits) {
    controls.minAzimuthAngle = controlLimits.minAzimuthAngle;
    controls.maxAzimuthAngle = controlLimits.maxAzimuthAngle;
  } else {
    // 🔄 Relative lock based on current azimuth
    const currentAzimuth = controls.getAzimuthalAngle();
    const delta = Math.PI / 12; // 👁️ 30 degree window

    controls.minAzimuthAngle = currentAzimuth - delta;
    controls.maxAzimuthAngle = currentAzimuth + delta;

  console.log(`🎯 Custom OrbitControl limits for ${obj.name} applied`);
}
}


  if (camTarget) {
    tweenToCamera(camTarget, model);
  } else {
    console.warn(`❌ Camera target "${cam}" not found.`);
  }
}


  // 🧹 Special logic for hood click
  if (obj.name === 'hitbox_hood') {
    if (inputLocked) return; // ⛔ prevent spamming
  inputLocked = true;
  setTimeout(() => inputLocked = false, 700);
    launchHitboxLift1();
      launchHitboxLift2();
      stopAutoOutlinePulse();
    playHoodClip('nla_hoodAction');
    playSFX('hoodfull');
    moveModelToOffsetXYZ('focus_cam', { x: 2.0016531944274902, y: 0.3605214059352875, z: -0.33794140815734863 }, 1000);
    hoodHoverLocked = true;
    controls.enabled = false;
    if (obj && obj.parent) {
  console.log(`🗑️ Removing ${obj.name} from scene`);
  obj.parent.remove(obj);
}
  }
}

if (obj.name === 'hitbox_menu') {
  launchHitboxLift1();
  stopAutoOutlinePulse();
  playSFX('menu');
  moveModelToOffsetXYZ('focus_cam', { x: -0.19776688516139984, y: 1.1592967510223389, z: -0.3411976993083954 }, 1000);
  controls.enabled = false;
  if (inputLocked) return; // ⛔ prevent spamming
  inputLocked = true;
  setTimeout(() => inputLocked = false, 700); // 🔓 unlock after buffer
  
  const DELAY_MS = 1000;
  setTimeout(() => {
    ['hitbox_app', 'hitbox_vr', 'hitbox_immersive', 'hitbox_reel'].forEach(name => {
      const hitbox = modelRefs['menu']?.getObjectByName(name);
      if (hitbox) {
        hitbox.visible = true;
        hitbox.userData.disabled = false;
      }
    });

    const menuModel = modelRefs['menu'];
    if (menuModel) {
      menuModel.visible = false;

      ['icon_app', 'icon_vr', 'icon_immersive', 'icon_reel'].forEach(iconName => {
        const icon = modelRefs[iconName];
        if (icon) icon.visible = true;
      });
    }
  }, DELAY_MS);
}

if (obj.name === 'hitbox_reel') {
  console.log('🔗 hitbox_reel clicked → Opening YouTube...');
  window.open('https://www.youtube.com/watch?v=hFs0UhpgJSE', '_blank');
  return;
}

if (obj.name === 'hitbox_cable') {
const targets = ['cart', 'lamp', 'table', 'menu', 'guide', 'logo', 'sign1', 'sign2'];

if (hitboxAnimationState.cable) {
  // OFF → ON
  setTimeout(() => {
    targets.forEach(restoreAllLightAndGlow);
}, 500);} else {
  // ON → OFF
  targets.forEach(disableAllLightAndGlow);
}


  const isOn = hitboxAnimationState.cable;
  const clipName = isOn ? 'nla_cabolon' : 'nla_caboloff';
  const sfxName = isOn ? 'ON' : 'OFF';
  const sfxDelay = isOn ? '0' : '500';

  playModelClip('generator', clipName, 1.0); // Adjust speed if needed

  
playSFX(sfxName)
  // Toggle state
  hitboxAnimationState.cable = !isOn;

  isHDREnabled = !isHDREnabled;

  if (isHDREnabled) {
     setTimeout(() => {
    scene.environment = originalEnvMap;
    scene.background = null;
    console.log('🌄 HDR enabled');
    }, 500);
  } else {
    // ☠️ Disable HDR (use null or black texture)
    if (!originalEnvMap) originalEnvMap = scene.environment;
    scene.environment = null;
    scene.background = null; // or use a solid color
    console.log('🌑 HDR disabled');
  }
  return;
}

if (obj.name === 'hitbox_immersive') {
  console.log('🔗 hitbox_immersive clicked → Opening Curio...');
  window.open('https://docs.google.com/presentation/d/1ZrNRbpl-3M6kloLYcbJJk-j9EWfL5spXpKrndXmEOxA/preview?slide=id.g34e9049caeb_0_12', '_blank');
  return;
}

if (obj.name === 'hitbox_guide') {
   launchHitboxLift1();
      launchHitboxLift2();
      launchHitboxLift3();
      stopAutoOutlinePulse();
moveModelToOffsetXYZ('focus_cam', { x: 1.25, y: 0.6, z: -1.7928889989852905 }, 1000);
   controls.enabled = false;
}

if (obj.name === 'hitbox_back') {
  if (inputLocked) return; // ⛔ prevent spamming
  inputLocked = true;
  stopAutoOutlinePulse();
  setTimeout(() => inputLocked = false, 700);
  moveHitboxY('hitbox_back', 500);
  playSFX('backfull');
  console.log('🎯 hitbox_back clicked → move new position');
playModelClip('back', 'nla_backall', 1);
   launchHitboxLift4();
      launchHitboxLift2();
      launchHitboxLift3();
moveModelToOffsetXYZ('focus_cam', { x: -2.756675672531128, y: 0.7532350611686707, z: 0 }, 1000);
controls.enabled = false;
backHoverLocked = true;
  setTimeout(() => modelRefs['icon_shoes'].visible = true, 600);
return;
}

if (obj.name === 'hitbox_engine') {
   launchHitboxLift1();
   toggleEntityState('generator', false);
toggleEntityState('robot', false);
  moveHitboxY('hitbox_engine', 500);
  if (inputLocked) return; // ⛔ prevent spamming
  inputLocked = true;
  setTimeout(() => inputLocked = false, 700);

moveModelToOffsetXYZ('focus_cam', { x: 2.0016531944274902, y: 0.3605214059352875, z: -0.36794140815734863 }, 1000); 

console.log('🔍 Isolating engine models...');

  Object.entries(modelRefs).forEach(([name, model]) => {
    if (!name.startsWith('engine_')) {
      model.visible = false;
    }
    });
controls.enabled = true;
signsSwapEnabled = false;
return;
}

if (obj.name === 'hitbox_engine1') {
  moveHitboxY('hitbox_engine1', 500);
  if (inputLocked) return; // ⛔ prevent spamming
  inputLocked = true;
  setTimeout(() => inputLocked = false, 700);

playSFX('right1');
playModelClipOnce('engine_cover', 'nla_encover', 1);
return;
}

if (obj.name === 'hitbox_engine2') {
  moveHitboxY('hitbox_engine2', 500);
  if (inputLocked) return; // ⛔ prevent spamming
  inputLocked = true;
  setTimeout(() => inputLocked = false, 700);

playSFX('right1');
playModelClipOnce('engine_base', 'nla_enbase', 1);
playModelClipOnce('engine_top', 'nla_entop', 1);
playModelClipOnce('engine_fan', 'nla_enfan', 1);
return;
}

if (obj.name === 'hitbox_engine3') {
  hideUntilRemoved('engine_core', 'engine_corebroken');
  playSFX('right1');

  const engineTargets = ['engine_corebroken', 'hitbox_engine', 'hitbox_engine1', 'hitbox_engine2', 'hitbox_engine3'];

  engineTargets.forEach(name => {
    for (const model of Object.values(modelRefs)) {
      const target = model.getObjectByName?.(name);
      if (target && target.parent) {
        console.log(`🗑️ Removing ${name} from ${model.name}`);
        target.parent.remove(target);
      }
    }
  });

  const DELAY_NS = 500;
  const DELAY_MS = 1500;
  setTimeout(() => {
playModelClipOnce('engine_base', 'nla_enbaseback', 1);
playModelClipOnce('engine_top', 'nla_entopback', 1);
setTimeout(() => {
playModelClipOnce('engine_fan', 'nla_enfanback', 1);
setTimeout(() => {
playModelClipOnce('engine_cover', 'nla_encoverback', 1);
setTimeout(() => {
  resetSceneState();
}, DELAY_MS)}, DELAY_NS)}, DELAY_NS)}, DELAY_NS);
  
return;
}

if (obj.name === 'hitbox_table') {
   stopAutoOutlinePulse();
  console.log('💬 hitbox_table clicked → Opening WhatsApp...');
  const phone = '6283820299086'; // use your full international number
  const message = encodeURIComponent('Hi! I want to get a reservation — let’s talk.');
  const url = `https://wa.me/${phone}?text=${message}`;
  window.open(url, '_blank');
  return;
}

if (obj.name === 'hitbox_speaker') {
  toggleEntityState('speaker');
  return;
}

if (obj.name === 'hitbox_shoes') {

  const shoeAnimations = {
    shoes_bot: 'nla_sbot',
    shoes_body: 'nla_sbody',
    shoes_plastic: 'nla_splastic',
    shoes_rubber: 'nla_srubber',
    shoes_carbon: 'nla_scarbon',
    shoes_sol: 'nla_ssol',
    shoes_bg: 'nono'
  };

toggleEntityState('generator', false);
toggleEntityState('robot', false);

  Object.keys(shoeAnimations).forEach(modelName => {
    const model = modelRefs[modelName];
    if (model) model.visible = true;
  });


  setTimeout(() => {
    Object.entries(shoeAnimations).forEach(([modelName, clipName]) => {
      playModelClip(modelName, clipName, 1);
    });
  }, 1000); 

  moveHitboxY('hitbox_shoes', 500);
  moveModelToOffsetXYZ('focus_cam', { x: -2.6, y: 0.68, z: 0.4 }, 200);

  controls.enabled = true;
  signsSwapEnabled = false;
  toggleShoeBackground(true);


  Object.entries(modelRefs).forEach(([name, model]) => {
    if (!name.startsWith('shoes_')) {
      model.visible = false;
    }
  });

  return;
}
}

function handleHitboxClick(obj) {
  if (!obj?.name?.startsWith('hitbox_')) return;

  console.log(`🖱️ Clicked: ${obj.name}`);

  const mapping = hitboxMap[obj.name];
  if (mapping) {
    let { cam, model, controls: controlLimits } = mapping;
    if (typeof cam === 'object') {
      cam = isMobileDevice() ? cam.mobile : cam.desktop;
    }

    const camTarget = camTargets[cam];
    currentFocus = modelRefs['focus_cam'];

    if (controlLimits) {
      controls.minDistance = controlLimits.minDistance ?? controls.minDistance;
      controls.maxDistance = controlLimits.maxDistance ?? controls.maxDistance;
      if ('minAzimuthAngle' in controlLimits && 'maxAzimuthAngle' in controlLimits) {
        controls.minAzimuthAngle = controlLimits.minAzimuthAngle;
        controls.maxAzimuthAngle = controlLimits.maxAzimuthAngle;
      } else {
        const currentAzimuth = controls.getAzimuthalAngle();
        const delta = Math.PI / 12;
        controls.minAzimuthAngle = currentAzimuth - delta;
        controls.maxAzimuthAngle = currentAzimuth + delta;
        console.log(`🎯 Custom OrbitControl limits for ${obj.name} applied`);
      }
    }

    if (camTarget) {
      tweenToCamera(camTarget, model);
    } else {
      console.warn(`❌ Camera target "${cam}" not found.`);
    }
  }

  // 🔁 Custom behavior per-hitbox (copied from your original logic)
  switch (obj.name) {
    case 'hitbox_hood':
      if (inputLocked) return;
      inputLocked = true;
      setTimeout(() => inputLocked = false, 700);
      launchHitboxLift1();
      launchHitboxLift2();
      stopAutoOutlinePulse();
      playHoodClip('nla_hoodAction');
      playSFX('hoodfull');
      moveModelToOffsetXYZ('focus_cam', {
        x: 2.0016531944274902,
        y: 0.3605214059352875,
        z: -0.33794140815734863
      }, 1000);
      hoodHoverLocked = true;
      controls.enabled = false;
      if (obj.parent) obj.parent.remove(obj);
      break;

    case 'hitbox_menu':
      launchHitboxLift1();
      stopAutoOutlinePulse();
      playSFX('menu');
      moveModelToOffsetXYZ('focus_cam', {
        x: -0.19776688516139984,
        y: 1.1592967510223389,
        z: -0.3411976993083954
      }, 1000);
      controls.enabled = false;
      if (inputLocked) return;
      inputLocked = true;
      setTimeout(() => inputLocked = false, 700);
      setTimeout(() => {
        ['hitbox_app', 'hitbox_vr', 'hitbox_immersive', 'hitbox_reel'].forEach(name => {
          const hitbox = modelRefs['menu']?.getObjectByName(name);
          if (hitbox) {
            hitbox.visible = true;
            hitbox.userData.disabled = false;
          }
        });

        const menuModel = modelRefs['menu'];
        if (menuModel) {
          menuModel.visible = false;
          ['icon_app', 'icon_vr', 'icon_immersive', 'icon_reel'].forEach(iconName => {
            const icon = modelRefs[iconName];
            if (icon) icon.visible = true;
          });
        }
      }, 1000);
      break;

 case 'hitbox_speaker':
  toggleEntityState('speaker');
  break;


    case 'hitbox_back':
      if (inputLocked) return;
      inputLocked = true;
      setTimeout(() => inputLocked = false, 700);
      moveHitboxY('hitbox_back', 500);
      playSFX('backfull');
      playModelClip('back', 'nla_backall', 1);
      launchHitboxLift4();
      launchHitboxLift2();
      launchHitboxLift3();
      moveModelToOffsetXYZ('focus_cam', {
        x: -2.756675672531128,
        y: 0.7532350611686707,
        z: 0
      }, 1000);
      controls.enabled = false;
      backHoverLocked = true;
      setTimeout(() => modelRefs['icon_shoes'].visible = true, 600);
      break;

    case 'hitbox_table':
     stopAutoOutlinePulse();
  console.log('💬 hitbox_table clicked → Opening WhatsApp...');
  const phone = '6283820299086'; // use your full international number
  const message = encodeURIComponent('Hi! I want to get a reservation — let’s talk.');
  const url = `https://wa.me/${phone}?text=${message}`;
  window.open(url, '_blank');
      break;

    //case 'hitbox_shoes':
     // toggleShoeBackground(true);
     // break;

    default:
      console.log(`ℹ️ No special logic for ${obj.name}`);
  }
}

document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const hitboxName = btn.dataset.hitbox;

    if (action === 'reset') {
      console.log('🔁 Reset button clicked via bottom bar');
      resetSceneState();

      // ✅ Re-enable buttons
      document.getElementById('button_portfolio')?.classList.remove('disabled');
      document.getElementById('button_show')?.classList.remove('disabled');
      document.getElementById('button_contact')?.classList.remove('disabled');
      return;
    }

    if (hitboxName) {
      const model = modelRefs[hitboxName];
      const hitbox = model?.getObjectByName(hitboxName);
      if (hitbox) {
        handleHitboxClick(hitbox);

        // ✅ If menu or back was clicked, disable both
        if (hitboxName === 'hitbox_menu' || hitboxName === 'hitbox_back') {
          document.getElementById('button_portfolio')?.classList.add('disabled');
          document.getElementById('button_show')?.classList.add('disabled');
           document.getElementById('button_contact')?.classList.add('disabled');
        }
      } else {
        console.warn(`⚠️ Button target "${hitboxName}" not found.`);
      }
    }
  });
});





/// ====click end======
 
window.addEventListener('mousemove', onMouseMove);

let lastClickTime = 0;

function onClickWithThrottle(e) {
  const now = Date.now();
  if (now - lastClickTime < 250) return;
  lastClickTime = now;

  // 💉 Always inject fresh mouse coords
  if (e && e.clientX !== undefined && e.clientY !== undefined) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  onClick(e); // 🔁 propagate
}

window.addEventListener('mousedown', onClickWithThrottle);
window.addEventListener('touchstart', (e) => {
  e.preventDefault(); 
  const touch = e.touches[0];
  mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  onClickWithThrottle(e);
});


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function setupProximitySound(modelName, soundName, minDist = 4, maxDist = 8, maxVol = 0.75) {
  proximitySounds.push({
    name: modelName,
    sound: soundName,
    radius: maxDist,
    minDist,
    maxVol,
    triggered: true
  });
}

setupProximitySound('generator_cube016', 'generator');
setupProximitySound('hitbox_engine3_hitbox_engine003', 'generator');

function getVolumeByDistance(distance, min = 20, max = 30, maxVol = 1) {
  if (distance <= min) return maxVol;
  if (distance >= max) return 0;
  return maxVol * (1 - (distance - min) / (max - min));
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controls.update();
  tweenGroup.update();

  

  if (hoodAnim.mixer) hoodAnim.mixer.update(delta);

 proximitySounds.forEach(entry => {
  const sfx = sfxMap[entry.sound];
  if (!sfx || !sfx.buffer) return;

  const soundPos = entry.position ?? (() => {
    let model = modelRefs[entry.name];
    if (!model) {
      for (const ref of Object.values(modelRefs)) {
        const mesh = ref.getObjectByName?.(entry.name);
        if (mesh) return mesh;
      }
      return null;
    }
    return model;
  })();

  if (!soundPos) return;

  const soundWorldPos = soundPos.isVector3 ? soundPos : new THREE.Vector3().setFromMatrixPosition(soundPos.matrixWorld);
  const cameraPos = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);

  const distance = soundWorldPos.distanceTo(cameraPos);
  const volume = getVolumeByDistance(distance, entry.minDist ?? 1, entry.radius, entry.maxVol ?? 0.75);

  sfx.setVolume(volume);

  if (volume > 0 && !sfx.isPlaying) {
    sfx.play();
  }
  if (volume === 0 && sfx.isPlaying) {
    sfx.stop();
  }
});



  // animation list

['generator', 'lamp', 'back', 'table', 'tablefont', 'menu', 'focus_cam', 'robot', 'robot1', 'robot2',
  'icon_app', 'icon_vr', 'icon_reel', 'icon_immersive', 'person', 'guide', 'speaker', 'shoes', 'icon_shoes',
  'engine_corebroken', 'engine_core', 'engine_top', 'engine_cover', 'engine_fan', 'engine_base',
  'shoes_bot', 'shoes_body', 'shoes_plastic', 'shoes_rubber', 'shoes_carbon', 'shoes_sol'
].forEach(name => {
  const model = modelRefs[name];
  const mixer = model?.userData?.mixer;
  if (mixer) mixer.update(delta);
});


  swapTimer += delta;
 if (signsSwapEnabled && swapTimer >= 1 && modelRefs['sign1'] && modelRefs['sign2']) {
  swapTimer = 0;
  const v = modelRefs['sign1'].visible;
  modelRefs['sign1'].visible = !v;
  modelRefs['sign2'].visible = v;
}


if (currentFocus) {
  const pos = new THREE.Vector3();
  currentFocus.getWorldPosition(pos);
  controls.target.copy(pos); 
}
updateDebugMarker(); 
renderer.render(scene, camera);
}

animate();