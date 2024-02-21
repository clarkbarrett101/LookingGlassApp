import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as tf from "@tensorflow/tfjs-core";
await tf.setBackend("webgl");
import "@tensorflow/tfjs-backend-webgl";
import * as CameraUtils from "three/addons/utils/CameraUtils.js";
import * as depthEstimation from "@tensorflow-models/depth-estimation";
let xModifier = screen.width / 100;
let yModifier = screen.height / 100;
let blCorner = new THREE.Vector3(-xModifier / 2, -yModifier / 2, 0);
let brCorner = new THREE.Vector3(xModifier / 2, -yModifier / 2, 0);
let tlCorner = new THREE.Vector3(-xModifier / 2, yModifier / 2, 0);
const bigCanvas = new OffscreenCanvas(640, 480);
const smallCanvas = new OffscreenCanvas(64, 48);
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const webcam = document.getElementById("webcam");
const sctx = smallCanvas.getContext("2d");
const bctx = bigCanvas.getContext("2d");
bigCanvas.willReadFrequently = true;
smallCanvas.willReadFrequently = true;
bigCanvas.imageSmoothingEnabled = false;

function resizeCanvas() {
  smallCanvas.width = webcam.width / 10;
  smallCanvas.height = webcam.height / 10;
  bigCanvas.width = webcam.width;
  bigCanvas.height = webcam.height;
  bctx.drawImage(webcam, 0, 0, webcam.width, webcam.height);
  bctx.scale(0.1, 0.1);
  sctx.drawImage(bigCanvas, 0, 0, smallCanvas.width, smallCanvas.height);
}

const setupCamera = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      "Browser API navigator.mediaDevices.getUserMedia not available"
    );
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
    },
  });
  webcam.srcObject = stream;

  return new Promise(
    (resolve) => (webcam.onloadedmetadata = () => resolve(webcam))
  );
};
let estimator;
const setup = async () => {
  const depthmodel = depthEstimation.SupportedModels.ARPortraitDepth;
  const estimatorConfig = {
    outputDepthRange: [0, 1],
  };
  estimator = await depthEstimation.createEstimator(
    depthmodel,
    estimatorConfig
  );
  console.log(estimator);
  const video = await setupCamera();
  video.play();
  return video;
};
let nose = { x: 0, y: 0, z: 0 };
async function getFaceCoordinates(depthMap) {
  const depthArray = await depthMap.toArray();
  let x = 0;
  let y = 0;
  for (let i = 0; i < depthArray.length; i++) {
    for (let j = 0; j < depthArray[0].length; j++) {
      let depth = depthArray[i][j];
      if (depth == 0) depth = 1;
      depth = 1 - depth;
      ctx.fillStyle = `rgb(${depth ** 2 * 255},${depth ** 2 * 255},${
        depth ** 2 * 255
      })`;
      ctx.fillRect(j * 10, i * 10, 10, 10);
      if (depth > depthArray[x][y]) {
        x = i;
        y = j;
      }
    }
  }
  console.log(x, y);
  ctx.fillStyle = "red";
  ctx.fillRect(x * 10, y * 10, 30, 30);
}
setup();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
scene.fog = new THREE.Fog(0xfffefe, 5, 40);
const camera = new THREE.PerspectiveCamera(
  45,
  (window.innerWidth - 20) / (window.innerHeight - 20),
  0.1,
  135
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth - 20, window.innerHeight - 20);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;
camera.lookAt(0, 0, 0);
let house;
const houseLoader = new GLTFLoader();
houseLoader.load("simple_house_-_kitchen.glb", function (houseModel) {
  house = houseModel.scene;
  house.position.set(3, -8, 0);
  house.rotateY(-Math.PI / 6);
  house.scale.set(2, 2, 2);
  scene.add(houseModel.scene);
});
const geometry = new THREE.BoxGeometry(16, 9, 10);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
cube.position.set(0, 0, 0);

let cameraTargetPosition = camera.position.clone();

async function animate() {
  if (webcam) resizeCanvas();
  const estimatorConfig = {
    minDepth: 0,
    maxDepth: 1,
  };
  const depthMap = await estimator?.estimateDepth(
    sctx.getImageData(0, 0, smallCanvas.width, smallCanvas.height),
    estimatorConfig
  );
  if (depthMap) getFaceCoordinates(depthMap);
  // UpdateCameraSetings();
  // renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

function UpdateCameraSetings() {
  cameraTargetPosition = new THREE.Vector3(nose.x, nose.y, nose.z);
  camera.position.lerp(cameraTargetPosition, 0.5);
  CameraUtils.frameCorners(camera, blCorner, brCorner, tlCorner, false);
}
//Post Processing
