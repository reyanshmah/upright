// Downloads the pose models into public/models (run once: npm run models).
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
const base = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";
const models = {
  "pose_landmarker_lite.task": `${base}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
  "pose_landmarker_full.task": `${base}/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
};
mkdirSync("public/models", { recursive: true });
for (const [name, url] of Object.entries(models)) {
  const out = `public/models/${name}`;
  if (existsSync(out)) { console.log(`have ${name}`); continue; }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`downloaded ${name}`);
}
