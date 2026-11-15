import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Group, Mesh } from "three";

export type StationKey = "furnace" | "molding" | "pouring" | "cooling" | "inspection" | "overview";

export interface FactoryTelemetry {
  meltTemp: number;
  inductionPower: number;
  furnaceVibration: number;
  liningHealth: number;
  sandMoisture: number;
  compactability: number;
  squeezePressure: number;
  pourTemp: number;
  pourRate: number;
  stopperLift: number;
  coolingSurfaceTemp: number;
  solidificationPct: number;
  defectRisk: number;
  resnetSigmoid: number;
  activeBatch: string;
  anomalyActive: boolean;
  anomalyType: string | null;
  conveyorRunning: boolean;
  simulationSpeed: number;
}

// Materials matching the foundry industrial palette
const STEEL = { color: "#42474f", metalness: 0.82, roughness: 0.34 };
const STEEL_DARK = { color: "#25282c", metalness: 0.78, roughness: 0.42 };
const STEEL_LIGHT = { color: "#7a828e", metalness: 0.88, roughness: 0.25 };
const COPPER = { color: "#b4622a", metalness: 0.85, roughness: 0.3 };
const REFRACTORY = { color: "#8f7a5e", metalness: 0.05, roughness: 0.92 };
const SAND = { color: "#c7a26d", metalness: 0.02, roughness: 0.95 };
const SAFETY_YELLOW = { color: "#e5a823", metalness: 0.3, roughness: 0.6 };
const FLOOR_MAT = { color: "#b0a27a", metalness: 0.15, roughness: 0.85 };
const CONDUIT_MAT = { color: "#2f3237", metalness: 0.7, roughness: 0.4 };

// Heat colors for molten metal
const HEAT_PALETTE = [
  new THREE.Color("#4a0700"),
  new THREE.Color("#d32f00"),
  new THREE.Color("#ff8500"),
  new THREE.Color("#ffea75"),
];

function getHeatColor(n: number, target: THREE.Color): THREE.Color {
  const clamped = THREE.MathUtils.clamp(n, 0, 1) * (HEAT_PALETTE.length - 1);
  const idx = Math.min(HEAT_PALETTE.length - 2, Math.floor(clamped));
  const from = HEAT_PALETTE[idx] ?? HEAT_PALETTE[0]!;
  const to = HEAT_PALETTE[idx + 1] ?? from;
  return target.copy(from).lerp(to, clamped - idx);
}

// --- Smooth Camera Controller ---
function CameraRig({ targetStation }: { targetStation: StationKey }) {
  const cameraPresets: Record<StationKey, { pos: [number, number, number]; look: [number, number, number] }> = {
    overview: { pos: [0, 14, 26], look: [0, 0, 0] },
    furnace: { pos: [-12, 5, 8], look: [-12, 1.2, 0] },
    molding: { pos: [-6, 5, 8], look: [-6, 1.2, 0] },
    pouring: { pos: [0, 5, 8], look: [0, 1.2, 0] },
    cooling: { pos: [6, 5, 8], look: [6, 1.2, 0] },
    inspection: { pos: [12, 5, 8], look: [12, 1.2, 0] },
  };

  const controlsRef = useRef<any>(null);

  useFrame((state, delta) => {
    const preset = cameraPresets[targetStation] || cameraPresets.overview;
    const lerpFactor = Math.min(delta * 2.8, 1);

    state.camera.position.lerp(new THREE.Vector3(...preset.pos), lerpFactor);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(new THREE.Vector3(...preset.look), lerpFactor);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={4}
      maxDistance={45}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

// --- Andon Status Light Tower ---
function AndonTower({
  position,
  status = "normal",
}: {
  position: [number, number, number];
  status: "normal" | "warning" | "critical";
}) {
  const redRef = useRef<Mesh>(null);
  const amberRef = useRef<Mesh>(null);
  const greenRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (redRef.current) {
      const mat = redRef.current.material as THREE.MeshStandardMaterial;
      if (status === "critical") {
        mat.emissive.set("#ff2222");
        mat.emissiveIntensity = 2.0 + Math.sin(t * 8) * 1.5;
      } else {
        mat.emissive.set("#330000");
        mat.emissiveIntensity = 0.2;
      }
    }
    if (amberRef.current) {
      const mat = amberRef.current.material as THREE.MeshStandardMaterial;
      if (status === "warning") {
        mat.emissive.set("#ff9900");
        mat.emissiveIntensity = 1.8 + Math.sin(t * 6) * 1.2;
      } else {
        mat.emissive.set("#331a00");
        mat.emissiveIntensity = 0.2;
      }
    }
    if (greenRef.current) {
      const mat = greenRef.current.material as THREE.MeshStandardMaterial;
      if (status === "normal") {
        mat.emissive.set("#22ee66");
        mat.emissiveIntensity = 1.5;
      } else {
        mat.emissive.set("#00220a");
        mat.emissiveIntensity = 0.2;
      }
    }
  });

  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 12]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.1, 16]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>
      {/* Red Tier */}
      <mesh ref={redRef} position={[0, 2.3, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.14, 16]} />
        <meshStandardMaterial color="#880000" emissive="#ff2222" emissiveIntensity={0.2} roughness={0.3} />
      </mesh>
      {/* Amber Tier */}
      <mesh ref={amberRef} position={[0, 2.14, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.14, 16]} />
        <meshStandardMaterial color="#884400" emissive="#ff9900" emissiveIntensity={0.2} roughness={0.3} />
      </mesh>
      {/* Green Tier */}
      <mesh ref={greenRef} position={[0, 1.98, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.14, 16]} />
        <meshStandardMaterial color="#00551a" emissive="#22ee66" emissiveIntensity={1.2} roughness={0.3} />
      </mesh>
      {/* Sounder horn */}
      <mesh position={[0, 2.45, 0]}>
        <cylinderGeometry args={[0.08, 0.05, 0.12, 16]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>
    </group>
  );
}

