"use client";

import { RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";

export type Mood = "idle" | "work" | "rest" | "play" | "talk";

const shell = "#1c232c";
const metal = "#d7dee6";

function Robot({ mood }: { mood: Mood }) {
  const rig = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const antenna = useRef<Group>(null);
  const scan = useRef<Mesh>(null);
  const visor = useRef<MeshStandardMaterial>(null);
  const core = useRef<MeshStandardMaterial>(null);
  const ring = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const node = rig.current;
    if (!node) return;
    const pace = mood === "play" ? 7 : mood === "work" ? 4.2 : mood === "talk" ? 2.4 : 1.6;
    const hop = mood === "play" ? Math.abs(Math.sin(t * 5)) * 0.18 : Math.sin(t * 1.5) * 0.03;
    node.position.y = -0.2 + hop;
    node.position.x = Math.sin(t * 0.45) * 0.03;
    node.rotation.z = mood === "rest" ? 0.22 : Math.sin(t * 0.7) * 0.04;
    node.rotation.y = mood === "work" ? Math.sin(t * 0.9) * 0.45 : Math.sin(t * 0.35) * 0.2;

    if (head.current) {
      head.current.rotation.y = mood === "rest" ? 0.15 : Math.sin(t * 0.8) * (mood === "talk" ? 0.28 : 0.18);
      head.current.rotation.x = mood === "rest" ? 0.42 : Math.sin(t * pace) * 0.06;
    }
    if (antenna.current) antenna.current.rotation.z = Math.sin(t * 2.2) * (mood === "play" ? 0.35 : 0.12);

    const swing =
      mood === "rest" ? 0.2 : mood === "talk" ? 0.35 + Math.sin(t * 3) * 0.55 : Math.sin(t * pace) * (mood === "play" ? 0.9 : 0.45);
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = mood === "talk" ? -0.2 : -swing;

    const step = mood === "rest" ? 0 : Math.sin(t * pace) * (mood === "play" ? 0.55 : 0.28);
    if (legL.current) legL.current.rotation.x = step;
    if (legR.current) legR.current.rotation.x = -step;

    if (scan.current) scan.current.position.x = Math.sin(t * (mood === "work" ? 4 : 1.8)) * 0.14;
    const pulse = mood === "rest" ? 0.08 : 0.55 + Math.sin(t * (mood === "talk" ? 8 : 2.4)) * 0.35;
    if (visor.current) visor.current.emissiveIntensity = pulse;
    if (core.current) core.current.emissiveIntensity = mood === "work" ? 1.8 : pulse;
    if (ring.current) ring.current.rotation.z = t * (mood === "work" ? 1.4 : 0.4);
  });

  const visorColor = mood === "rest" ? "#41566c" : "#8ecbff";
  const coreColor = "#3ee08f";
  const ringColor = mood === "work" ? "#f0b45a" : visorColor;

  return (
    <group>
      <group ref={rig}>
        <group ref={head} position={[0, 1.18, 0]}>
          <RoundedBox args={[0.62, 0.48, 0.52]} radius={0.1}>
            <meshStandardMaterial color={shell} metalness={0.78} roughness={0.24} />
          </RoundedBox>
          <mesh position={[0, 0.02, 0.27]}>
            <boxGeometry args={[0.4, 0.12, 0.03]} />
            <meshStandardMaterial ref={visor} color={visorColor} emissive={visorColor} emissiveIntensity={0.8} />
          </mesh>
          <mesh ref={scan} position={[0, 0.02, 0.3]}>
            <boxGeometry args={[0.06, 0.09, 0.012]} />
            <meshStandardMaterial color="#f4f1ea" emissive="#f4f1ea" emissiveIntensity={0.4} />
          </mesh>
          <group ref={antenna} position={[0.18, 0.34, 0]}>
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
              <meshStandardMaterial color={metal} metalness={0.9} roughness={0.15} />
            </mesh>
            <mesh position={[0, 0.32, 0]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#f0b45a" emissive="#f0b45a" emissiveIntensity={1.1} />
            </mesh>
          </group>
        </group>

        <mesh position={[0, 0.82, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.16, 12]} />
          <meshStandardMaterial color={metal} metalness={0.85} roughness={0.2} />
        </mesh>

        <RoundedBox args={[0.66, 0.92, 0.4]} radius={0.08} position={[0, 0.28, 0]}>
          <meshStandardMaterial color="#141a21" metalness={0.7} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.42, 0.21]}>
          <circleGeometry args={[0.08, 24]} />
          <meshStandardMaterial ref={core} color={coreColor} emissive={coreColor} emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0, 0.16, 0.21]}>
          <boxGeometry args={[0.24, 0.035, 0.015]} />
          <meshStandardMaterial color="#8ecbff" emissive="#8ecbff" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.08, 0.21]}>
          <boxGeometry args={[0.24, 0.035, 0.015]} />
          <meshStandardMaterial color="#f0b45a" emissive="#f0b45a" emissiveIntensity={0.2} />
        </mesh>

        <group ref={armL} position={[-0.42, 0.58, 0]}>
          <mesh position={[0, -0.28, 0]}>
            <capsuleGeometry args={[0.048, 0.36, 4, 8]} />
            <meshStandardMaterial color={metal} metalness={0.8} roughness={0.22} />
          </mesh>
        </group>
        <group ref={armR} position={[0.42, 0.58, 0]}>
          <mesh position={[0, -0.28, 0]}>
            <capsuleGeometry args={[0.048, 0.36, 4, 8]} />
            <meshStandardMaterial color={metal} metalness={0.8} roughness={0.22} />
          </mesh>
        </group>

        <group ref={legL} position={[-0.14, -0.2, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
            <meshStandardMaterial color={shell} metalness={0.65} roughness={0.32} />
          </mesh>
        </group>
        <group ref={legR} position={[0.14, -0.2, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
            <meshStandardMaterial color={shell} metalness={0.65} roughness={0.32} />
          </mesh>
        </group>
      </group>

      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <torusGeometry args={[0.55, 0.012, 12, 64]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.07, 0]}>
        <circleGeometry args={[0.42, 40]} />
        <meshBasicMaterial color="#12171d" transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

export function Creature({ mood }: { mood: Mood }) {
  return (
    <Canvas camera={{ position: [0, 0.05, 5.2], fov: 38 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.4, 3.4, 2.2]} intensity={1.7} />
      <pointLight position={[-1.4, 1.4, 1.6]} intensity={0.45} color="#8ecbff" />
      <pointLight position={[1.2, 0.4, 1.2]} intensity={0.25} color="#f0b45a" />
      <Robot mood={mood} />
    </Canvas>
  );
}
