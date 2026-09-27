"use client";

import { animate, stagger } from "animejs";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type Phase = "idle" | "listening" | "thinking" | "speaking";

export function VoiceOrb({ phase, large }: { phase: Phase; large?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const box = large ? "h-56 w-56" : "h-16 w-16";
  const core = large ? "h-32 w-32" : "h-10 w-10";

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const coreNode = node.querySelector("[data-core]");
    const rings = node.querySelectorAll("[data-ring]");
    const bars = node.querySelectorAll("[data-bar]");
    const running: Array<{ revert: () => void }> = [];

    if (coreNode) {
      running.push(
        animate(coreNode, {
          scale: phase === "listening" ? [1, 1.14] : phase === "speaking" ? [1, 1.08] : [1, 1.045],
          loop: true,
          alternate: true,
          duration: phase === "listening" ? 480 : phase === "thinking" ? 800 : 1700,
          ease: "inOutSine",
        }),
      );
    }

    if (rings.length > 0 && phase !== "idle") {
      running.push(
        animate(rings, {
          scale: [0.72, 1.28],
          opacity: [0.75, 0],
          loop: true,
          duration: phase === "thinking" ? 1100 : 1500,
          delay: stagger(280),
          ease: "outQuad",
        }),
      );
    }

    if (bars.length > 0) {
      const quiet = phase === "idle" || phase === "thinking";
      running.push(
        animate(bars, {
          scaleY: quiet ? [0.3, 0.62] : [0.2, 1],
          loop: true,
          alternate: true,
          duration: phase === "listening" ? 240 : phase === "speaking" ? 360 : 700,
          delay: stagger(55),
          ease: "inOutSine",
        }),
      );
    }

    return () => {
      for (const animation of running) animation.revert();
    };
  }, [phase]);

  return (
    <div ref={root} className={`relative grid place-items-center ${box}`}>
      <span data-ring className="absolute inset-4 rounded-full border border-accent/70" />
      <span data-ring className="absolute inset-4 rounded-full border border-mint/40" />
      <span
        data-core
        className={`relative rounded-full bg-[radial-gradient(circle_at_35%_30%,#f4fff8,#3ee08f_38%,#12824d_70%,#06321c)] shadow-[0_0_42px_rgba(62,224,143,0.45)] ${core}`}
      />
      <span className="pointer-events-none absolute bottom-2 flex h-8 items-end gap-1">
        {Array.from({ length: large ? 11 : 5 }, (_, index) => (
          <span
            key={index}
            data-bar
            className={`w-0.5 origin-bottom rounded-full bg-mint ${large ? "h-6" : "h-3"}`}
          />
        ))}
      </span>
    </div>
  );
}

export function CountUp({ value }: { value: number }) {
  const node = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const state = { n: previous.current };
    const animation = animate(state, {
      n: value,
      duration: 900,
      ease: "outCubic",
      onUpdate: () => {
        element.textContent = state.n.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    });
    previous.current = value;
    return () => {
      animation.revert();
    };
  }, [value]);

  return <span ref={node}>0.00</span>;
}

export function ChatBubble({ children, mine }: { children: ReactNode; mine: boolean }) {
  const node = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const bubble = animate(element, {
      opacity: [0, 1],
      translateY: [18, 0],
      translateX: mine ? [16, 0] : [-16, 0],
      duration: 520,
      ease: "outCubic",
    });
    const lines = element.querySelectorAll("li");
    const steps =
      lines.length > 0
        ? animate(lines, {
            opacity: [0, 1],
            translateX: [-10, 0],
            delay: stagger(70, { start: 180 }),
            duration: 380,
            ease: "outQuad",
          })
        : null;
    return () => {
      bubble.revert();
      steps?.revert();
    };
  }, [mine]);

  return (
    <article ref={node} className={mine ? "ml-10 opacity-0" : "mr-6 opacity-0"}>
      {children}
    </article>
  );
}

export function DotsLoader() {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dots = node.current?.querySelectorAll("span");
    if (!dots || dots.length === 0) return;
    const animation = animate(dots, {
      translateY: [0, -7, 0],
      opacity: [0.3, 1, 0.3],
      duration: 720,
      loop: true,
      delay: stagger(110),
      ease: "inOutSine",
    });
    return () => {
      animation.revert();
    };
  }, []);

  return (
    <div ref={node} className="flex items-center gap-1.5" aria-label="Cargando">
      <span className="h-2 w-2 rounded-full bg-accent" />
      <span className="h-2 w-2 rounded-full bg-accent" />
      <span className="h-2 w-2 rounded-full bg-accent" />
    </div>
  );
}