// --- Station 1: Induction Melting Furnace Bay (X = -12) ---
function InductionMeltingBay({
  telemetry,
  onSelect,
}: {
  telemetry: FactoryTelemetry;
  onSelect: () => void;
}) {
  const bathRef = useRef<Mesh>(null);
  const coilRef = useRef<Group>(null);
  const glowLightRef = useRef<THREE.PointLight>(null);
  const steamRef = useRef<Group>(null);
  const tiltCylinderRef = useRef<Group>(null);

  const status: "normal" | "warning" | "critical" =
    telemetry.meltTemp < 1390 || telemetry.furnaceVibration > 0.08
      ? "critical"
      : telemetry.meltTemp < 1420
      ? "warning"
      : "normal";

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const tempN = THREE.MathUtils.clamp((telemetry.meltTemp - 1100) / 450, 0, 1);
    const powerN = THREE.MathUtils.clamp(telemetry.inductionPower / 1200, 0, 1);

    // Molten bath heat & EM stirring flicker
    if (bathRef.current) {
      const mat = bathRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(getHeatColor(tempN, mat.emissive));
      const flicker = 0.88 + 0.08 * Math.sin(t * 11) + 0.04 * Math.sin(t * 27);
      mat.emissiveIntensity = (0.5 + 2.4 * (0.4 * powerN + 0.6 * tempN)) * flicker;
    }
    if (glowLightRef.current) {
      glowLightRef.current.intensity = 3 + 8 * powerN * tempN;
    }

    // Copper induction coil pulses
    if (coilRef.current) {
      coilRef.current.children.forEach((mesh, i) => {
        const mat = (mesh as Mesh).material as THREE.MeshStandardMaterial;
        const phase = Math.sin(t * 8 - i * 0.4);
        mat.emissiveIntensity = 0.1 + 1.8 * powerN * (0.6 + 0.4 * phase);
      });
    }

    // Hot exhaust gas puffs
    if (steamRef.current) {
      steamRef.current.children.forEach((puff, i) => {
        const rise = (t * 0.4 + i / steamRef.current!.children.length) % 1;
        puff.position.y = 2.6 + rise * 1.8;
        puff.position.x = -12 + Math.sin(t * 1.5 + i * 2) * 0.18;
        puff.position.z = -0.5 + Math.cos(t * 1.2 + i * 1.5) * 0.18;
        const mat = (puff as Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = (1 - rise) * 0.16 * powerN;
        const scale = 0.3 + rise * 0.9;
        puff.scale.set(scale, scale, scale);
      });
    }
  });

  return (
    <group position={[-12, 0, 0]}>
      {/* Foundation plinth */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.4, 4.2]} />
        <meshStandardMaterial color="#282a2e" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* Plinth yellow border */}
      <mesh position={[0, -0.19, 0]}>
        <ringGeometry args={[1.9, 2.05, 32]} />
        <meshStandardMaterial {...SAFETY_YELLOW} side={THREE.DoubleSide} />
      </mesh>

      {/* Furnace Body Tilt Trunnions */}
      <group position={[0, 0.9, 0]}>
        {/* Steel Crucible Shell (Cutaway to reveal interior) */}
        <mesh>
          <cylinderGeometry args={[1.2, 1.2, 2.4, 48, 1, true, 0.9, Math.PI * 2 - 1.8]} />
          <meshStandardMaterial {...STEEL} side={THREE.DoubleSide} />
        </mesh>
        {/* Top & Bottom Reinforcement Torus Rings */}
        <mesh position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.22, 0.08, 12, 48]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[0, -1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.22, 0.08, 12, 48]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>

        {/* Refractory lining */}
        <mesh>
          <cylinderGeometry args={[1.06, 1.06, 2.34, 40, 1, true, 0.85, Math.PI * 2 - 1.7]} />
          <meshStandardMaterial {...REFRACTORY} side={THREE.DoubleSide} />
        </mesh>

        {/* Molten Liquid Iron Bath */}
        <mesh ref={bathRef} position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.95, 32]} />
          <meshStandardMaterial color="#ff4400" emissive="#ff6600" emissiveIntensity={2.5} roughness={0.2} />
        </mesh>
        <pointLight ref={glowLightRef} position={[0, 0.8, 0]} color="#ff7700" intensity={6} distance={6} />

        {/* Copper Induction Coils */}
        <group ref={coilRef}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[0, -0.9 + i * 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.12, 0.035, 12, 48]} />
              <meshStandardMaterial {...COPPER} emissive="#ff3300" emissiveIntensity={0.2} />
            </mesh>
          ))}
        </group>

        {/* Pouring Spout Lip */}
        <mesh position={[0, 1.15, 1.25]} rotation={[0.4, 0, 0]}>
          <coneGeometry args={[0.25, 0.5, 16]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      </group>

      {/* Hydraulic Tilt Cylinders */}
      <group position={[-1.4, 0.4, 0]} rotation={[0, 0, 0.2]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 1.4, 16]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.9, 16]} />
          <meshStandardMaterial {...STEEL_LIGHT} />
        </mesh>
      </group>

      {/* Overhead Exhaust Hood & Fume Duct */}
      <group position={[0, 2.4, -0.5]}>
        <mesh position={[0, 0, 0]}>
          <coneGeometry args={[1.4, 0.8, 24, 1, true]} />
          <meshStandardMaterial {...STEEL_DARK} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 1.0, 16]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      </group>

      {/* Exhaust Steam/Gas Puffs */}
      <group ref={steamRef}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0, 2.6, -0.5]}>
            <sphereGeometry args={[0.24, 10, 10]} />
            <meshStandardMaterial color="#dcd5c7" transparent opacity={0.12} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* SCADA Console & Electric Busbar Inverter Cabinet */}
      <group position={[1.8, 0.5, -1.2]}>
        <mesh>
          <boxGeometry args={[0.8, 1.6, 0.6]} />
          <meshStandardMaterial color="#2c333a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Screen */}
        <mesh position={[0, 0.35, 0.31]}>
          <planeGeometry args={[0.55, 0.35]} />
          <meshStandardMaterial color="#0f1f14" emissive="#10b981" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Andon Tower */}
      <AndonTower position={[-1.7, 0, 1.6]} status={status} />

      {/* Interactive Station Click Beacon */}
      <mesh position={[0, 3.4, 0]} onClick={onSelect}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} wireframe />
      </mesh>
    </group>
  );
}

