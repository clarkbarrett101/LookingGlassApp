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
import { vec2 } from "three/examples/jsm/nodes/shadernode/ShaderNode";
let detector;
let left_eye_x;
let left_eye_y;
let right_eye_x;
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

const setup = async () => {
  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model);
  console.log(detector);
  const video = await setupCamera();
  video.play();
  return video;
};

function getFaceCoordinates(poses) {
  const leftEye = poses[0]?.keypoints.filter(
    (keypoint) => keypoint.name === "left_eye"
  )[0];
  const rightEye = poses[0]?.keypoints.filter(
    (keypoint) => keypoint.name === "right_eye"
  )[0];
  if (leftEye && leftEye.score > 0.5) {
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
    left_eye_x = leftEye.x / webcam.width;
    left_eye_y = leftEye.y / webcam.height;
  }
  if (rightEye && rightEye.score > 0.5) {
    ctx.beginPath();
    ctx.arc(rightEye.x, rightEye.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
    right_eye_x = rightEye.x / webcam.width;
  }
}
setup();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  135
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
/*
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshStandardMaterial({ color: 0x99999 });
const cubee = new THREE.Mesh(geometry, material);
cubee.castShadow = true;
cubee.rotateY(0.5);
cubee.rotateX(0.5);
const cubew = new THREE.Mesh(geometry, material);
cubew.rotateY(0.5);
cubew.rotateX(0.5);
cubew.castShadow = true;
renderer.shadowMap.enabled = true;
let light = new THREE.AmbientLight(0xffffff, 3);
light.castShadow = true;
light.position.set(0, 1, 1);
light.target = scene;
scene.add(light);
scene.add(cubee);
cubee.position.x = 1;
cubee.position.z = 1;
cubee.position.y = -1;
scene.add(cubew);
cubew.position.x = -1;
*/
let camTarget = new THREE.Vector3(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 3));
camera.position.z = 10;
camera.lookAt(0, 0, 0);

const loader = new GLTFLoader();
loader.load("reverseCube.glb", function (reverseCube) {
  reverseCube.scene.scale.set(4, 4, 4);
  reverseCube.scene.position.z = -12;
  let northClone = reverseCube.scene.clone();
  northClone.position.y = 2;
  northClone.rotateX(-Math.PI);
  let southClone = reverseCube.scene.clone();
  southClone.position.y = -2;
  let eastClone = reverseCube.scene.clone();
  eastClone.position.x = 4;
  eastClone.rotateZ(-Math.PI / 2);
  let westClone = reverseCube.scene.clone();
  westClone.position.x = -4;
  westClone.rotateZ(Math.PI / 2);
  reverseCube.scene.position.z -= 2;
  reverseCube.scene.rotateX(Math.PI / 2);
  //scene.add(northClone);
  //scene.add(southClone);
  //scene.add(eastClone);
  // scene.add(westClone);
  scene.add(reverseCube.scene);
});
let house;
const houseLoader = new GLTFLoader();
houseLoader.load("simple_house_-_kitchen.glb", function (houseModel) {
  houseModel.scene.traverse((child) => {
    if (child.isMesh) {
      child.material.depthFunc = THREE.AlwaysDepth;
    }
  });
  houseModel.scene.position.y = -3.75;
  houseModel.scene.position.z = 8;
  houseModel.scene.position.x = 1;
  houseModel.scene.scale.set(1, 1, 1);
  houseModel.scene.rotateY(-Math.PI / 6);
  camTarget = houseModel.scene.children[0].children[0].position;
  scene.add(houseModel.scene);
});

async function animate() {
  ctx.drawImage(webcam, 0, 0, webcam.width, webcam.height);
  const poses = await detector?.estimatePoses(canvas);
  if (poses) getFaceCoordinates(poses);
  UpdateCameraSetings();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
let fov = 1.0;

function UpdateCameraSetings() {
  const eyeDistance = left_eye_x ? left_eye_x - right_eye_x : 0.1;
  const cameraDistance = 10;
  camera.updateProjectionMatrix();
  fov = 2 * Math.atan(eyeDistance / (2 * cameraDistance)) * (180 / Math.PI);
  camera.fov = fov;
  console.log(fov);
  camera.position.z = cameraDistance;
  camera.position.x = left_eye_x ? 2 * -left_eye_x + 1 : 0;
  camera.position.y = left_eye_y ? 4 * -left_eye_y + 2 : 0;
  camera.lookAt(0, 0, 0);
}
//Post Processing
