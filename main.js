import * as THREE from "three";
import {
  BokehShader,
  BokehDepthShader,
} from "three/addons/shaders/BokehShader2.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs-core";
await tf.setBackend("webgl");
import "@tensorflow/tfjs-backend-webgl";
import * as CameraUtils from "three/addons/utils/CameraUtils.js";
import * as depthEstimation from "@tensorflow-models/depth-estimation";
let detector;
let eye_average = { x: 0, y: 0, z: 0 };
let xModifier = screen.width / 100;
let yModifier = screen.height / 100;
let blCorner = new THREE.Vector3(-xModifier / 2, -yModifier / 2, 0);
let brCorner = new THREE.Vector3(xModifier / 2, -yModifier / 2, 0);
let tlCorner = new THREE.Vector3(-xModifier / 2, yModifier / 2, 0);
const canvas = document.getElementById("canvas");
const webcam = document.getElementById("webcam");
const ctx = canvas.getContext("2d");
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
  const model = poseDetection.SupportedModels.BlazePose;
  const detectorConfig = {
    runtime: "tfjs",
    enableSmoothing: true,
    modelType: "full",
  };
  detector = await poseDetection.createDetector(model, detectorConfig);
  console.log(detector);
  const video = await setupCamera();
  video.play();
  return video;
};
let nose = { x: 0, y: 0, z: 0 };
function getFaceCoordinates(poses, depthMap) {
  if (poses.length == 0) return;
  const depthArray = depthMap.toArray();
  if (!depthArray[0]) return;
  console.log(depthArray[0]);
  const keyNose = poses[0].keypoints[0];
  nose.z =
    depthArray[Math.round(keyNose.x)][Math.round(keyNose.y)] * 16 * yModifier;
  nose.x = (2 * nose.z * (webcam.width / 2 - keyNose.x)) / webcam.width;
  nose.y = (yModifier * (webcam.height / 2 - keyNose.y)) / webcam.height;
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
material.wireframe = true;
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
cube.position.set(0, 0, 0);

let cameraTargetPosition = camera.position.clone();

async function animate() {
  ctx.drawImage(webcam, 0, 0, webcam.width, webcam.height);
  const estimationConfig = { flipHorizontal: true };
  const timestamp = performance.now();
  const poses = await detector?.estimatePoses(
    canvas,
    estimationConfig,
    timestamp
  );
  const estimatorConfig = {
    minDepth: 0,
    maxDepth: 1,
  };
  const depthMap = await estimator?.estimateDepth(canvas, estimatorConfig);
  if (poses) getFaceCoordinates(poses, depthMap);
  UpdateCameraSetings();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

function UpdateCameraSetings() {
  cameraTargetPosition = new THREE.Vector3(nose.x, nose.y, nose.z);
  camera.position.lerp(cameraTargetPosition, 0.5);
  CameraUtils.frameCorners(camera, blCorner, brCorner, tlCorner, false);
}
//Post Processing