// --- Station 2: Green Sand Molding Station (X = -6) ---
function GreenSandMoldingBay({
  telemetry,
  onSelect,
}: {
  telemetry: FactoryTelemetry;
  onSelect: () => void;
}) {
  const platenRef = useRef<Group>(null);
  const hopperGateRef = useRef<Mesh>(null);

  const status: "normal" | "warning" | "critical" =
    telemetry.sandMoisture > 4.8 || telemetry.sandMoisture < 2.8
      ? "critical"
      : telemetry.sandMoisture > 4.2 || telemetry.sandMoisture < 3.0
      ? "warning"
      : "normal";

  useFrame((state) => {
    const t = state.clock.elapsedTime * telemetry.simulationSpeed;
    // Squeeze compaction stroke cycle
    if (platenRef.current) {
      const stroke = (Math.sin(t * 1.8) + 1) * 0.5; // 0 (up) to 1 (compressed)
      platenRef.current.position.y = 1.3 - stroke * 0.45;
    }
  });

  return (
    <group position={[-6, 0, 0]}>
      {/* Plinth */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.4, 4.0]} />
        <meshStandardMaterial color="#282a2e" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* 4 Heavy-Duty Hydraulic Tie-Bar Columns */}
      {[-1.2, 1.2].map((x) =>
        [-1.2, 1.2].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.6, z]}>
            <cylinderGeometry args={[0.09, 0.09, 3.4, 16]} />
            <meshStandardMaterial {...STEEL_LIGHT} />
          </mesh>
        ))
      )}

      {/* Machine Top Crown Arch */}
      <mesh position={[0, 3.3, 0]}>
        <boxGeometry args={[2.7, 0.4, 2.7]} />
        <meshStandardMaterial color="#2d333b" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Overhead Sand Storage Hopper */}
      <group position={[0, 4.4, 0]}>
        <mesh position={[0, 0, 0]}>
          <coneGeometry args={[1.3, 1.8, 4, 1, false, Math.PI / 4]} />
          <meshStandardMaterial color="#8c7853" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[1.8, 0.6, 1.8]} />
          <meshStandardMaterial color="#333940" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* Vertical Squeeze Cylinder Head */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 1.4, 24]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>

      {/* Moving Squeeze Platen */}
      <group ref={platenRef} position={[0, 1.3, 0]}>
        <mesh>
          <boxGeometry args={[1.9, 0.22, 1.9]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        {/* Pattern plate impression */}
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[1.6, 0.08, 1.6]} />
          <meshStandardMaterial color="#b2823b" metalness={0.3} roughness={0.7} />
        </mesh>
      </group>

      {/* Drag & Cope Flask Mold Boxes on Assembly Table */}
      <group position={[0, 0.35, 0]}>
        {/* Bottom Drag Flask */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.8, 0.45, 1.8]} />
          <meshStandardMaterial color="#38414a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Packed Green Sand inside mold */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1.6, 0.42, 1.6]} />
          <meshStandardMaterial color="#c29d66" roughness={0.96} metalness={0.02} />
        </mesh>
        {/* Mold Sprue Cavity Holes */}
        <mesh position={[-0.4, 0.28, -0.3]}>
          <cylinderGeometry args={[0.08, 0.06, 0.2, 16]} />
          <meshStandardMaterial color="#1a1c1e" roughness={0.9} />
        </mesh>
        <mesh position={[0.4, 0.28, 0.3]}>
          <cylinderGeometry args={[0.1, 0.08, 0.2, 16]} />
          <meshStandardMaterial color="#1a1c1e" roughness={0.9} />
        </mesh>
      </group>

      {/* Electronic Sand Moisture TDR Sensor Probe */}
      <group position={[1.2, 0.6, 0.5]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.2, 0.3, 0.15]} />
          <meshStandardMaterial color="#1a202c" />
        </mesh>
        {/* Cable */}
        <mesh position={[-0.3, -0.1, 0]} rotation={[0, 0, 0.5]}>
          <cylinderGeometry args={[0.015, 0.015, 0.7, 8]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* Andon Tower */}
      <AndonTower position={[-1.7, 0, 1.6]} status={status} />

      {/* Click Beacon */}
      <mesh position={[0, 4.0, 0]} onClick={onSelect}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} wireframe />
      </mesh>
    </group>
  );
}

