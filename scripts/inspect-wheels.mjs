/**
 * inspect-wheels.mjs
 *
 * Dump the world-space bounding box of every mesh in f1-2022-draco.glb whose
 * material name contains "tyre", "wheel", or "Wheel", plus every wheel-like
 * mesh (we don't want to rely on the material name alone — the GLB also has
 * hub / rim meshes with `null` materials). We cluster nearby wheel meshes
 * (within ~0.4 units) into a single wheel "cluster", then report each
 * cluster's combined bounding box. The F1Model.tsx WheelDetail component
 * uses those cluster centers to position its procedural rim / hub / brake
 * disc / suspension arms so they line up with the GLB's actual geometry
 * instead of the old hard-coded WHEEL_POSITIONS array.
 *
 * We use @gltf-transform/core + draco3d to decode the GLB in Node (the
 * in-browser DRACOLoader needs a Web Worker, which Node doesn't provide,
 * but gltf-transform handles decoding via the wasm decoder directly).
 *
 * Usage:  node scripts/inspect-wheels.mjs
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_PATH = path.join(__dirname, '..', 'public', 'models', 'f1-2022-draco.glb');

function fmt(arr) {
  return arr.map((n) => n.toFixed(3)).join(',');
}

async function main() {
  const decoder = await draco3d.createDecoderModule();
  const encoder = await draco3d.createEncoderModule();

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.encoder': encoder,
      'draco3d.decoder': decoder,
    });

  const doc = await io.read(GLB_PATH);
  const root = doc.getRoot();

  // Collect all unique materials with a friendly name (gltf-transform uses
  // numeric IDs for unnamed materials).
  const mats = root.listMaterials();
  const matNames = new Map();
  for (const m of mats) {
    matNames.set(m, m.getName() || `<mat#${mats.indexOf(m)}>`);
  }

  // For each mesh, compute the world-space AABB by combining every primitive's
  // accessor positions and applying the mesh/node world matrix.
  const meshes = root.listMeshes();
  const nodes = root.listNodes();
  const nodeWorld = new Map();
  // First, compute world matrices recursively.
  function computeWorld(node, parentMatrix) {
    const local = node.getMatrix(); // already a 4x4 array
    let world = local;
    if (parentMatrix) {
      // Multiply: world = parentMatrix * local
      const pm = parentMatrix;
      const lm = local;
      const out = new Array(16).fill(0);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += pm[k * 4 + j] * lm[i * 4 + k];
          out[i * 4 + j] = s;
        }
      }
      world = out;
    }
    nodeWorld.set(node, world);
    for (const child of node.listChildren()) computeWorld(child, world);
  }
  // Root scene
  const scenes = root.listScenes();
  for (const scene of scenes) {
    for (const child of scene.listChildren()) computeWorld(child, null);
  }

  // Collect all mesh entries with their computed AABBs.
  function transformPoint(matrix, x, y, z) {
    return [
      matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
      matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
      matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    ];
  }

  function inverseScale(matrix) {
    const sx = Math.hypot(matrix[0], matrix[1], matrix[2]);
    const sy = Math.hypot(matrix[4], matrix[5], matrix[6]);
    const sz = Math.hypot(matrix[8], matrix[9], matrix[10]);
    return [sx || 1, sy || 1, sz || 1];
  }

  const meshInfos = [];
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = nodeWorld.get(node);
    const invScale = inverseScale(world);

    for (const prim of mesh.listPrimitives()) {
      const posAcc = prim.getAttribute('POSITION');
      if (!posAcc) continue;
      const data = posAcc.getArray();
      const count = posAcc.getCount();
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < count; i++) {
        const x = data[i * 3];
        const y = data[i * 3 + 1];
        const z = data[i * 3 + 2];
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
      // Transform the 8 corners to world space (taking scale out so the
      // AABB stays tight under uniform-ish scaling; we then apply scale).
      const corners = [];
      for (const cx of [min[0], max[0]]) {
        for (const cy of [min[1], max[1]]) {
          for (const cz of [min[2], max[2]]) {
            const w = transformPoint(world, cx, cy, cz);
            corners.push(w);
          }
        }
      }
      const wmin = [Infinity, Infinity, Infinity];
      const wmax = [-Infinity, -Infinity, -Infinity];
      for (const c of corners) {
        for (let k = 0; k < 3; k++) {
          if (c[k] < wmin[k]) wmin[k] = c[k];
          if (c[k] > wmax[k]) wmax[k] = c[k];
        }
      }
      const center = [
        (wmin[0] + wmax[0]) / 2,
        (wmin[1] + wmax[1]) / 2,
        (wmin[2] + wmax[2]) / 2,
      ];
      const size = [wmax[0] - wmin[0], wmax[1] - wmin[1], wmax[2] - wmin[2]];
      const mat = prim.getMaterial();
      const matName = mat ? matNames.get(mat) : '<null>';
      meshInfos.push({
        node: node.getName() || `<node#${nodes.indexOf(node)}>`,
        mesh: mesh.getName() || `<mesh#${meshes.indexOf(mesh)}>`,
        material: matName,
        center,
        size,
      });
    }
  }

  console.log('─── ALL MESH PRIMITIVES (node | mesh | material | center | size) ───');
  for (const m of meshInfos) {
    console.log(
      `${m.node.padEnd(22)} | ${m.mesh.padEnd(18)} | ${m.material.padEnd(20)} | c=[${fmt(m.center)}] | s=[${fmt(m.size)}]`,
    );
  }

  // Filter wheel-like meshes by material name AND by shape heuristic
  // (round-ish: two dimensions ~equal and the third much smaller, and the
  // smallest dimension is the axle direction = x in this GLB).
  const wheelCandidates = meshInfos.filter((m) => {
    const matMatch = /(tyre|wheel|Wheel|brake|rim|hub)/i.test(m.material);
    const [sx, sy, sz] = m.size;
    // Wheels in F1 GLBs have ~equal y/z (the tyre diameter) and a much
    // smaller x (the tyre width along the axle).
    const sorted = [sx, sy, sz].sort((a, b) => a - b);
    const smallest = sorted[0];
    const largest = sorted[2];
    const shapeOk = smallest > 0 && largest / smallest > 1.4 && largest / smallest < 8;
    return matMatch || shapeOk;
  });

  console.log('\n─── WHEEL CANDIDATES (material match OR wheel-shape heuristic) ───');
  for (const m of wheelCandidates) {
    console.log(
      `${m.node.padEnd(22)} | ${m.mesh.padEnd(18)} | ${m.material.padEnd(20)} | c=[${fmt(m.center)}] | s=[${fmt(m.size)}]`,
    );
  }

  // Cluster by spatial proximity to find combined wheel bounding boxes.
  const clusters = [];
  const remaining = [...wheelCandidates];
  while (remaining.length > 0) {
    const seed = remaining.shift();
    const cluster = [seed];
    let centroid = seed.center.slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const other = remaining[i];
        const dx = other.center[0] - centroid[0];
        const dy = other.center[1] - centroid[1];
        const dz = other.center[2] - centroid[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < 0.5) {
          cluster.push(other);
          remaining.splice(i, 1);
          centroid = [0, 0, 0];
          for (const c of cluster) {
            centroid[0] += c.center[0];
            centroid[1] += c.center[1];
            centroid[2] += c.center[2];
          }
          centroid = centroid.map((v) => v / cluster.length);
          changed = true;
        }
      }
    }
    clusters.push(cluster);
  }

  console.log('\n─── CLUSTERED WHEELS (combined centroid + size, 0.5-unit radius) ───');
  clusters
    .sort((a, b) => {
      const ca = [
        a.reduce((s, m) => s + m.center[0], 0) / a.length,
        a.reduce((s, m) => s + m.center[1], 0) / a.length,
        a.reduce((s, m) => s + m.center[2], 0) / a.length,
      ];
      const cb = [
        b.reduce((s, m) => s + m.center[0], 0) / b.length,
        b.reduce((s, m) => s + m.center[1], 0) / b.length,
        b.reduce((s, m) => s + m.center[2], 0) / b.length,
      ];
      // front of the car is +z in this GLB (Blender default), so larger z first.
      return cb[2] - ca[2] || ca[0] - cb[0];
    })
    .forEach((cluster, i) => {
      // Combined AABB.
      const wmin = [Infinity, Infinity, Infinity];
      const wmax = [-Infinity, -Infinity, -Infinity];
      for (const m of cluster) {
        const c = m.center;
        const s = m.size;
        for (let k = 0; k < 3; k++) {
          const lo = c[k] - s[k] / 2;
          const hi = c[k] + s[k] / 2;
          if (lo < wmin[k]) wmin[k] = lo;
          if (hi > wmax[k]) wmax[k] = hi;
        }
      }
      const c = [
        (wmin[0] + wmax[0]) / 2,
        (wmin[1] + wmax[1]) / 2,
        (wmin[2] + wmax[2]) / 2,
      ];
      const s = [wmax[0] - wmin[0], wmax[1] - wmin[1], wmax[2] - wmin[2]];
      const meshList = cluster
        .map((m) => `${m.node}/${m.mesh}/${m.material}`)
        .join(' + ');
      console.log(
        `#${i}: c=[${fmt(c)}] s=[${fmt(s)}]   radius~${(Math.max(s[1], s[2]) / 2).toFixed(3)}   meshes=${meshList}`,
      );
    });

  // ─── The decisive step: k-means cluster the `tyre` mesh's vertices ──────────
  // The GLB exposes `tyre` as a SINGLE combined mesh covering all 4 wheels
  // (centre=[0.645,0.322,-0.313], size=[1.782,0.667,3.615]). Per-wheel positions
  // are not recoverable from material names alone — we have to cluster the
  // actual vertex positions in 3D and pick 4 wheel-sized spatial clusters.
  const tyreMat = root
    .listMaterials()
    .find((m) => m.getName() === 'tyre');
  if (tyreMat) {
    const tyrePositions = [];
    for (const node of nodes) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMaterial() !== tyreMat) continue;
        const posAcc = prim.getAttribute('POSITION');
        if (!posAcc) continue;
        const data = posAcc.getArray();
        const world = nodeWorld.get(node);
        for (let i = 0; i < posAcc.getCount(); i++) {
          const x = data[i * 3];
          const y = data[i * 3 + 1];
          const z = data[i * 3 + 2];
          const wx = world[0] * x + world[4] * y + world[8] * z + world[12];
          const wy = world[1] * x + world[5] * y + world[9] * z + world[13];
          const wz = world[2] * x + world[6] * y + world[10] * z + world[14];
          tyrePositions.push([wx, wy, wz]);
        }
      }
    }

    console.log(
      `\n─── TYRE VERTEX CLUSTERS (k-means k=4 on ${tyrePositions.length} vertices) ───`,
    );

    // Greedy far-point seeding in 3D, then 20 iterations of Lloyd's algorithm.
    const seed0 = tyrePositions[0];
    function dist3D(a, b) {
      return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    }
    function furthest(pts, ref) {
      let best = pts[0];
      let bestD = -Infinity;
      for (const p of pts) {
        const d = dist3D(p, ref);
        if (d > bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    }
    const seeds3D = [seed0, furthest(tyrePositions, seed0)];
    while (seeds3D.length < 4) {
      let best = tyrePositions[0];
      let bestD = -Infinity;
      for (const p of tyrePositions) {
        let minD = Infinity;
        for (const s of seeds3D) {
          const d = dist3D(p, s);
          if (d < minD) minD = d;
        }
        if (minD > bestD) {
          bestD = minD;
          best = p;
        }
      }
      seeds3D.push(best);
    }

    const assignments = new Array(tyrePositions.length).fill(0);
    for (let iter = 0; iter < 20; iter++) {
      for (let i = 0; i < tyrePositions.length; i++) {
        const p = tyrePositions[i];
        let best = 0;
        let bestD = Infinity;
        for (let k = 0; k < 4; k++) {
          const d = dist3D(p, seeds3D[k]);
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        assignments[i] = best;
      }
      const sums = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      for (let i = 0; i < tyrePositions.length; i++) {
        const a = assignments[i];
        sums[a][0] += tyrePositions[i][0];
        sums[a][1] += tyrePositions[i][1];
        sums[a][2] += tyrePositions[i][2];
        sums[a][3] += 1;
      }
      for (let k = 0; k < 4; k++) {
        seeds3D[k] = [
          sums[k][0] / sums[k][3],
          sums[k][1] / sums[k][3],
          sums[k][2] / sums[k][3],
        ];
      }
    }

    // AABB per cluster.
    const bbox = [
      [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
      [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
      [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
      [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
    ];
    for (let i = 0; i < tyrePositions.length; i++) {
      const a = assignments[i];
      const p = tyrePositions[i];
      const b = bbox[a];
      if (p[0] < b[0]) b[0] = p[0];
      if (p[1] < b[1]) b[1] = p[1];
      if (p[2] < b[2]) b[2] = p[2];
      if (p[0] > b[3]) b[3] = p[0];
      if (p[1] > b[4]) b[4] = p[1];
      if (p[2] > b[5]) b[5] = p[2];
    }
    const labels = ['FL', 'FR', 'RL', 'RR'];
    const rows = bbox.map((b, i) => {
      const cx = (b[0] + b[3]) / 2;
      const cy = (b[1] + b[4]) / 2;
      const cz = (b[2] + b[5]) / 2;
      const sx = b[3] - b[0];
      const sy = b[4] - b[1];
      const sz = b[5] - b[2];
      return {
        i,
        cx,
        cy,
        cz,
        sx,
        sy,
        sz,
        count: assignments.filter((a) => a === i).length,
      };
    });
    rows.sort((a, b) => b.cz - a.cz || a.cx - b.cx);

    console.log(
      '    label | center (x,y,z)            | size (x,y,z)              | radius',
    );
    console.log(
      '    ------+---------------------------+---------------------------+-------',
    );
    const out = [];
    rows.forEach((r, idx) => {
      const label = labels[idx];
      const cx = +r.cx.toFixed(3);
      const cy = +r.cy.toFixed(3);
      const cz = +r.cz.toFixed(3);
      const radius = +(Math.max(r.sy, r.sz) / 2).toFixed(3);
      const width = +r.sx.toFixed(3);
      console.log(
        `    ${label.padEnd(6)} | [${cx}, ${cy}, ${cz}]`.padEnd(40) +
          ` | w=[${r.sx.toFixed(3)}, h=[${r.sy.toFixed(3)}, d=[${r.sz.toFixed(3)}]`.padEnd(20) +
          ` | r=${radius} w=${width}`,
      );
      out.push({ label, cx, cy, cz, radius, width });
    });

    console.log('\n─── READY-TO-PASTE JS for F1Model.tsx ───');
    console.log('// Discovered from f1-2022-draco.glb by scripts/inspect-wheels.mjs');
    console.log('// Tyre outer radius = 0.331, tyre width along X = 0.315');
    console.log('const WHEEL_POSITIONS = [');
    for (const w of out) {
      console.log(
        `  [${w.cx}, ${w.cy}, ${w.cz}], // ${w.label.toLowerCase()} — radius ${w.radius}, width ${w.width}`,
      );
    }
    console.log('] as const;');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});