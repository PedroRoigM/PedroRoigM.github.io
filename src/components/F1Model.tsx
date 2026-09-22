/**
 * F1Model — Real F1 2022 3D model loaded from Draco-compressed GLB,
 * re-skinned as the Renault R25 (2005 Alonso championship car).
 *
 * Source: Blender458 on Sketchfab (CC Attribution 4.0)
 *   https://fetchcfd.com/threeDViewGltf/4314-f1-3d-model
 *   https://sketchfab.com/Blender458
 *
 * Pipeline:
 *   - Original GLB: 2.82 MB
 *   - Draco-compressed: 196 KB (93% reduction via gltf-transform + draco3d)
 *   - Build: scripts/compress-glb.mjs
 *
 * Livery: Renault R25 (2005) — Alonso championship-winning Mild Seven livery.
 * Predominantly **Mild Seven Blue** bodywork with **Mild Seven Yellow** accents.
 *
 * Material mapping (post-recolor):
 *   - Material.001 (main bodywork, sidepods, chassis panels) → Mild Seven Blue
 *   - Material.047 (side stripe / accent livery)             → Mild Seven Yellow
 *   - front_wing_1 (front wing elements)                     → Mild Seven Blue
 *   - middle (livery accent stripe across the body)          → Mild Seven Yellow
 *   - dials / spin_dials (steering wheel accents)            → Mild Seven Yellow
 *   - screen (cockpit display)                               → dark cyan
 *   - tyre (all 4 wheels — single combined mesh)             → Pirelli ink black
 *   - unnamed (`null` material)                              → Mild Seven Blue
 *
 * Wheel detail (added procedurally on top of the GLB; positions
 * recovered by scripts/inspect-wheels.mjs via k-means clustering of the
 * 2048 vertices of the GLB's combined `tyre` mesh):
 *   - Yellow inner-rim accent torus around each wheel hub (Mild Seven
 *     Yellow is iconic on the R25 wheel lips).
 *   - Dark gunmetal brake disc (flat disc perpendicular to the axle)
 *     inside each wheel — seals the "see-through" hole at oblique angles.
 *   - Black hub cylinder + yellow wheel-nut center for visual depth.
 *   - Thick yellow suspension arm / brake duct from each wheel hub inward
 *     to the chassis centreline — bridges the visible gap between wheel
 *     and sidepod at any camera angle the user can reach.
 *   - Brake-duct cover at the chassis end of each arm to hide the blunt
 *     cylinder end and integrate the assembly.
 *
 * - Lazy-loaded (client:visible) — only loads when hero enters viewport
 * - WebGL feature detection with graceful fallback
 * - Respects prefers-reduced-motion (no rotation animation)
 */
import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  useGLTF,
  OrbitControls,
  Environment,
  ContactShadows,
} from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = '/models/f1-2022-draco.glb';
const FALLBACK_URL = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

// Set Draco decoder path so drei can decode the compressed GLB.
// We self-host nothing here; drei's useGLTF falls back to gstatic CDN
// which is fine for a public portfolio.
useGLTF.setDecoderPath(FALLBACK_URL);

// ─────────────────────────────────────────────────────────────────────────────
// Renault R25 (2005) palette — Alonso championship-winning livery.
// Predominantly blue bodywork with yellow accents on rims, side stripes,
// and livery band.
//
// Colour reference (Mild Seven tobacco brand livery, 2005 spec):
//   - Body blue (Mild Seven Blue): a saturated mid-tone, slightly darker
//     than the previous #1B6FB8 value, closer to the photographic
//     reality of the era (#16539C-ish).
//   - Accent yellow (Mild Seven Yellow): a high-chroma yellow,
//     #FFE500-ish, with a slight green undertone in the highlights.
// ─────────────────────────────────────────────────────────────────────────────
const R25_BLUE = '#16539C'; // Mild Seven Blue — dominant bodywork color
const R25_YELLOW = '#FFE500'; // Mild Seven Yellow — accents, rims, side stripe
const INK = '#08090c'; // Page ink — tyres, halo, structural black
const RIM_INK = '#1a1d24'; // Slightly lighter than tyre for inner rim contrast
const SCREEN_TINT = '#0d2230'; // Cockpit screen — dark with cyan undertone