// --- Station 3: Automated Pouring Station (X = 0) ---
function AutomatedPouringBay({
  telemetry,
  onSelect,
}: {
  telemetry: FactoryTelemetry;
  onSelect: () => void;
}) {
  const streamRef = useRef<Mesh>(null);
  const streamGlowRef = useRef<THREE.PointLight>(null);
  const stopperRef = useRef<Group>(null);
  const sparksRef = useRef<Group>(null);

  const status: "normal" | "warning" | "critical" =
    telemetry.defectRisk > 0.4 || telemetry.pourTemp < 1380
      ? "critical"
      : telemetry.defectRisk > 0.15 || telemetry.pourTemp < 1400
      ? "warning"
      : "normal";

  useFrame((state) => {
    const t = state.clock.elapsedTime * telemetry.simulationSpeed;

    // Stopper rod actuator oscillation
    if (stopperRef.current) {
      stopperRef.current.position.y = 1.6 + Math.sin(t * 1.5) * 0.05;
    }

    // Molten pouring stream pulsating flow
    if (streamRef.current) {
      const active = telemetry.conveyorRunning;
      streamRef.current.visible = active;
      if (active) {
        const mat = streamRef.current.material as THREE.MeshStandardMaterial;
        const pulse = 0.9 + 0.1 * Math.sin(t * 14);
        mat.emissiveIntensity = 2.4 * pulse;
        const scaleX = 1 + 0.15 * Math.sin(t * 19);
        streamRef.current.scale.set(scaleX, 1, scaleX);
      }
    }

    if (streamGlowRef.current) {
      streamGlowRef.current.intensity = telemetry.conveyorRunning ? 5.5 + Math.sin(t * 12) * 1.5 : 1;
    }

    // Dynamic spark particles bouncing off mold sprue basin
    if (sparksRef.current) {
      sparksRef.current.visible = telemetry.conveyorRunning;
      sparksRef.current.children.forEach((spark, i) => {
        const life = (t * 2.2 + i * 0.18) % 1;
        const angle = i * 0.8 + t * 0.5;
        const dist = life * 0.45;
        spark.position.x = Math.cos(angle) * dist;
        spark.position.z = Math.sin(angle) * dist;
        spark.position.y = 0.42 + (life - life * life * 2.2) * 0.55;
        const mat = (spark as Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = 1 - life;
        spark.scale.setScalar(0.04 * (1 - life * 0.6));
      });
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Plinth */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.4, 4.0]} />
        <meshStandardMaterial color="#282a2e" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Overhead Monorail Pouring Ladle Rig */}
      <group position={[0, 2.3, 0]}>
        {/* Support Gantries */}
        <mesh position={[-1.2, 0.5, 0]}>
          <boxGeometry args={[0.15, 2.8, 0.15]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[1.2, 0.5, 0]}>
          <boxGeometry args={[0.15, 2.8, 0.15]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[2.6, 0.2, 0.2]} />
          <meshStandardMaterial color="#d97706" metalness={0.5} roughness={0.4} />
        </mesh>

        {/* Bottom-Pour Ladle Body */}
        <group position={[0, 0, 0]}>
          {/* Outer Rolled Shell */}
          <mesh>
            <cylinderGeometry args={[0.65, 0.5, 1.2, 32]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          {/* Refractory Inner Liner */}
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.55, 0.42, 1.15, 32]} />
            <meshStandardMaterial {...REFRACTORY} />
          </mesh>
          {/* Molten Metal pool in ladle */}
          <mesh position={[0, 0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.5, 24]} />
            <meshStandardMaterial color="#ff5500" emissive="#ff7700" emissiveIntensity={2.2} />
          </mesh>

          {/* Stopper Rod Mechanism */}
          <group ref={stopperRef} position={[0, 0.2, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 1.3, 16]} />
              <meshStandardMaterial {...STEEL_LIGHT} />
            </mesh>
            {/* Actuator linkage arm */}
            <mesh position={[0.2, 0.8, 0]}>
              <boxGeometry args={[0.4, 0.08, 0.08]} />
              <meshStandardMaterial {...STEEL_DARK} />
            </mesh>
          </group>

          {/* Ladle Nozzle */}
          <mesh position={[0, -0.65, 0]}>
            <cylinderGeometry args={[0.09, 0.06, 0.15, 16]} />
            <meshStandardMaterial {...REFRACTORY} />
          </mesh>
        </group>
      </group>

      {/* Continuous Molten Iron Pouring Stream */}
      <mesh ref={streamRef} position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.038, 0.032, 1.4, 16]} />
        <meshStandardMaterial color="#ffaa00" emissive="#ff8800" emissiveIntensity={2.8} />
      </mesh>
      <pointLight ref={streamGlowRef} position={[0, 0.7, 0]} color="#ff7700" intensity={6} distance={5} />

      {/* Mold Sprue Basin beneath stream */}
      <group position={[0, 0.35, 0]}>
        <mesh>
          <boxGeometry args={[1.5, 0.35, 1.5]} />
          <meshStandardMaterial color="#38414a" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.18, 0.12, 0.08, 24]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff6600" emissiveIntensity={2.0} />
        </mesh>
      </group>

      {/* Spark Emitter Particles */}
      <group ref={sparksRef} position={[0, 0.4, 0]}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#ffea75" emissive="#ffa500" emissiveIntensity={3} transparent />
          </mesh>
        ))}
      </group>

      {/* Dual-Color Optical Pyrometer Camera Aimed at Stream */}
      <group position={[1.4, 1.2, 0.8]} rotation={[-0.2, 0.6, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.35, 16]} />
          <meshStandardMaterial color="#2d3748" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Mounting stand */}
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 12]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        {/* Optical Lens */}
        <mesh position={[0, 0, -0.18]}>
          <circleGeometry args={[0.05, 16]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Andon Tower */}
      <AndonTower position={[-1.7, 0, 1.6]} status={status} />

      {/* Click Beacon */}
      <mesh position={[0, 3.8, 0]} onClick={onSelect}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} wireframe />
      </mesh>
    </group>
  );
}

