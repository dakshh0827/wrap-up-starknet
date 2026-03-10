import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Float } from "@react-three/drei";

function Model({ path }) {
  // Load the 3D model
  const { scene } = useGLTF(path);

  return (
    <primitive
      object={scene}
      scale={1.3}
      position={[0, -0.5, 0]}
    />
  );
}

export default function Model3D({ path }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 50 }}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      gl={{ alpha: true, antialias: true }} // Ensures complete transparency
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={2} />
      <pointLight position={[-5, -5, -5]} intensity={0.5} />

      <Suspense fallback={null}>
        {/* Float creates a smooth up-and-down hovering motion */}
        <Float 
          speed={2} // Animation speed
          rotationIntensity={0.2} // Slight rotation wobble
          floatIntensity={1.5} // Up/down amplitude
          floatingRange={[-0.15, 0.15]}
        >
          <Model path={path} />
        </Float>
      </Suspense>

      {/* OrbitControls enables dragging to look around and auto-rotates the model */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.5}
        makeDefault
      />
    </Canvas>
  );
}