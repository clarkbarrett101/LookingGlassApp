import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CameraUtils from "three/examples/jsm/utils/CameraUtils.js";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs-core";
///await tf.setBackend("webgl");
import * as WebGL from "@tensorflow/tfjs-backend-webgl";

let house;
const houseLoader = new GLTFLoader();

houseLoader.load("simple_house_-_kitchen.glb", function (houseModel) {
  house = houseModel.scene;
  house.position.set(3, -9.5, -5);
  house.rotateY(-Math.PI / 6);
  house.scale.set(2.4, 2.4, 2.4);
  houseModel.scene.traverse((child) => {
    if (child.isMesh) {
      child.material.fog = false;
    }
  });
  scene.add(houseModel.scene);
});
const cubeLoader = new GLTFLoader();
cubeLoader.load("funnel.glb", function (cubeModel) {
  cubeModel.scene.position.set(0, -0, -20);
  cubeModel.scene.scale.set(0.67, 0.25, 0.5);
  cubeModel.scene.rotateX(Math.PI / 2);
  cubeModel.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  scene.add(cubeModel.scene);
});

let motionSet = false;
let gyro = new THREE.Vector3(0, 0, 0);
addEventListener("click", (event) => {
  if (!motionSet) {
    motionSet = true;
    console.log("checking permission");
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      console.log("requesting permission");
      DeviceMotionEvent.requestPermission().then((response) => {
        if (response == "granted") {
          console.log("permission granted");
          startMotion();
        }
      });
    } else {
      console.log("no permission needed");
      startMotion();
    }
    if (!motionSet) {
      motionSet = true;
      console.log("checking permission");
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        console.log("requesting permission");
        DeviceMotionEvent.requestPermission().then((response) => {
          if (response == "granted") {
            console.log("permission granted");
            startMotion();
          }
        });
      } else {
        console.log("no permission needed");
        startMotion();
      }
    }
  }
});
let forwardVector = new THREE.Vector3(0, 0, 1);
let downVector = new THREE.Vector3(0, 0, 0);
function startMotion() {
  console.log("starting motion");
  window.addEventListener("devicemotion", (event) => {
    gyro.position.x += event.acceleration.x / 9.8;
    gyro.position.y += event.acceleration.y / 9.8;
    gyro.position.z += event.acceleration.z / 9.8;
    downVector = new THREE.Vector3(
      event.accelerationIncludingGravity.x / 9.8,
      event.accelerationIncludingGravity.y / 9.8,
      event.accelerationIncludingGravity.z / 9.8
    );
  });
}

let detector;
let nose = new THREE.Vector3(0, 0, 0);
let cameraTargetPosition = new THREE.Vector3(0, 0, 0);
let xModifier = screen.width / 100;
let yModifier = screen.height / 100;
let blCorner = new THREE.Vector3(-xModifier / 2, -yModifier / 2, 0);
let blOffset = new THREE.Vector3(-xModifier / 2, -yModifier / 2, 0);
let brCorner = new THREE.Vector3(xModifier / 2, -yModifier / 2, 0);
let brOffset = new THREE.Vector3(xModifier / 2, -yModifier / 2, 0);
let tlCorner = new THREE.Vector3(-xModifier / 2, yModifier / 2, 0);
let tlOffset = new THREE.Vector3(-xModifier / 2, yModifier / 2, 0);
const canvas = document.getElementById("canvas");
const webcam = document.getElementById("webcam");
const ctx = canvas.getContext("2d");

function getFaceCoordinates(poses) {
  if (poses.length == 0) return;
  const keyNose = poses[0].keypoints[0];
  if (keyNose.score < 0.5) return;
  nose.x = (webcam.width / 2 - keyNose.x) / webcam.width;
  nose.y = (webcam.height / 2 - keyNose.y) / webcam.height;
  if (poses[0].keypoints[2].score > 0.5 && poses[0].keypoints[5].score > 0.5) {
    const length =
      2 *
      Math.sqrt(
        Math.pow(poses[0].keypoints[2].x - poses[0].keypoints[5].x, 2) +
          Math.pow(poses[0].keypoints[2].y - poses[0].keypoints[5].y, 2)
      );
    nose.z = (webcam.width / length + nose.z * 5) / 6;
  }
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 0, 50);
scene.background = new THREE.Color(0x00000);
const camera = new THREE.PerspectiveCamera(
  45,
  (window.innerWidth - 20) / (window.innerHeight - 20),
  0.1,
  135
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth - 20, window.innerHeight - 20);
document.body.appendChild(renderer.domElement);
camera.lookAt(0, 0, 0);

async function animate() {
  ctx.drawImage(webcam, 0, 0, webcam.width, webcam.height);
  const estimationConfig = { flipHorizontal: true };
  const timestamp = performance.now();
  const poses = await detector?.estimatePoses(
    canvas,
    estimationConfig,
    timestamp
  );
  if (poses) getFaceCoordinates(poses);
  UpdateCameraSetings();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

function UpdateCameraSetings() {
  let normVector = gyro
    .clone()
    .normalize()
    .multiplyScalar(nose.z * 5);
  blCorner = normVector.clone().add(blOffset);
  brCorner = normVector.clone().add(brOffset);
  tlCorner = normVector.clone().add(tlOffset);
  cameraTargetPosition = new THREE.Vector3(
    nose.x * nose.z * 2,
    nose.y * nose.z,
    nose.z * 5
  );
  // scene.fog = new THREE.Fog(0x000000, nose.z * 5, nose.z * 5 + 15);
  camera.position.lerp(cameraTargetPosition, 0.5);
  CameraUtils.frameCorners(camera, blCorner, brCorner, tlCorner, true);
}

//Webcam Setup
const setupCamera = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
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
setup();
//Post Processing
