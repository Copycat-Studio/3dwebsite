import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// === Scene Setup ===
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.5, 4);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
renderer.shadowMap.enabled = true;  // Enable shadow maps
renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // Use soft shadows for smoother effect
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2;

// === Lighting Setup ===
// Ambient light with intensity 0.5
const ambientLight = new THREE.AmbientLight(0xffffff, 3); // Set intensity to 0.5
scene.add(ambientLight);

// Add a point light that casts shadows
const pointLight = new THREE.PointLight(0xffffff, 2, 100);
pointLight.position.set(5, 5, 5);
pointLight.castShadow = true;  // Enable shadow casting for this light
scene.add(pointLight);

// Optionally, add a helper to see the light position (useful for debugging)
const pointLightHelper = new THREE.PointLightHelper(pointLight, 1);
scene.add(pointLightHelper);

// === Load Model ===
const loader = new GLTFLoader();
let currentModel = null;
let morphMeshes = [];

function loadModel(filePath) {
  loader.load(
    filePath,
    (gltf) => {
      // Remove and dispose old model
      if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }

      currentModel = gltf.scene;
      scene.add(currentModel);

      // Collect all meshes with morph targets
      morphMeshes = [];
      currentModel.traverse((child) => {
        if (child.isMesh && child.morphTargetInfluences) {
          morphMeshes.push(child);
          child.castShadow = true;  // Enable shadow casting for each mesh
          child.receiveShadow = true;  // Enable shadow receiving for each mesh
        }
      });
    },
    undefined,
    (error) => {
      console.error('❌ Error loading model:', error);
    }
  );
}

// ✅ Load only scene1
loadModel('/models/scene1.glb');

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Animate Morph Targets ===
let clock = new THREE.Clock();
let morphTime = 0;
const morphDuration = 2; // seconds

function animateMorphTargets(deltaTime) {
  morphTime += deltaTime;

  morphMeshes.forEach((mesh) => {
    const count = mesh.morphTargetInfluences.length;
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const phase = (morphTime + i * 0.2) * (Math.PI * 2 / morphDuration);
      const influence = (Math.sin(phase) + 1) / 2;
      mesh.morphTargetInfluences[i] = influence;
    }
  });
}

// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  controls.update();

  if (morphMeshes.length > 0) {
    animateMorphTargets(delta);
  }

  renderer.render(scene, camera);
}
animate();