// --- Station 4: Continuous Cooling Tunnel & Shakeout Bay (X = +6) ---
function CoolingShakeoutBay({
  telemetry,
  onSelect,
}: {
  telemetry: FactoryTelemetry;
  onSelect: () => void;
}) {
  const fan1Ref = useRef<Group>(null);
  const fan2Ref = useRef<Group>(null);
  const shakeoutGrateRef = useRef<Group>(null);

  const status: "normal" | "warning" | "critical" =
    telemetry.coolingSurfaceTemp > 650
      ? "warning"
      : telemetry.solidificationPct < 70
      ? "warning"
      : "normal";

  useFrame((state) => {
    const t = state.clock.elapsedTime * telemetry.simulationSpeed;
    // Spinning roof ventilation fan cowls
    if (fan1Ref.current) fan1Ref.current.rotation.y += 0.12;
    if (fan2Ref.current) fan2Ref.current.rotation.y += 0.12;

    // Vibrating shakeout grid oscillation
    if (shakeoutGrateRef.current) {
      shakeoutGrateRef.current.position.y = 0.35 + Math.sin(t * 32) * 0.015;
      shakeoutGrateRef.current.position.x = Math.cos(t * 28) * 0.012;
    }
  });

  return (
    <group position={[6, 0, 0]}>
      {/* Plinth */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.4, 4.0]} />
        <meshStandardMaterial color="#282a2e" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Insulated Sheet-Metal Cooling Enclosure Hood */}
      <group position={[-0.6, 0.9, 0]}>
        <mesh>
          <boxGeometry args={[2.5, 1.6, 1.8]} />
          <meshStandardMaterial color="#3b424d" metalness={0.65} roughness={0.4} />
        </mesh>
        {/* Stiffening ribs */}
        {[-0.8, 0, 0.8].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.06, 1.65, 1.85]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
        ))}

        {/* Exhaust Ventilation Cowls with Fans */}
        {[-0.6, 0.6].map((x, idx) => (
          <group key={x} position={[x, 1.0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.28, 0.32, 0.4, 16]} />
              <meshStandardMaterial {...STEEL_DARK} />
            </mesh>
            <group ref={idx === 0 ? fan1Ref : fan2Ref} position={[0, 0.15, 0]}>
              <mesh rotation={[0, 0, 0]}>
                <boxGeometry args={[0.45, 0.02, 0.08]} />
                <meshStandardMaterial color="#10b981" />
              </mesh>
              <mesh rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[0.45, 0.02, 0.08]} />
                <meshStandardMaterial color="#10b981" />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* Mechanical Vibration Shakeout Grate Table */}
      <group ref={shakeoutGrateRef} position={[1.2, 0.35, 0]}>
        {/* Grate frame */}
        <mesh>
          <boxGeometry args={[1.6, 0.25, 1.6]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        {/* Slotted bars */}
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[-0.6 + i * 0.2, 0.13, 0]}>
            <boxGeometry args={[0.05, 0.04, 1.5]} />
            <meshStandardMaterial {...STEEL_LIGHT} />
          </mesh>
        ))}

        {/* Counterweight Eccentric Motor */}
        <mesh position={[0, -0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.4, 16]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {/* Helical Isolation Springs */}
        {[-0.6, 0.6].map((x) =>
          [-0.6, 0.6].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, -0.25, z]}>
              <cylinderGeometry args={[0.08, 0.08, 0.25, 12]} />
              <meshStandardMaterial {...COPPER} />
            </mesh>
          ))
        )}
      </group>

      {/* Hot Solidified Casting emerging onto grate (Glowing dull red) */}
      <mesh position={[1.2, 0.58, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 0.28, 24]} />
        <meshStandardMaterial color="#551a08" emissive="#992200" emissiveIntensity={0.8} metalness={0.7} />
      </mesh>

      {/* Return Sand Chute Hopper Underneath */}
      <mesh position={[1.2, -0.15, 0]}>
        <coneGeometry args={[0.8, 0.5, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color="#806b43" roughness={0.9} />
      </mesh>

      {/* Andon Tower */}
      <AndonTower position={[-1.7, 0, 1.6]} status={status} />

      {/* Click Beacon */}
      <mesh position={[0, 3.4, 0]} onClick={onSelect}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} wireframe />
      </mesh>
    </group>
  );
}

