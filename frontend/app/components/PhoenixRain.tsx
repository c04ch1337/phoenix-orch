'use client';

import { useEffect, useRef } from "react";
import clsx from "clsx";

interface PhoenixRainProps {
    isWhiteHot?: boolean;
}

export default function PhoenixRain({ isWhiteHot = false }: PhoenixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isWhiteHotRef = useRef(isWhiteHot);

  useEffect(() => {
    isWhiteHotRef.current = isWhiteHot;
  }, [isWhiteHot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let columns = 0;
    let drops: number[] = [];

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / 20);
      drops = new Array(columns).fill(1);
    };

    init();

    const phoenixChars = "⋆·.。✶❅✧◉◈◇✦◆⚶♡♫♪♩PHOENIX";

    function draw() {
      if (!ctx || !canvas) return;

      // Trail effect: clear with low opacity
      // White hot mode gets a brighter, ghostly trail
      ctx.fillStyle = isWhiteHotRef.current ? "rgba(255, 255, 255, 0.2)" : "rgba(10, 10, 10, 0.1)"; // Using ashen-void for dark mode
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = "16px monospace";

      for (let i = 0; i < drops.length; i++) {
        const char = phoenixChars[Math.floor(Math.random() * phoenixChars.length)];
        const x = i * 20;
        const y = drops[i] * 20;

        if (isWhiteHotRef.current) {
          // Pure White Hot Mode
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowBlur = 15;
          ctx.shadowColor = "white";
        } else {
          // Standard Phoenix Fire Mode
          ctx.shadowBlur = 0;
          // Vertical gradient for each character
          const gradient = ctx.createLinearGradient(x, y - 20, x, y);
          gradient.addColorStop(0, "#E63946"); // Blood Red Top
          gradient.addColorStop(0.5, "#F77F00"); // Orange Mid
          gradient.addColorStop(1, "rgba(255, 210, 63, 0.5)"); // Yellow Tail
          ctx.fillStyle = gradient;
        }

        ctx.fillText(char, x, y);

        // Bright Leading Edge (Head)
        ctx.fillStyle = isWhiteHotRef.current ? "#FFFFFF" : "#FFD23F";
        ctx.fillText(char, x, y); 

        // Randomly reset drop to top
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      
      // Reset shadow for next frame performance
      ctx.shadowBlur = 0;
    }

    // Slowed down from 50ms to 85ms for a more gentle ash-like fall
    const interval = setInterval(draw, 85);

    const handleResize = () => {
      init();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
    };
  }, [isWhiteHot]); // Include isWhiteHot dependency since we use isWhiteHotRef which depends on it

  return (
    <canvas
      ref={canvasRef}
      className={clsx(
        "fixed inset-0 pointer-events-none z-0 transition-all duration-500 ease-in-out",
        isWhiteHot ? "opacity-80" : "opacity-30",
        "bg-ashen-void" // Using the ashen-void color for background
      )}
      style={{ mixBlendMode: "screen" }}
    />
  );
}