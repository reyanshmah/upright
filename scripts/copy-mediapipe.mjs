// Copies the MediaPipe WASM runtime into public/ so the app never depends on a CDN.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", { recursive: true });
console.log("Copied MediaPipe wasm to public/mediapipe/wasm");
