// Try without draco support - read the GLB as raw JSON via gltf-transform
// (we'll catch the Draco part and inspect what we can).
import { readFile } from 'node:fs/promises';

// GLB binary format: magic(4) + version(4) + length(4) + JSON chunk + optional BIN chunk
const buffer = await readFile('./public/models/f1-2022-draco.glb');
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

// Verify GLB magic
const magic = view.getUint32(0, true);
if (magic !== 0x46546c67) {
  throw new Error('Not a GLB file');
}
const version = view.getUint32(4, true);
console.log(`GLB version: ${version}`);

let offset = 12;
let jsonChunk = null;
let binChunk = null;
while (offset < buffer.byteLength) {
  const chunkLen = view.getUint32(offset, true);
  const chunkType = view.getUint32(offset + 4, true);
  if (chunkType === 0x4e4f534a) {
    // JSON
    const text = new TextDecoder().decode(buffer.slice(offset + 8, offset + 8 + chunkLen));
    jsonChunk = JSON.parse(text);
  } else if (chunkType === 0x004e4942) {
    // BIN
    binChunk = buffer.slice(offset + 8, offset + 8 + chunkLen);
  }
  offset += 8 + chunkLen + (chunkLen % 4); // padded to 4
}

if (!jsonChunk) throw new Error('No JSON chunk');

// Material info
const matByIdx = new Map();
jsonChunk.materials?.forEach((m, i) => matByIdx.set(i, m));

// Build mesh → material index mapping
const meshMats = new Map();
(jsonChunk.meshes || []).forEach((mesh, meshIdx) => {
  const matIdx = (mesh.primitives || []).map((p) => p.material);
  meshMats.set(jsonChunk.nodes?.[meshIdx]?.name ?? `Mesh ${meshIdx}`, matIdx);
});

// Aggregate
const matUsage = new Map();
for (const [meshName, matIdxs] of meshMats.entries()) {
  for (const idx of matIdxs) {
    if (idx === undefined || idx === null) continue;
    if (!matUsage.has(idx)) matUsage.set(idx, { meshes: new Set(), totalVerts: 0 });
    const entry = matUsage.get(idx);
    entry.meshes.add(meshName);
  }
}

// Count verts per mesh
(jsonChunk.meshes || []).forEach((mesh, meshIdx) => {
  for (const prim of (mesh.primitives || [])) {
    const idx = prim.material;
    if (idx === undefined || idx === null) continue;
    const entry = matUsage.get(idx);
    if (!entry) continue;
    const posAccessor = jsonChunk.accessors?.[prim.attributes?.POSITION];
    if (posAccessor) entry.totalVerts += posAccessor.count || 0;
  }
});

console.log(`\n=== ${(jsonChunk.materials || []).length} MATERIALS ===\n`);
for (let i = 0; i < (jsonChunk.materials || []).length; i++) {
  const m = jsonChunk.materials[i];
  const usage = matUsage.get(i) || { meshes: new Set(), totalVerts: 0 };
  const color = m.pbrMetallicRoughness?.baseColorFactor;
  const metalness = m.pbrMetallicRoughness?.metallicFactor;
  const roughness = m.pbrMetallicRoughness?.roughnessFactor;
  const colorHex = color ? '#' + color.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('') : null;
  const meshList = [...usage.meshes].slice(0, 6).join(', ');
  console.log(`[${i}] "${m.name || '(unnamed)'}"  baseColor=${colorHex}  metal=${metalness}  rough=${roughness}`);
  console.log(`    meshes=${usage.meshes.size}  verts=${usage.totalVerts}`);
  console.log(`    e.g. ${meshList}${usage.meshes.size > 6 ? '...' : ''}`);
}
