'use client';
import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import * as THREE from 'three';

extend({ Line_: THREE.Line });

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progress;
}

function useMouse() {
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return mouse;
}

const NODE_COUNT = 30;

function NetworkNodes({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { positions, velocities, scales } = useMemo(() => {
    const pos = new Float32Array(NODE_COUNT * 3);
    const vel = new Float32Array(NODE_COUNT * 3);
    const sc = new Float32Array(NODE_COUNT);

    for (let i = 0; i < NODE_COUNT; i++) {
      const spread = 18;
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread;

      vel[i * 3] = (Math.random() - 0.5) * 0.003;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.003;

      sc[i] = 0.04 + Math.random() * 0.08;
    }
    return { positions: pos, velocities: vel, scales: sc };
  }, []);

  const teal = useMemo(() => new THREE.Color('#0D9488'), []);
  const purple = useMemo(() => new THREE.Color('#7C3AED'), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < NODE_COUNT; i++) {
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];

      for (let j = 0; j < 3; j++) {
        if (Math.abs(positions[i * 3 + j]) > 10) {
          velocities[i * 3 + j] *= -1;
        }
      }

      const pulse = Math.sin(time * 0.8 + i * 0.5) * 0.5 + 0.5;
      tempColor.copy(teal).lerp(purple, pulse);
      meshRef.current.setColorAt(i, tempColor);

      const breathe = 1 + Math.sin(time * 0.5 + i * 0.3) * 0.2;
      const glow = 1 + pulse * 0.3;
      const nodeScale = scales[i] * breathe * glow;

      dummy.position.set(
        positions[i * 3] + mouse.current.x * 0.5,
        positions[i * 3 + 1] + mouse.current.y * 0.3,
        positions[i * 3 + 2]
      );
      dummy.scale.setScalar(nodeScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, NODE_COUNT]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function ConnectionLines({ scrollProgress, mouse }: { scrollProgress: number; mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const ref = useRef<THREE.LineSegments>(null!);
  const matRef = useRef<THREE.LineBasicMaterial>(null!);

  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const spread = 18;
    const tempPositions: THREE.Vector3[] = [];

    for (let i = 0; i < 60; i++) {
      tempPositions.push(new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread
      ));
    }

    for (let i = 0; i < tempPositions.length; i++) {
      for (let j = i + 1; j < tempPositions.length; j++) {
        const dist = tempPositions[i].distanceTo(tempPositions[j]);
        if (dist < 4.5) {
          vertices.push(
            tempPositions[i].x, tempPositions[i].y, tempPositions[i].z,
            tempPositions[j].x, tempPositions[j].y, tempPositions[j].z
          );
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.elapsedTime;
    ref.current.rotation.y = time * 0.012 + mouse.current.x * 0.1;
    ref.current.rotation.x = mouse.current.y * 0.05;
    if (matRef.current) {
      const pulse = Math.sin(time * 0.5) * 0.03;
      matRef.current.opacity = 0.08 + scrollProgress * 0.08 + pulse;
    }
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial ref={matRef} color="#7C3AED" transparent opacity={0.08} />
    </lineSegments>
  );
}

function AICore({ scrollProgress, mouse }: { scrollProgress: number; mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;

    const coreScale = 0.3 + scrollProgress * 0.5;
    meshRef.current.scale.setScalar(coreScale * (1 + Math.sin(time * 1.5) * 0.05));
    meshRef.current.rotation.y = time * 0.2 + mouse.current.x * 0.3;
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1 + mouse.current.y * 0.2;

    if (glowRef.current) {
      glowRef.current.scale.setScalar(coreScale * 2.5 * (1 + Math.sin(time * 0.8) * 0.1));
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.04 + scrollProgress * 0.08 + Math.sin(time) * 0.02;
    }

    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.4) * 0.2;
      ringRef.current.rotation.z = time * 0.15;
      ringRef.current.scale.setScalar(coreScale * 1.8);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color="#7C3AED"
          transparent
          opacity={0.5 + scrollProgress * 0.3}
          wireframe
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#0D9488"
          transparent
          opacity={0.05}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.02, 16, 64]} />
        <meshBasicMaterial color="#0D9488" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function DataPulses({ scrollProgress, mouse }: { scrollProgress: number; mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const count = 25;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const pulseData = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 6;
      const speed = 0.2 + Math.random() * 0.5;
      const yOffset = (Math.random() - 0.5) * 8;
      data.push({ angle, radius, speed, yOffset, phase: Math.random() * Math.PI * 2 });
    }
    return data;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const p = pulseData[i];
      const t = time * p.speed + p.phase;
      dummy.position.set(
        Math.cos(t + p.angle) * p.radius + mouse.current.x * 0.3,
        p.yOffset + Math.sin(t * 0.7) * 1.5 + mouse.current.y * 0.2,
        Math.sin(t + p.angle) * p.radius
      );
      const pulseScale = 0.02 + Math.sin(t * 3) * 0.01;
      dummy.scale.setScalar(pulseScale * (0.5 + scrollProgress));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#0D9488" transparent opacity={0.6} />
    </instancedMesh>
  );
}

function CameraController({ scrollProgress, mouse }: { scrollProgress: number; mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 2, 15));

  useFrame(() => {
    const p = scrollProgress;
    const mx = mouse.current.x;
    const my = mouse.current.y;

    let tx: number, ty: number, tz: number;
    if (p < 0.15) {
      tx = 0;
      ty = 2 - p * 8;
      tz = 15 - p * 30;
    } else if (p < 0.35) {
      const t = (p - 0.15) / 0.2;
      tx = Math.sin(t * Math.PI) * 5;
      ty = 0.8 - t * 1.5;
      tz = 10 - t * 4;
    } else if (p < 0.55) {
      const t = (p - 0.35) / 0.2;
      tx = 5 - t * 10;
      ty = -0.7 + t * 0.5;
      tz = 6 + t * 2;
    } else if (p < 0.75) {
      const t = (p - 0.55) / 0.2;
      tx = -5 + t * 5;
      ty = -0.2 + t * 3;
      tz = 8 + t * 8;
    } else {
      const t = (p - 0.75) / 0.25;
      tx = 0;
      ty = 2.8 + t * 2;
      tz = 16 + t * 10;
    }

    tx += mx * 1.5;
    ty += my * 0.8;

    targetPos.current.set(tx, ty, tz);
    camera.position.lerp(targetPos.current, 0.03);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Scene({ scrollProgress, mouse }: { scrollProgress: number; mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  return (
    <>
      <color attach="background" args={['#050510']} />
      <fog attach="fog" args={['#050510', 15, 35]} />

      <CameraController scrollProgress={scrollProgress} mouse={mouse} />
      <NetworkNodes mouse={mouse} />
      <ConnectionLines scrollProgress={scrollProgress} mouse={mouse} />
      <AICore scrollProgress={scrollProgress} mouse={mouse} />
      <DataPulses scrollProgress={scrollProgress} mouse={mouse} />
    </>
  );
}

export default function NetworkCanvas() {
  const [mounted, setMounted] = useState(false);
  const scrollProgress = useScrollProgress();
  const mouse = useMouse();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="fixed inset-0" style={{ background: '#050510' }} />;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: '#050510' }}>
      <Canvas
        camera={{ position: [0, 2, 15], fov: 60, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ pointerEvents: 'none' }}
      >
        <Scene scrollProgress={scrollProgress} mouse={mouse} />
      </Canvas>
    </div>
  );
}