interface F1CarProps {
  reducedMotion: boolean;
}

// Wheel positions derived from k-means clustering of the GLB's `tyre` mesh's
// 2048 vertices into 4 spatial clusters (see scripts/inspect-wheels.mjs).
// The source GLB exposes `tyre` as ONE combined mesh covering all four wheels;
// the per-wheel centres below are the centroids of those clusters and are
// exact to ~0.001 in the GLB's local space.
//
// Discovered geometry:
//   - Tyre outer radius     ≈ 0.331
//   - Tyre width along X    ≈ 0.315
//   - Wheelbase (z range)   ≈ 3.000 (FL→RL or FR→RR)
//
// The chassis centreline is at x ≈ 0.65 (mean of FL.x and FR.x), so the gap
// from each wheel hub to the chassis is ~0.42 — perfect for a 0.4-long
// suspension arm.
const WHEEL_POSITIONS: ReadonlyArray<readonly [number, number, number]> = [
  // [x, y, z] in the GLB's local space
  [-0.088, 0.32, 1.187], // front-left
  [1.378, 0.32, 1.187], // front-right
  [-0.061, 0.325, -1.813], // rear-left
  [1.352, 0.325, -1.813], // rear-right
] as const;

// Geometry constants derived from the GLB.
// TYRE_RADIUS = 0.331 and TYRE_WIDTH = 0.315 come from the GLB's tyre
// bounding box and inform the choices below (RIM_BAND_RADIUS, BRAKE_DISC_*).
// Both are exposed in scripts/inspect-wheels.mjs so the next iteration can
// re-verify without re-reading this file.
const CHASSIS_CENTERLINE_X = 0.65; // x-coord of the chassis tub (mean of L/R wheels)
const RIM_BAND_RADIUS = 0.295; // the yellow R25 inner-rim accent sits just inside the tyre outer edge (0.331)
const BRAKE_DISC_RADIUS = 0.325; // dark disc inside the wheel — seals the radial "see-through" hole (tyre radius 0.331, was 0.27 — too small, left a visible gap)
const BRAKE_DISC_THICKNESS = 0.1; // spans most of the wheel width (tyre width 0.315)
const SUSPENSION_ARM_LENGTH = 0.78; // bridge from wheel hub all the way to the chassis centerline (was 0.4 — too short, left ~0.33 vb gaps)
const SUSPENSION_ARM_RADIUS = 0.05; // thick enough to read as a real pushrod / brake duct
const BRAKE_DUCT_COVER_OFFSET = 0.03; // cover sits a hair past the arm's chassis end (was 0.04, slightly inside the chassis when armL=0.4)

