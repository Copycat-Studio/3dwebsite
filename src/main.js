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
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 🔒 Limit vertical (X-axis) camera rotation
controls.minPolarAngle = Math.PI / 3;  // ~60° from top
controls.maxPolarAngle = Math.PI / 2;  // max: flat/horizontal

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

// === Model Switching ===
const loader = new GLTFLoader();
let currentModel = null;

const modelFiles = ['models/scene1.glb', 'models/scene2.glb'];
let currentIndex = 0;

function loadModel(filePath) {
  loader.load(
    filePath,
    (gltf) => {
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
    },
    undefined,
    (error) => {
      console.error('❌ Error loading model:', error);
    }
  );
}

// Initial load
loadModel(modelFiles[currentIndex]);

// Swap model every 1 second
setInterval(() => {
  currentIndex = (currentIndex + 1) % modelFiles.length;
  loadModel(modelFiles[currentIndex]);
}, 1000);

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
  renderer.render(scene, camera);
}
animate();
