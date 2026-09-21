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
// ─────────────────────────────────────────────────────────────────────────────
const R25_BLUE = '#1B6FB8'; // Mild Seven Blue — dominant bodywork color
const R25_YELLOW = '#FFEF00'; // Mild Seven Yellow — accents, rims, side stripe
const INK = '#0a0e14'; // Page ink — tyres, halo, structural black
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
const BRAKE_DISC_RADIUS = 0.27; // dark disc inside the wheel — seals the "see-through" hole (tyre radius 0.331)
const BRAKE_DISC_THICKNESS = 0.1; // spans most of the wheel width (tyre width 0.315)
const SUSPENSION_ARM_LENGTH = 0.4; // bridge from wheel hub toward chassis
const SUSPENSION_ARM_RADIUS = 0.05; // thick enough to read as a real pushrod / brake duct

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
              Torus is oriented so its axis lies along X (the axle direction),
              matching the GLB's tyre mesh orientation. */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[rimR, 0.028 * scale, 14, 36]} />
            <meshStandardMaterial
              color={R25_YELLOW}
              metalness={0.4}
              roughness={0.35}
              emissive={R25_YELLOW}
              emissiveIntensity={0.55}
            />
          </mesh>

          {/* Brake disc - flat dark disc perpendicular to the wheel axle.
              At oblique angles, the brake disc is what blocks the view
              through the wheel ring, sealing the "see-through" hole that
              appeared between the tyre outer edge and the suspension. */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[discR, discR, discW, 32]} />
            <meshStandardMaterial
              color={RIM_INK}
              metalness={0.7}
              roughness={0.45}
            />
          </mesh>

          {/* Dark hub cylinder in the wheel center, sitting on top of the
              brake disc, gives the wheel a solid, mounted feel. */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[hubR, hubR, 0.16 * scale, 20]} />
            <meshStandardMaterial color={RIM_INK} metalness={0.6} roughness={0.4} />
          </mesh>

          {/* Inner yellow hub center for that R25 wheel-nut pop */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.09 * scale]}>
            <cylinderGeometry args={[hubR * 0.42, hubR * 0.42, 0.06 * scale, 14]} />
            <meshStandardMaterial
              color={R25_YELLOW}
              metalness={0.4}
              roughness={0.4}
              emissive={R25_YELLOW}
              emissiveIntensity={0.5}
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
            <meshStandardMaterial
              color={R25_YELLOW}
              metalness={0.55}
              roughness={0.35}
              emissive={R25_YELLOW}
              emissiveIntensity={0.4}
            />
          </mesh>
        );
      })}

      {/* Brake-duct covers at the chassis end of each arm */}
      {WHEEL_POSITIONS.map((pos, i) => {
        const [wx, wy, wz] = pos;
        const sign = wx < CHASSIS_CENTERLINE_X ? 1 : -1;
        const coverX = wx + sign * armL + sign * 0.04 * scale;
        return (
          <mesh
            key={`cover-${i}`}
            position={[coverX, wy + 0.02, wz]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[armR * 1.4, armR * 1.4, 0.06 * scale, 16]} />
            <meshStandardMaterial
              color={R25_YELLOW}
              metalness={0.55}
              roughness={0.4}
              emissive={R25_YELLOW}
              emissiveIntensity={0.35}
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

  useFrame((state, delta) => {
    if (!group.current) return;
    if (!reducedMotion) {
      // Subtle rotation — slow, premium
      group.current.rotation.y += delta * 0.18;
    }
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.04;
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
    scene.position.x = -center.x;
    scene.position.y = -center.y + size.y / 4;
    scene.position.z = -center.z;
    const maxAxis = Math.max(size.x, size.y, size.z);
    const targetSize = 5.5;
    if (maxAxis > 0) {
      scene.scale.setScalar(targetSize / maxAxis);
    }

    // R25-specific material assignments.
    type Assignment = {
      color: string;
      metalness: number;
      roughness: number;
      emissive?: string;
      emissiveIntensity?: number;
    };

    const overrides: Record<string, Assignment> = {
      // Main bodywork — Mild Seven Blue (dominant R25 color).
      // Emissive keeps the saturated blue punchy on the dark hero background.
      'Material.001': {
        color: R25_BLUE,
        metalness: 0.25,
        roughness: 0.45,
        emissive: R25_BLUE,
        emissiveIntensity: 0.35,
      },
      // In this GLB, `Material.047` is used for many large body panels
      // (rear wing assembly, side body, lower bodywork) — treat it as
      // bodywork too, so the bulk of the car stays blue.
      'Material.047': {
        color: R25_BLUE,
        metalness: 0.25,
        roughness: 0.45,
        emissive: R25_BLUE,
        emissiveIntensity: 0.35,
      },
      // Front wing elements — Mild Seven Blue (wing tip accents)
      front_wing_1: {
        color: R25_BLUE,
        metalness: 0.25,
        roughness: 0.45,
        emissive: R25_BLUE,
        emissiveIntensity: 0.35,
      },
      // Middle livery accent stripe — Mild Seven Yellow (the iconic R25 band)
      middle: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.6,
      },
      // Cockpit screen — dark with cyan tint, slight emissive
      screen: {
        color: SCREEN_TINT,
        metalness: 0.5,
        roughness: 0.35,
        emissive: '#1c4a6b',
        emissiveIntensity: 0.5,
      },
      // Dials — Mild Seven Yellow with strong emissive
      dial_1: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.85,
      },
      dial_3: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.85,
      },
      dial_4: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.85,
      },
      spin_dial: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.8,
      },
      spin_dial_2: {
        color: R25_YELLOW,
        metalness: 0.3,
        roughness: 0.4,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.8,
      },
      // Tyres — Pirelli ink black with a slight roughness for the rubber look.
      // Yellow lettering is provided separately by the wheel-detail torus rim.
      tyre: { color: INK, metalness: 0.15, roughness: 0.85 },
    };

    // Unmapped materials — treat as bodywork (blue).
    const fallback: Assignment = {
      color: R25_BLUE,
      metalness: 0.25,
      roughness: 0.45,
      emissive: R25_BLUE,
      emissiveIntensity: 0.35,
    };

    // First pass: collect unique materials and their assignments.
    const materialAssignments = new Map<THREE.Material, Assignment>();
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of materials) {
        if (!mat || materialAssignments.has(mat)) continue;
        const name = mat.name;
        const assignment = overrides[name] ?? fallback;
        materialAssignments.set(mat, assignment);
      }
    });

    // Second pass: replace each unique material once.
    for (const [oldMat, assignment] of materialAssignments.entries()) {
      const newMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(assignment.color),
        metalness: assignment.metalness,
        roughness: assignment.roughness,
      });
      if (assignment.emissive) {
        newMat.emissive = new THREE.Color(assignment.emissive);
        newMat.emissiveIntensity = assignment.emissiveIntensity ?? 0.05;
      }
      newMat.name = oldMat.name;
      // Replace in scene
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
    }
  }, [scene]);

  return (
    <group ref={group} position={[0, 0, 0]}>
      <primitive object={scene} />
      {/* Wheel detail sits at the same world positions as the GLB's tyres
          because the parent group inherits the same translation/scale.
          Add it here so it rotates with the car. */}
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
      {/* Main chassis — Mild Seven Blue */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[5.6, 0.45, 1.0]} />
        <meshStandardMaterial
          color={R25_BLUE}
          metalness={0.6}
          roughness={0.3}
          emissive={R25_BLUE}
          emissiveIntensity={0.18}
        />
      </mesh>
      {/* Yellow livery band — the iconic R25 yellow stripe down the side */}
      <mesh position={[0, 0.45, 0.51]}>
        <boxGeometry args={[5.0, 0.12, 0.005]} />
        <meshStandardMaterial
          color={R25_YELLOW}
          metalness={0.4}
          roughness={0.4}
          emissive={R25_YELLOW}
          emissiveIntensity={0.55}
        />
      </mesh>
      <mesh position={[0, 0.45, -0.51]}>
        <boxGeometry args={[5.0, 0.12, 0.005]} />
        <meshStandardMaterial
          color={R25_YELLOW}
          metalness={0.4}
          roughness={0.4}
          emissive={R25_YELLOW}
          emissiveIntensity={0.55}
        />
      </mesh>
      {/* Cockpit block — blue */}
      <mesh position={[-0.2, 0.95, 0]}>
        <boxGeometry args={[1.4, 0.5, 0.9]} />
        <meshStandardMaterial
          color={R25_BLUE}
          metalness={0.7}
          roughness={0.25}
          emissive={R25_BLUE}
          emissiveIntensity={0.18}
        />
      </mesh>
      {/* Nose — blue with yellow tip */}
      <mesh position={[2.6, 0.4, 0]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[1.6, 0.18, 0.7]} />
        <meshStandardMaterial
          color={R25_BLUE}
          metalness={0.6}
          roughness={0.3}
          emissive={R25_BLUE}
          emissiveIntensity={0.18}
        />
      </mesh>
      {/* Front wing — blue */}
      <mesh position={[3.0, 0.18, 0]}>
        <boxGeometry args={[0.4, 0.06, 1.8]} />
        <meshStandardMaterial
          color={R25_BLUE}
          metalness={0.55}
          roughness={0.35}
          emissive={R25_BLUE}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Rear wing — blue with yellow accent */}
      <mesh position={[-2.9, 0.85, 0]}>
        <boxGeometry args={[0.18, 0.4, 1.2]} />
        <meshStandardMaterial
          color={R25_BLUE}
          metalness={0.55}
          roughness={0.35}
          emissive={R25_BLUE}
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh position={[-2.85, 0.95, 0]}>
        <boxGeometry args={[0.22, 0.04, 1.25]} />
        <meshStandardMaterial
          color={R25_YELLOW}
          metalness={0.45}
          roughness={0.4}
          emissive={R25_YELLOW}
          emissiveIntensity={0.55}
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
          {/* Tyre */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.36, 0.36, 0.28, 24]} />
            <meshStandardMaterial color={INK} metalness={0.15} roughness={0.85} />
          </mesh>
          {/* Yellow inner rim — the R25 wheel lip */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.18, 0.025, 12, 32]} />
            <meshStandardMaterial
              color={R25_YELLOW}
              metalness={0.4}
              roughness={0.35}
              emissive={R25_YELLOW}
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Hub */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.3, 18]} />
            <meshStandardMaterial color={RIM_INK} metalness={0.55} roughness={0.4} />
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
            <meshStandardMaterial
              color={R25_YELLOW}
              metalness={0.55}
              roughness={0.35}
              emissive={R25_YELLOW}
              emissiveIntensity={0.25}
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
      {/* PBR environment — very subtle IBL just for surface micro-detail.
          High intensity here washes the saturated R25 colors pale. */}
      <Environment preset="warehouse" environmentIntensity={0.15} />

      {/* Base ambient — keeps shadows from going pure black */}
      <ambientLight intensity={0.55} />

      {/* Key light — front-top-right at moderate intensity, hero of the rig */}
      <directionalLight
        position={[6, 8, 6]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Subtle blue rim — picks out blue accents without bleaching them */}
      <directionalLight
        position={[-6, 4, -6]}
        intensity={0.5}
        color={R25_BLUE}
      />

      {/* Subtle yellow rim — outlines the yellow livery band */}
      <directionalLight
        position={[6, 4, -6]}
        intensity={0.45}
        color={R25_YELLOW}
      />

      {/* Subtle ground bounce — keeps the underside from going pitch black */}
      <pointLight position={[0, -2, 2]} intensity={0.25} color={R25_BLUE} />

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
        camera={{ position: [5, 2.5, 6], fov: 35 }}
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