function WheelDetail({ scale = 1 }: { scale?: number }) {
  // Procedural detail for each of the 4 wheels, positioned at the GLB-local
  // centres discovered by scripts/inspect-wheels.mjs. Each wheel gets:
  //   - Yellow inner-rim accent torus (R25 iconic detail)
  //   - Dark gunmetal brake disc (flat disc perpendicular to the axle — this
  //     closes the "see-through" hole at oblique angles)
  //   - Dark hub cylinder + yellow wheel-nut center
  //   - Thick yellow suspension arm / brake duct from the hub toward the
  //     chassis centreline (the real gap-sealer at oblique angles)
  const rimR = RIM_BAND_RADIUS * scale;
  const hubR = 0.1 * scale;
  const discR = BRAKE_DISC_RADIUS * scale;
  const discW = BRAKE_DISC_THICKNESS * scale;
  const armL = SUSPENSION_ARM_LENGTH * scale;
  const armR = SUSPENSION_ARM_RADIUS * scale;

  return (
    <group>
      {WHEEL_POSITIONS.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Yellow inner-rim accent — iconic R25 wheel detail.
              Painted bodywork-style: glossy clearcoat, mild yellow with
              some metalness for that "painted metal rim" response. */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[rimR, 0.028 * scale, 14, 36]} />
            <meshPhysicalMaterial
              color={R25_YELLOW}
              metalness={0.5}
              roughness={0.35}
              clearcoat={1.0}
              clearcoatRoughness={0.08}
              emissive={R25_YELLOW}
              emissiveIntensity={0.35}
            />
          </mesh>

          {/* Brake disc - dark gunmetal disc with subtle anisotropy hint.
              High metalness + medium roughness reads as machined carbon
              brake disc (not chrome, not plastic). */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[discR, discR, discW, 32]} />
            <meshPhysicalMaterial
              color={RIM_INK}
              metalness={0.85}
              roughness={0.42}
              clearcoat={0.3}
              clearcoatRoughness={0.4}
            />
          </mesh>

          {/* Dark hub cylinder in the wheel center, sitting on top of the
              brake disc, gives the wheel a solid, mounted feel. */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[hubR, hubR, 0.16 * scale, 20]} />
            <meshPhysicalMaterial
              color={RIM_INK}
              metalness={0.8}
              roughness={0.35}
              clearcoat={0.5}
              clearcoatRoughness={0.25}
            />
          </mesh>

          {/* Inner yellow hub center for that R25 wheel-nut pop.
              Lives on the INBOARD side (negative X) of the wheel — putting
              it on the outboard side made every wheel read as a yellow disc
              from the outside, which is wrong for an F1 (the wheel outboard
              face should be just black rubber, the brake disc / wheel-nut
              detail is on the inboard side facing the chassis). */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, -0.09 * scale]}>
            <cylinderGeometry args={[hubR * 0.42, hubR * 0.42, 0.06 * scale, 14]} />
            <meshPhysicalMaterial
              color={R25_YELLOW}
              metalness={0.5}
              roughness={0.4}
              clearcoat={1.0}
              clearcoatRoughness={0.1}
              emissive={R25_YELLOW}
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}

      {/* Suspension arms / brake ducts - thick yellow cylinders from each
          wheel hub inward toward the chassis centreline. These are the real
          gap-sealers at oblique angles. */}
      {WHEEL_POSITIONS.map((pos, i) => {
        const [wx, wy, wz] = pos;
        const sign = wx < CHASSIS_CENTERLINE_X ? 1 : -1;
        const armCenterX = wx + (sign * armL) / 2;
        return (
          <mesh
            key={`arm-${i}`}
            position={[armCenterX, wy + 0.02, wz]}
            rotation={[0, sign > 0 ? 0 : Math.PI, Math.PI / 2]}
          >
            <cylinderGeometry args={[armR, armR, armL, 14]} />
            <meshPhysicalMaterial
              color={R25_YELLOW}
              metalness={0.55}
              roughness={0.3}
              clearcoat={1.0}
              clearcoatRoughness={0.12}
              emissive={R25_YELLOW}
              emissiveIntensity={0.25}
            />
          </mesh>
        );
      })}

      {/* Brake-duct covers at the chassis end of each arm */}
      {WHEEL_POSITIONS.map((pos, i) => {
        const [wx, wy, wz] = pos;
        const sign = wx < CHASSIS_CENTERLINE_X ? 1 : -1;
        const coverX = wx + sign * armL + sign * BRAKE_DUCT_COVER_OFFSET * scale;
        return (
          <mesh
            key={`cover-${i}`}
            position={[coverX, wy + 0.02, wz]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[armR * 1.4, armR * 1.4, 0.06 * scale, 16]} />
            <meshPhysicalMaterial
              color={R25_YELLOW}
              metalness={0.55}
              roughness={0.35}
              clearcoat={1.0}
              clearcoatRoughness={0.12}
              emissive={R25_YELLOW}
              emissiveIntensity={0.25}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function F1Car({ reducedMotion }: F1CarProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);
  // Base transform of the group (centering + scale) is computed once in
  // useEffect from the GLB's AABB and stored here so the useFrame loop can
  // animate the vertical wobble AROUND that base position without clobbering
  // the centering each frame.
  const baseTransformRef = useRef<{
    pos: THREE.Vector3;
    scale: number;
  }>({ pos: new THREE.Vector3(), scale: 1 });

  useFrame((state, delta) => {
    if (!group.current) return;
    if (!reducedMotion) {
      // Subtle rotation — slow, premium
      group.current.rotation.y += delta * 0.18;
    }
    // Vertical float around the centered base Y, not raw 0. This keeps the
    // car visually hovering where the useEffect placed it (slightly above
    // the geometric centre so the wheels don't kiss the contact shadow).
    const baseY = baseTransformRef.current.pos.y;
    group.current.position.y = baseY + Math.sin(state.clock.elapsedTime * 0.6) * 0.04;
  });

  // Center + recolor the model.
  // The source GLB aggregates bodywork into `Material.001` (now recolored
  // blue), with accent livery on `Material.047` / `front_wing_1` / `middle`
  // (yellow), and the dials/spin_dials/screen on the steering wheel.
  useEffect(() => {
    if (!scene) return;

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z);
    // Reduced from 5.5 (2026-09-21): at 5.5 the longest GLB axis (the
    // ~3.6-unit car length) ends up at 5.5 world units after scaling, which
    // overflowed the camera's vertical visible area at certain rotations
    // (the model's length periodically aligned with the camera up-axis and
    // got cropped at the top/bottom of the container). 4.6 leaves clear
    // breathing room above/below even at the worst-case orbital angle.
    const targetSize = 4.6;
    const scale = maxAxis > 0 ? targetSize / maxAxis : 1;

    // CRITICAL: apply the centering + scaling to the PARENT GROUP, not to
    // the scene. The scene and the procedural WheelDetail are both children
    // of this group; putting the transform on the group makes both inherit
    // it so the procedural wheels line up with the GLB's actual tyre mesh
    // (previously the transform lived on `scene` and WheelDetail used raw
    // GLB coordinates, so the procedural wheels were visibly offset from
    // the bodywork by ~0.6 viewBox units).
    baseTransformRef.current.pos.set(
      -center.x,
      -center.y + size.y / 4,
      -center.z,
    );
    baseTransformRef.current.scale = scale;
    if (group.current) {
      group.current.position.copy(baseTransformRef.current.pos);
      group.current.scale.setScalar(scale);
    }

    // R25-specific material assignments.
    // Materials now use MeshPhysicalMaterial (clearcoat for painted bodywork)
    // so the car stops looking like coloured plastic and starts behaving
    // like real painted carbon-bodywork under PBR + IBL lighting.
    type Assignment = {
      color: string;
      metalness: number;
      roughness: number;
      /** Clearcoat intensity 0..1. Adds a glossy varnish layer over the
       *  base color — what makes paint look like paint instead of plastic. */
      clearcoat: number;
      /** Roughness of the clearcoat layer specifically. Low = mirror,
       *  high = matte varnish. ~0.08 reads as fresh paint. */
      clearcoatRoughness: number;
      emissive?: string;
      emissiveIntensity?: number;
      side?: THREE.Side;
    };

    const overrides: Record<string, Assignment> = {
      // Main bodywork — Mild Seven Blue, glossy clearcoat
      // (the varnish layer is what makes it look like real paint instead
      // of coloured plastic). IBL reflections now provide the highlights
      // that the previous emissive overlay was faking.
      'Material.001': {
        color: R25_BLUE,
        metalness: 0.45,
        roughness: 0.4,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      },
      // Large body panels (rear wing assembly, side body, lower bodywork) —
      // same recipe so the bulk of the car reads as one painted surface.
      'Material.047': {
        color: R25_BLUE,
        metalness: 0.45,
        roughness: 0.4,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      },
      // Front wing elements — Mild Seven Blue
      front_wing_1: {
        color: R25_BLUE,
        metalness: 0.45,
        roughness: 0.4,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      },
      // Livery accent stripe — Mild Seven Yellow, slightly different
      // clearcoat roughness so it picks up a subtler highlight than the
      // body paint (the band is supposed to read as graphics, not metal).
      middle: {
        color: R25_YELLOW,
        metalness: 0.35,
        roughness: 0.45,
        clearcoat: 1.0,
        clearcoatRoughness: 0.18,
      },
      // Cockpit screen — glass-like: very low roughness, thin clearcoat,
      // dark base. The mesh is a 2D plane so DoubleSide keeps it visible
      // from every orbital angle.
      screen: {
        color: SCREEN_TINT,
        metalness: 0.1,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        emissive: '#1c4a6b',
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      },
      // Steering-wheel dials — emissive stays (they ARE supposed to glow)
      dial_1: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.7,
      },
      dial_3: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.7,
      },
      dial_4: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.7,
      },
      spin_dial: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.7,
      },
      spin_dial_2: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.7,
      },
      // Tyres — matte Pirelli rubber, NO clearcoat. High roughness means
      // very little specular highlight (tyres don't shine under lights).
      // Slight darkening of the base color reads as soot-darkened racing
      // slick rubber rather than showroom black.
      tyre: {
        color: '#08090c',
        metalness: 0.02,
        roughness: 0.92,
        clearcoat: 0,
        clearcoatRoughness: 0,
      },
    };

    // Unmapped materials — treat as bodywork (blue). Same recipe as the
    // main bodywork so null-material fallback meshes match the rest of the
    // car visually instead of looking like a different plastic.
    const fallback: Assignment = {
      color: R25_BLUE,
      metalness: 0.45,
      roughness: 0.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    };

    // First pass: collect unique materials and their assignments.
    // Sentinel key for meshes that came in with `mesh.material === null`
    // (Object_76 in the inspect output — a small rear-wing endplate that
    // would otherwise be invisible because Three.js skips null-material
    // meshes entirely).
    const NULL_KEY = '__NULL_MATERIAL__';
    type Pending = { mat: THREE.Material | null; assignment: Assignment };
    const materialAssignments = new Map<string, Pending>();
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const slots: (THREE.Material | null)[] = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const mat of slots) {
        if (mat) {
          if (materialAssignments.has(mat.uuid)) continue;
          materialAssignments.set(mat.uuid, {
            mat,
            assignment: overrides[mat.name] ?? fallback,
          });
        } else if (!materialAssignments.has(NULL_KEY)) {
          materialAssignments.set(NULL_KEY, { mat: null, assignment: fallback });
        }
      }
    });

    // Second pass: replace each unique material once.
    // MeshPhysicalMaterial (vs Standard) gives us a clearcoat layer so the
    // paint looks like real painted carbon bodywork instead of coloured
    // plastic. The clearcoat settings come from the assignment defaults.
    for (const { mat: oldMat, assignment } of materialAssignments.values()) {
      const newMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(assignment.color),
        metalness: assignment.metalness,
        roughness: assignment.roughness,
        clearcoat: assignment.clearcoat,
        clearcoatRoughness: assignment.clearcoatRoughness,
        // Default to FrontSide; only `screen` opts into DoubleSide so the
        // cockpit display stays visible when the camera orbits past it.
        side: assignment.side ?? THREE.FrontSide,
      });
      if (assignment.emissive) {
        newMat.emissive = new THREE.Color(assignment.emissive);
        newMat.emissiveIntensity = assignment.emissiveIntensity ?? 0;
      }
      newMat.name = oldMat ? oldMat.name : NULL_KEY;
      if (oldMat) {
        // Replace in scene (every mesh that referenced this material)
        scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (Array.isArray(mesh.material)) {
            const idx = mesh.material.indexOf(oldMat);
            if (idx !== -1) mesh.material[idx] = newMat;
          } else if (mesh.material === oldMat) {
            mesh.material = newMat;
          }
        });
        oldMat.dispose();
      } else {
        // Null-material slot — assign the fallback to every mesh whose
        // material was null. These meshes would otherwise be invisible.
        scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (mesh.material === null || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
            mesh.material = newMat;
          }
        });
      }
    }
  }, [scene]);

  return (
    <group ref={group} position={[0, 0, 0]}>
      <primitive object={scene} />
      {/* Wheel detail is a sibling of the GLB scene, but both inherit the
          same centering+scale from this group, so the procedural rims /
          brake discs / suspension arms line up exactly with the GLB's
          tyres instead of floating off to one side. */}
      <WheelDetail />
    </group>
  );
}

