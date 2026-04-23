"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, type JSX } from "react";

type Props = {
  text: string;
  className?: string;
  delay?: number;
  startDelay?: number;
  as?: keyof JSX.IntrinsicElements;
};

/**
 * Word-stagger headline used on every cinematic section title.
 * Each word blur-ups with cubic-out easing; ~0.07s between words.
 */
export function BlurText({
  text,
  className = "",
  delay = 0.07,
  startDelay = 0,
  as: Tag = "h2",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const Component = Tag as unknown as React.ElementType;

  return (
    <Component ref={ref} className={className}>
      {words.map((w, i) => (
        <motion.span
          key={`${i}-${w}`}
          className="inline-block will-change-[filter,transform,opacity]"
          initial={
            reduce
              ? { opacity: 1 }
              : { filter: "blur(10px)", opacity: 0, y: 22 }
          }
          animate={
            inView || reduce
              ? { filter: "blur(0px)", opacity: 1, y: 0 }
              : undefined
          }
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
            delay: reduce ? 0 : startDelay + i * delay,
          }}
        >
          {w}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </Component>
  );
}
