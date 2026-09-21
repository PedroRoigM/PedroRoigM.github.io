/**
 * F1Model — Real F1 2022 3D model loaded from Draco-compressed GLB.
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
 * The compressed GLB collapses most bodywork into `Material.001`, but the
 * unique materials we can target are:
 *   - Material.001 (most bodywork) → Mild Seven Yellow
 *   - Material.047 (side stripe / accent) → Bleu de France
 *   - front_wing_1 (front wing tip) → Bleu de France
 *   - middle (livery accent) → Bleu de France
 *   - dial_1 / dial_3 / dial_4 / spin_dial / spin_dial_2 (steering wheel) → Yellow accents
 *   - screen (cockpit display) → dark cyan tint
 *   - tyre → ink black
 *   - unnamed (`null` material on Object_76) → Yellow (bodywork)
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

// Renault R25 (2005) palette — Alonso championship-winning livery.
const R25_YELLOW = '#FFEF00'; // Mild Seven Yellow — dominant bodywork
const R25_BLUE = '#318CE7'; // Bleu de France — accents, wing tips, side stripes
const INK = '#0a0e14'; // Page ink — tyres, halo, structural black
const SCREEN_TINT = '#0d2230'; // Cockpit screen — dark with cyan undertone

interface F1CarProps {
  reducedMotion: boolean;
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
  // The source GLB aggregates bodywork into `Material.001` (yellow) and
  // accent parts into `Material.047` / `front_wing_1` / `middle` (blue).
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

    // R25-specific material assignments. Default fallback is YELLOW so
    // anything unmapped (including unnamed materials) reads as bodywork.
    type Assignment = {
      color: string;
      metalness: number;
      roughness: number;
      emissive?: string;
      emissiveIntensity?: number;
    };

    const overrides: Record<string, Assignment> = {
      // Main bodywork — Mild Seven Yellow (dominant R25 color).
      // Lower metalness so the saturated yellow reads true instead of
      // being washed out by HDR reflections; strong emissive so the
      // yellow stays punchy on the dark portfolio background.
      'Material.001': {
        color: R25_YELLOW,
        metalness: 0.2,
        roughness: 0.5,
        emissive: R25_YELLOW,
        emissiveIntensity: 0.65,
      },
      // Side stripe / accent parts — Bleu de France
      'Material.047': {
        color: R25_BLUE,
        metalness: 0.2,
        roughness: 0.5,
        emissive: R25_BLUE,
        emissiveIntensity: 0.55,
      },
      // Front wing elements — Bleu de France (wing tip accents)
      front_wing_1: {
        color: R25_BLUE,
        metalness: 0.2,
        roughness: 0.5,
        emissive: R25_BLUE,
        emissiveIntensity: 0.65,
      },
      // Middle livery accent stripe
      middle: {
        color: R25_BLUE,
        metalness: 0.2,
        roughness: 0.5,
        emissive: R25_BLUE,
        emissiveIntensity: 0.55,
      },
      // Cockpit screen — dark with cyan tint, slight emissive
      screen: {
        color: SCREEN_TINT,
        metalness: 0.5,
        roughness: 0.35,
        emissive: '#1c4a6b',
        emissiveIntensity: 0.5,
      },
      // Dials — yellow with strong emissive so they pop on the dark base
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
      // Tyres — ink black, high roughness
      tyre: { color: INK, metalness: 0.2, roughness: 0.85 },
    };

    // Unmapped (and unnamed) materials → treat as bodywork (yellow).
    const fallback: Assignment = {
      color: R25_YELLOW,
      metalness: 0.2,
      roughness: 0.5,
      emissive: R25_YELLOW,
      emissiveIntensity: 0.65,
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
    </group>
  );
}

// Static fallback procedural model — used while Draco GLB loads.
// Keeps the hero from being empty during the 200-500ms load.
// Already R25-themed (yellow chassis + blue cockpit) so the loading state
// is consistent with the final render.
function PlaceholderF1({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current || reducedMotion) return;
    group.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={group} position={[0, -0.4, 0]} scale={0.5}>
      {/* Simplified chassis — yellow */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[5.6, 0.45, 1.0]} />
        <meshStandardMaterial
          color={R25_YELLOW}
          metalness={0.7}
          roughness={0.26}
          emissive={R25_YELLOW}
          emissiveIntensity={0.06}
        />
      </mesh>
      {/* Cockpit block — blue accent */}
      <mesh position={[-0.2, 0.95, 0]}>
        <boxGeometry args={[1.4, 0.5, 0.9]} />
        <meshStandardMaterial
          color={R25_BLUE}
          metalness={0.8}
          roughness={0.22}
          emissive={R25_BLUE}
          emissiveIntensity={0.08}
        />
      </mesh>
      {/* Wheels */}
      {(
        [
          [2.0, 0.36, 1.05],
          [2.0, 0.36, -1.05],
          [-2.0, 0.36, 1.05],
          [-2.0, 0.36, -1.05],
        ] as const
      ).map((pos, i) => (
        <mesh
          key={i}
          position={pos}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.36, 0.36, 0.28, 24]} />
          <meshStandardMaterial color={INK} metalness={0.2} roughness={0.85} />
        </mesh>
      ))}
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

      {/* Subtle yellow rim — outlines the body without bleaching it */}
      <directionalLight
        position={[6, 4, -6]}
        intensity={0.6}
        color={R25_YELLOW}
      />

      {/* Subtle blue rim — picks out blue accents without bleaching them */}
      <directionalLight
        position={[-6, 4, -6]}
        intensity={0.5}
        color={R25_BLUE}
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

function LoadingFallback() {
  // Suspense fallback: render the procedural placeholder.
  // Using a ref-based component would be cleaner, but here we just rely
  // on the wrapper below swapping between Placeholder and F1Car.
  return null;
}

export default function F1Model() {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

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
