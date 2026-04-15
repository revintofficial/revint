"use client";

import { useState, useEffect } from "react";

interface GlassOrbProps {
  delay: number;
  backgroundImage: string;
}

function GlassOrb({ delay, backgroundImage }: GlassOrbProps) {
  const animationStyle = {
    animation: `glass-move 4s cubic-bezier(0.6, 0, 0.4, 1) infinite`,
    animationDelay: `${delay}s`,
  };

  return (
    <div
      className="absolute w-[25vmin] h-[25vmin] rounded-full overflow-hidden shadow-[0.1vw_0.1vw_0_rgba(255,255,255,0.2)]"
      style={animationStyle}
    >
      <div
        className="absolute inset-[5%] rounded-full bg-cover bg-center bg-no-repeat bg-fixed blur-[2.5vmin]"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className="absolute -inset-1/4 backdrop-blur-[2.5vmin] backdrop-contrast-[500%]" />
    </div>
  );
}

interface GlassBackgroundProps {
  backgroundImage?: string;
  orbCount?: number;
  children?: React.ReactNode;
  className?: string;
}

export function GlassBackground({
  backgroundImage = "https://512pixels.net/wp-content/uploads/2025/06/11-0-Color-Day-thumbnails.jpg",
  orbCount = 4,
  children,
  className,
}: GlassBackgroundProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const delays = Array.from({ length: orbCount }, (_, i) => -(i * (4 / orbCount)));

  return (
    <div className={`relative w-full h-screen overflow-hidden bg-white ${className ?? ""}`}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(255, 249, 145, 0.3) 0%, transparent 70%)`,
          opacity: 0.4,
          mixBlendMode: "overlay",
        }}
      />

      {mounted &&
        delays.map((delay, index) => (
          <GlassOrb
            key={index}
            delay={delay}
            backgroundImage={backgroundImage}
          />
        ))}

      {children && (
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="backdrop-blur-sm bg-white/30 border border-white/20 rounded-2xl p-8 shadow-2xl">
            {children}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes glass-move {
          0% { top: 10%; left: 10%; }
          25% { top: 10%; left: calc(90% - 25vmin); }
          50% { top: calc(90% - 25vmin); left: calc(90% - 25vmin); }
          75% { top: calc(90% - 25vmin); left: 10%; }
          100% { top: 10%; left: 10%; }
        }
      `}</style>
    </div>
  );
}