// --- Station 5: Robotic Visual QC Station (X = +12) ---
function RoboticVisualQCBay({
  telemetry,
  onSelect,
}: {
  telemetry: FactoryTelemetry;
  onSelect: () => void;
}) {
  const armShoulderRef = useRef<Group>(null);
  const armElbowRef = useRef<Group>(null);
  const armWristRef = useRef<Group>(null);
  const laserBeamRef = useRef<Mesh>(null);
  const diverterRef = useRef<Group>(null);

  const isDefect = telemetry.resnetSigmoid > 0.5 || telemetry.anomalyActive;
  const status: "normal" | "warning" | "critical" = isDefect ? "critical" : "normal";

  useFrame((state) => {
    const t = state.clock.elapsedTime * telemetry.simulationSpeed;

    // Articulated 6-axis robot inspection kinematic loop
    if (armShoulderRef.current) {
      armShoulderRef.current.rotation.y = Math.sin(t * 0.8) * 0.25;
    }
    if (armElbowRef.current) {
      armElbowRef.current.rotation.z = -0.5 + Math.sin(t * 1.2) * 0.15;
    }
    if (armWristRef.current) {
      armWristRef.current.rotation.x = Math.sin(t * 1.5) * 0.2;
    }

    // Blue/Cyan laser scanning pyramid sweeping over the casting
    if (laserBeamRef.current) {
      const mat = laserBeamRef.current.material as THREE.MeshStandardMaterial;
      const scan = 0.5 + 0.5 * Math.sin(t * 5);
      mat.opacity = 0.15 + 0.2 * scan;
      mat.emissive.set(isDefect ? "#ef4444" : "#06b6d4");
    }

    // Pneumatic diverter arm swings to push defective casting into scrap bin
    if (diverterRef.current) {
      const targetAngle = isDefect ? -0.85 : 0;
      diverterRef.current.rotation.y = THREE.MathUtils.lerp(
        diverterRef.current.rotation.y,
        targetAngle,
        0.12
      );
    }
  });

  return (
    <group position={[12, 0, 0]}>
      {/* Plinth */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.4, 4.0]} />
        <meshStandardMaterial color="#282a2e" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* 6-Axis Articulated Industrial Robot Arm */}
      <group position={[-0.8, 0, -0.9]}>
        {/* Robot Pedestal */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.35, 0.42, 0.7, 24]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Turntable Base */}
        <mesh position={[0, 0.74, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.1, 24]} />
          <meshStandardMaterial color="#ea580c" metalness={0.5} roughness={0.4} />
        </mesh>

        {/* Shoulder Joint */}
        <group ref={armShoulderRef} position={[0, 0.85, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
          {/* Lower Arm Boom */}
          <mesh position={[0, 0.7, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.2, 1.1, 0.25]} />
            <meshStandardMaterial color="#ea580c" metalness={0.4} roughness={0.5} />
          </mesh>

          {/* Elbow Joint */}
          <group ref={armElbowRef} position={[0.32, 1.25, 0]}>
            <mesh>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshStandardMaterial {...STEEL_DARK} />
            </mesh>
            {/* Forearm Boom */}
            <mesh position={[0.4, 0.1, 0]} rotation={[0, 0, -0.8]}>
              <boxGeometry args={[0.16, 0.9, 0.2]} />
              <meshStandardMaterial color="#ea580c" metalness={0.4} roughness={0.5} />
            </mesh>

            {/* Wrist & Inspection End-Effector Tool */}
            <group ref={armWristRef} position={[0.7, 0.45, 0]}>
              {/* Tool Flange */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.1, 0.1, 0.12, 16]} />
                <meshStandardMaterial {...STEEL_LIGHT} />
              </mesh>
              {/* High-Resolution Telecentric GigE Vision Camera */}
              <mesh position={[0, -0.2, 0]}>
                <boxGeometry args={[0.15, 0.3, 0.15]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>
              {/* Circular Ring LED Illuminator */}
              <mesh position={[0, -0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.12, 0.025, 12, 24]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.5} />
              </mesh>

              {/* Laser Line Scanning Sheet / Pyramid */}
              <mesh ref={laserBeamRef} position={[0, -0.9, 0]}>
                <coneGeometry args={[0.55, 1.1, 4, 1, true, Math.PI / 4]} />
                <meshStandardMaterial
                  color="#06b6d4"
                  emissive="#06b6d4"
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.25}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* Conveyor Inspection Bed */}
      <group position={[0, 0.35, 0]}>
        <mesh>
          <boxGeometry args={[2.8, 0.35, 1.4]} />
          <meshStandardMaterial color="#38414a" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Finished Part undergoing inspection */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.32, 0.38, 0.24, 24]} />
        <meshStandardMaterial
          color={isDefect ? "#991b1b" : "#475569"}
          metalness={0.8}
          roughness={0.3}
          emissive={isDefect ? "#ef4444" : "#000000"}
          emissiveIntensity={isDefect ? 0.6 : 0}
        />
      </mesh>

      {/* Pneumatic Sorter Diverter Gate */}
      <group ref={diverterRef} position={[0.8, 0.6, 0.6]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.3, 12]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[-0.45, 0, 0]}>
          <boxGeometry args={[0.9, 0.18, 0.06]} />
          <meshStandardMaterial {...SAFETY_YELLOW} />
        </mesh>
      </group>

      {/* Approved Castings Pallet / Container (Straight Ahead) */}
      <group position={[1.8, 0.15, 0]}>
        <mesh>
          <boxGeometry args={[0.9, 0.5, 1.1]} />
          <meshStandardMaterial color="#15803d" metalness={0.3} roughness={0.6} />
        </mesh>
      </group>

      {/* Scrap / Rework Container (Diverted Track) */}
      <group position={[0.8, 0.15, 1.4]}>
        <mesh>
          <boxGeometry args={[0.9, 0.5, 0.9]} />
          <meshStandardMaterial color="#b91c1c" metalness={0.3} roughness={0.6} />
        </mesh>
      </group>

      {/* Andon Tower */}
      <AndonTower position={[-1.7, 0, 1.6]} status={status} />

      {/* Click Beacon */}
      <mesh position={[0, 3.4, 0]} onClick={onSelect}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} wireframe />
      </mesh>
    </group>
  );
}

