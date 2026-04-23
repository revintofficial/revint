"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Scroll-scrubbed canvas frame sequence — Apple AirPods / MacBook pattern.
 *
 * Drop a hero video into `input/source.mp4`, extract frames with:
 *
 *   ffmpeg -i input/source.mp4 \
 *     -vf "fps=30,scale='min(1920,iw)':'-2':flags=lanczos" \
 *     -q:v 3 public/frames/frame_%04d.jpg
 *
 * Then set FRAME_COUNT to the produced count. If the folder is empty this
 * component silently falls back to a gradient treatment so the hero still
 * looks finished during development.
 */

export type ScrubSequenceProps = {
  framesPath: string;
  frameCount: number;
  ext?: "jpg" | "webp";
  className?: string;
  /** Outer tall section the scrub reads its scroll range from. */
  scrollTargetRef: RefObject<HTMLElement | null>;
  /** Rendered behind the canvas when frames 404 — keeps the hero alive. */
  fallback?: React.ReactNode;
};

const pad4 = (n: number) => String(n).padStart(4, "0");

export function ScrubSequence({
  framesPath,
  frameCount,
  ext = "jpg",
  className,
  scrollTargetRef,
  fallback,
}: ScrubSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef<number | null>(null);
  const visible = useRef(true);
  const [framesReady, setFramesReady] = useState(false);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Preload frames. If the first one 404s we assume no pipeline was run and
  // leave the fallback visible.
  useEffect(() => {
    if (frameCount <= 0) return;
    const probe = new Image();
    probe.src = `${framesPath}/frame_${pad4(1)}.${ext}`;
    probe.onerror = () => setFramesReady(false);
    probe.onload = () => {
      const imgs: HTMLImageElement[] = [probe];
      for (let i = 2; i <= frameCount; i++) {
        const img = new Image();
        img.src = `${framesPath}/frame_${pad4(i)}.${ext}`;
        imgs[i - 1] = img;
      }
      imagesRef.current = imgs;
      setFramesReady(true);
    };
  }, [framesPath, frameCount, ext]);

  // Size canvas to viewport (respecting dpr).
  useEffect(() => {
    if (!framesReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      drawIndex(currentIndex());
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framesReady]);

  // Pause rAF when the hero is off-screen.
  useEffect(() => {
    const el = scrollTargetRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollTargetRef]);

  useEffect(() => {
    if (!framesReady) return;
    const tick = () => {
      if (visible.current && !prefersReduced.current) {
        drawIndex(currentIndex());
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framesReady]);

  // Static mid-frame for reduced-motion users.
  useEffect(() => {
    if (!framesReady || !prefersReduced.current) return;
    const mid = Math.floor(frameCount / 2);
    const img = imagesRef.current[mid];
    if (!img) return;
    if (img.complete) drawImage(img);
    else img.addEventListener("load", () => drawImage(img), { once: true });
  }, [framesReady, frameCount]);

  const currentIndex = () => {
    const el = scrollTargetRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const total = el.offsetHeight - window.innerHeight;
    const progress =
      total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    return Math.min(frameCount - 1, Math.floor(progress * (frameCount - 1)));
  };

  const drawIndex = (idx: number) => {
    const img = imagesRef.current[idx];
    if (img && img.complete && img.naturalWidth > 0) drawImage(img);
  };

  const drawImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  return (
    <>
      {!framesReady && fallback}
      {framesReady && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={className}
          style={{ transform: "translateZ(0)", willChange: "contents" }}
        />
      )}
    </>
  );
}