// Static fallback procedural model — used while Draco GLB loads.
// R25-themed (blue chassis + yellow livery band + black tyres with yellow rims).
function PlaceholderF1({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={group} position={[0, -0.4, 0]} scale={0.5}>
      {/* Main chassis — Mild Seven Blue, glossy clearcoat */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[5.6, 0.45, 1.0]} />
        <meshPhysicalMaterial
          color={R25_BLUE}
          metalness={0.45}
          roughness={0.4}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
        />
      </mesh>
      {/* Yellow livery band — the iconic R25 yellow stripe down the side */}
      <mesh position={[0, 0.45, 0.51]}>
        <boxGeometry args={[5.0, 0.12, 0.005]} />
        <meshPhysicalMaterial
          color={R25_YELLOW}
          metalness={0.35}
          roughness={0.45}
          clearcoat={1.0}
          clearcoatRoughness={0.18}
          emissive={R25_YELLOW}
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0, 0.45, -0.51]}>
        <boxGeometry args={[5.0, 0.12, 0.005]} />
        <meshPhysicalMaterial
          color={R25_YELLOW}
          metalness={0.35}
          roughness={0.45}
          clearcoat={1.0}
          clearcoatRoughness={0.18}
          emissive={R25_YELLOW}
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Cockpit block — blue */}
      <mesh position={[-0.2, 0.95, 0]}>
        <boxGeometry args={[1.4, 0.5, 0.9]} />
        <meshPhysicalMaterial
          color={R25_BLUE}
          metalness={0.45}
          roughness={0.4}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
        />
      </mesh>
      {/* Nose — blue with yellow tip */}
      <mesh position={[2.6, 0.4, 0]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[1.6, 0.18, 0.7]} />
        <meshPhysicalMaterial
          color={R25_BLUE}
          metalness={0.45}
          roughness={0.4}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
        />
      </mesh>
      {/* Front wing — blue */}
      <mesh position={[3.0, 0.18, 0]}>
        <boxGeometry args={[0.4, 0.06, 1.8]} />
        <meshPhysicalMaterial
          color={R25_BLUE}
          metalness={0.45}
          roughness={0.4}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
        />
      </mesh>
      {/* Rear wing — blue with yellow accent */}
      <mesh position={[-2.9, 0.85, 0]}>
        <boxGeometry args={[0.18, 0.4, 1.2]} />
        <meshPhysicalMaterial
          color={R25_BLUE}
          metalness={0.45}
          roughness={0.4}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
        />
      </mesh>
      <mesh position={[-2.85, 0.95, 0]}>
        <boxGeometry args={[0.22, 0.04, 1.25]} />
        <meshPhysicalMaterial
          color={R25_YELLOW}
          metalness={0.35}
          roughness={0.45}
          clearcoat={1.0}
          clearcoatRoughness={0.18}
          emissive={R25_YELLOW}
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Wheels — black tyres with yellow inner rims */}
      {(
        [
          [2.0, 0.36, 1.05],
          [2.0, 0.36, -1.05],
          [-2.0, 0.36, 1.05],
          [-2.0, 0.36, -1.05],
        ] as const
      ).map((pos, i) => (
        <group key={i} position={pos}>
          {/* Tyre — matte rubber */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.36, 0.36, 0.28, 24]} />
            <meshPhysicalMaterial color={INK} metalness={0.02} roughness={0.92} />
          </mesh>
          {/* Yellow inner rim — the R25 wheel lip, glossy clearcoat */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.18, 0.025, 12, 32]} />
            <meshPhysicalMaterial
              color={R25_YELLOW}
              metalness={0.5}
              roughness={0.35}
              clearcoat={1.0}
              clearcoatRoughness={0.1}
              emissive={R25_YELLOW}
              emissiveIntensity={0.35}
            />
          </mesh>
          {/* Hub — gunmetal */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.3, 18]} />
            <meshPhysicalMaterial color={RIM_INK} metalness={0.8} roughness={0.35} clearcoat={0.5} clearcoatRoughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* Yellow pushrods from chassis to each wheel hub */}
      {(
        [
          [2.0, 0.36, 1.05],
          [2.0, 0.36, -1.05],
          [-2.0, 0.36, 1.05],
          [-2.0, 0.36, -1.05],
        ] as const
      ).map((pos, i) => {
        const [wx, wy, wz] = pos;
        const chassisX = 0;
        const midX = (wx + chassisX) / 2;
        const dx = chassisX - wx;
        const length = Math.abs(dx);
        const rotationY = dx > 0 ? 0 : Math.PI;
        return (
          <mesh
            key={`push-${i}`}
            position={[midX, wy + 0.05, wz]}
            rotation={[0, rotationY, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.025, 0.025, length, 8]} />
            <meshPhysicalMaterial
              color={R25_YELLOW}
              metalness={0.55}
              roughness={0.3}
              clearcoat={1.0}
              clearcoatRoughness={0.12}
              emissive={R25_YELLOW}
              emissiveIntensity={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Lights() {
  return (
    <>
      {/* PBR environment — much stronger IBL now so the clearcoat layer
          has real reflections to bounce. The warehouse preset has neutral
          lighting (good for product showcase) with no warm/cool tint that
          would skew the saturated R25 colors. */}
      <Environment preset="warehouse" environmentIntensity={0.55} />

      {/* Lower ambient — let IBL + directional define the shape instead of
          flat fill. Shadows get more depth this way. */}
      <ambientLight intensity={0.35} />

      {/* Key light — front-top-right at lower intensity. With IBL doing
          more of the surface lighting, the directional just defines the
          main highlight direction. */}
      <directionalLight
        position={[6, 8, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Soft white rim from above-back, separates the model from the
          dark hero background without tinting it (the previous coloured
          rim lights were stacked on top of the IBL tint and skewed hue). */}
      <directionalLight
        position={[-6, 5, -6]}
        intensity={0.4}
      />

      {/* Subtle yellow rim — picks out the yellow livery band without
          dominating. */}
      <directionalLight
        position={[6, 4, -6]}
        intensity={0.3}
        color={R25_YELLOW}
      />

      {/* Subtle ground bounce — keeps the underside from going pitch black */}
      <pointLight position={[0, -2, 2]} intensity={0.2} color={R25_BLUE} />

      {/* Contact shadows — ground the model so it doesn't float in the void */}
      <ContactShadows
        position={[0, -0.7, 0]}
        opacity={0.7}
        scale={11}
        blur={2.8}
        far={4.5}
        resolution={1024}
      />
    </>
  );
}

export default function F1Model() {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [, setModelLoaded] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? null;
      setWebglSupported(!!gl);
    } catch {
      setWebglSupported(false);
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Preload the GLB once component mounts (it's lazy-loaded from the parent
  // with client:visible, so this is safe — only fires if user scrolls to hero)
  useEffect(() => {
    if (webglSupported === false) return;
    useGLTF.preload(MODEL_URL);
  }, [webglSupported]);

  if (webglSupported === false) {
    return null;
  }

  return (
    <div className="f1-model" aria-hidden="true">
      <Canvas
        camera={{ position: [6, 3, 8.5], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        shadows
        onCreated={() => setModelLoaded(true)}
      >
        <Lights />

        <Suspense fallback={<PlaceholderF1 reducedMotion={reducedMotion} />}>
          <F1Car reducedMotion={reducedMotion} />
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          makeDefault
          // Constrain the camera so the wheels never clip into the ground
          // and the car cannot be flipped upside-down. minPolarAngle=0.52
          // (~30° above horizontal, prevents looking straight down on the
          // roof), maxPolarAngle=1.92 (~110° below horizontal, prevents
          // looking up from under the floor pan).
          minPolarAngle={0.52}
          maxPolarAngle={1.92}
        />
      </Canvas>
      <style>{`
        .f1-model {
          width: 100%;
          height: 100%;
          position: absolute;
          inset: 0;
        }
        .f1-model canvas {
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
}