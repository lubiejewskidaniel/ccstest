"use client";

import { useEffect, useRef } from "react";

/**
 * Orbiting signal-particle canvas behind the mentoring feature card, ported
 * from the verified static build's script.js. Purely decorative
 * (`aria-hidden`), and freezes orbital motion under `prefers-reduced-motion`
 * while still rendering a static field rather than nothing.
 */
export function MentorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cw = canvas.width;
    const ch = canvas.height;

    const particles = Array.from({ length: 26 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 40 + Math.random() * 150,
      cx: cw * 0.72 + (Math.random() - 0.5) * 40,
      cy: ch * 0.42 + (Math.random() - 0.5) * 40,
      speed: (0.15 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1),
      size: 0.8 + Math.random() * 1.6,
    }));

    let raf = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, cw, ch);
      ctx.strokeStyle = "rgba(127,217,255,0.08)";
      for (let r = 40; r < 220; r += 40) {
        ctx.beginPath();
        ctx.ellipse(cw * 0.72, ch * 0.42, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      particles.forEach((p) => {
        if (!reduceMotion) p.a += p.speed * 0.01;
        const x = p.cx + Math.cos(p.a) * p.r;
        const y = p.cy + Math.sin(p.a) * p.r * 0.6;
        ctx.beginPath();
        ctx.fillStyle = "rgba(167,232,255,0.85)";
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={600} height={260} aria-hidden="true" />;
}