// --- Heavy Roller Conveyor & Moving Castings Transport System ---
function FactoryConveyorTrack({
  telemetry,
}: {
  telemetry: FactoryTelemetry;
}) {
  const rollerGroupRef = useRef<Group>(null);
  const partsGroupRef = useRef<Group>(null);

  const partCount = 9;
  const startX = -14.5;
  const endX = 14.5;
  const totalLength = endX - startX;

  useFrame((state, delta) => {
    if (!telemetry.conveyorRunning) return;
    const speed = 1.2 * telemetry.simulationSpeed;

    // Rotate all steel rollers
    if (rollerGroupRef.current) {
      rollerGroupRef.current.children.forEach((roller) => {
        roller.rotation.z -= delta * speed * 2.5;
      });
    }

    // Translate mold flasks and castings continuously along the line
    if (partsGroupRef.current) {
      partsGroupRef.current.children.forEach((part, i) => {
        part.position.x += delta * speed;
        if (part.position.x > endX) {
          part.position.x = startX;
        }

        // Appearance changes as part moves through stations
        const x = part.position.x;
        const mesh = part.children[0] as Mesh;
        if (mesh && mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (x < -6) {
            // Raw molding flask
            mat.color.set("#c29d66");
            mat.emissive.set("#000000");
          } else if (x >= -6 && x < 0) {
            // Prepared sand mold with sprue
            mat.color.set("#b08b54");
            mat.emissive.set("#000000");
          } else if (x >= 0 && x < 6) {
            // Freshly poured molten metal inside mold
            mat.color.set("#d97706");
            mat.emissive.set("#ff5500");
            mat.emissiveIntensity = 1.6;
          } else if (x >= 6 && x < 11) {
            // Cooling cast iron
            mat.color.set("#475569");
            mat.emissive.set("#aa2200");
            mat.emissiveIntensity = 0.5;
          } else {
            // Finished cast part at QC inspection
            if (telemetry.anomalyActive || telemetry.resnetSigmoid > 0.5) {
              mat.color.set("#991b1b");
              mat.emissive.set("#ef4444");
              mat.emissiveIntensity = 0.8;
            } else {
              mat.color.set("#334155");
              mat.emissive.set("#000000");
            }
          }
        }
      });
    }
  });

  return (
    <group position={[0, -0.15, 0]}>
      {/* Heavy Steel Longitudinal Conveyor Side Rails */}
      <mesh position={[0, 0, -0.65]}>
        <boxGeometry args={[totalLength + 2, 0.18, 0.1]} />
        <meshStandardMaterial {...SAFETY_YELLOW} />
      </mesh>
      <mesh position={[0, 0, 0.65]}>
        <boxGeometry args={[totalLength + 2, 0.18, 0.1]} />
        <meshStandardMaterial {...SAFETY_YELLOW} />
      </mesh>

      {/* Support Legs */}
      {Array.from({ length: 11 }, (_, i) => {
        const x = startX + i * (totalLength / 10);
        return (
          <group key={i} position={[x, -0.2, 0]}>
            <mesh position={[0, 0, -0.65]}>
              <boxGeometry args={[0.1, 0.4, 0.1]} />
              <meshStandardMaterial {...STEEL_DARK} />
            </mesh>
            <mesh position={[0, 0, 0.65]}>
              <boxGeometry args={[0.1, 0.4, 0.1]} />
              <meshStandardMaterial {...STEEL_DARK} />
            </mesh>
          </group>
        );
      })}

      {/* Motorized Rollers */}
      <group ref={rollerGroupRef}>
        {Array.from({ length: 58 }, (_, i) => {
          const x = startX + i * 0.5;
          return (
            <mesh key={i} position={[x, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 1.2, 12]} />
              <meshStandardMaterial {...STEEL_LIGHT} />
            </mesh>
          );
        })}
      </group>

      {/* Traveling Molds & Castings */}
      <group ref={partsGroupRef}>
        {Array.from({ length: partCount }, (_, i) => {
          const x = startX + i * (totalLength / partCount);
          return (
            <group key={i} position={[x, 0.24, 0]}>
              <mesh>
                <boxGeometry args={[0.65, 0.28, 0.65]} />
                <meshStandardMaterial color="#c29d66" roughness={0.7} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// --- Factory Architectural Shell, Lighting & Overhead Cranes ---
function FactoryArchitecture() {
  return (
    <group>
      {/* Industrial Polished Epoxy Floor */}
      <mesh position={[0, -0.61, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[38, 22]} />
        <meshStandardMaterial {...FLOOR_MAT} roughness={0.75} metalness={0.1} />
      </mesh>

      {/* Walkway Safety Perimeter Painted Stripes */}
      <mesh position={[0, -0.6, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 0.2]} />
        <meshStandardMaterial {...SAFETY_YELLOW} />
      </mesh>
      <mesh position={[0, -0.6, 2.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 0.2]} />
        <meshStandardMaterial {...SAFETY_YELLOW} />
      </mesh>

      {/* Rear Structural Steel Columns & Wall Trusses */}
      {[-16, -10, -4, 2, 8, 14].map((x) => (
        <group key={x} position={[x, 3.0, -4.8]}>
          {/* Main H-beam column */}
          <mesh>
            <boxGeometry args={[0.35, 7.4, 0.35]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
          {/* Base plate */}
          <mesh position={[0, -3.6, 0]}>
            <boxGeometry args={[0.7, 0.15, 0.7]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
          {/* Crane rail bracket corbel */}
          <mesh position={[0, 1.6, 0.4]}>
            <boxGeometry args={[0.3, 0.4, 0.6]} />
            <meshStandardMaterial {...SAFETY_YELLOW} />
          </mesh>
        </group>
      ))}

      {/* Overhead Yellow Heavy-Duty Monorail Crane Girder */}
      <group position={[0, 4.8, -4.4]}>
        <mesh>
          <boxGeometry args={[36, 0.45, 0.3]} />
          <meshStandardMaterial {...SAFETY_YELLOW} />
        </mesh>
        {/* Trolley Hoist Body */}
        <mesh position={[-4.5, -0.35, 0]}>
          <boxGeometry args={[1.2, 0.4, 0.5]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      </group>

      {/* High-Bay Industrial Sodium / LED Floodlights */}
      {[-12, -6, 0, 6, 12].map((x) => (
        <group key={x} position={[x, 6.2, 0]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.4, 0.3, 16, 1, true]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
          <pointLight color="#fff0d4" intensity={2.2} distance={14} />
        </group>
      ))}
    </group>
  );
}

// --- Main 3D Canvas Factory Scene Component ---
export function FactorySimulator3D({
  telemetry,
  selectedStation,
  onSelectStation,
}: {
  telemetry: FactoryTelemetry;
  selectedStation: StationKey;
  onSelectStation: (station: StationKey) => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-[#E7DBB8]">
      <Canvas
        camera={{ position: [0, 14, 26], fov: 42, near: 0.1, far: 120 }}
        shadows
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#E7DBB8"]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[10, 22, 14]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <directionalLight position={[-12, 10, -10]} intensity={0.4} color="#ffd49e" />

        {/* Dynamic Camera Navigation Controller */}
        <CameraRig targetStation={selectedStation} />

        {/* Factory Architecture & Floor */}
        <FactoryArchitecture />

        {/* Central Conveyor System */}
        <FactoryConveyorTrack telemetry={telemetry} />

        {/* 5 Production Bays */}
        <InductionMeltingBay telemetry={telemetry} onSelect={() => onSelectStation("furnace")} />
        <GreenSandMoldingBay telemetry={telemetry} onSelect={() => onSelectStation("molding")} />
        <AutomatedPouringBay telemetry={telemetry} onSelect={() => onSelectStation("pouring")} />
        <CoolingShakeoutBay telemetry={telemetry} onSelect={() => onSelectStation("cooling")} />
        <RoboticVisualQCBay telemetry={telemetry} onSelect={() => onSelectStation("inspection")} />

        {/* Subtle Ground Shadows */}
        <ContactShadows position={[0, -0.6, 0]} opacity={0.65} scale={40} blur={2.2} far={8} />
      </Canvas>

      {/* Floating 3D Badge Watermark */}
      <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 rounded-md border border-border/80 bg-background/85 px-2.5 py-1 text-[11px] font-mono text-muted-foreground backdrop-blur">
        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>R3F Real-Time Physics & Kinematics Engine · 60 FPS</span>
      </div>
    </div>
  );
}

export default FactorySimulator3D;
