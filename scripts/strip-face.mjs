// Blanks face landmarks 0-10 in a saved landmark stream or session file.
// Usage: node scripts/strip-face.mjs in.json > out.json
import { readFileSync } from "node:fs";

const FACE = 11;
const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/strip-face.mjs <file.json> > <out.json>");
  process.exit(1);
}
const data = JSON.parse(readFileSync(path, "utf8"));
const stream = data.stream ?? data; // session file or bare LandmarkStream
for (const fr of stream.frames) {
  if (!fr.landmarks) continue;
  for (let i = 0; i < FACE && i < fr.landmarks.length; i++) {
    fr.landmarks[i] = { x: 0, y: 0, z: 0, visibility: 0 };
  }
}
process.stdout.write(JSON.stringify(data));
