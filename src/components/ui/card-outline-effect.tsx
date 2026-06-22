"use client";

import type { ReactNode } from "react";

export function CardOutlineEffect({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10",
        "bg-white/5",
        "min-h-[240px] md:min-h-[260px] w-full",
        className,
      ].join(" ")}
    >
      {/* Border-only masked overlay (no glow tracking) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          border: "3px solid transparent",
          backdropFilter: "saturate(4.2) brightness(2.5) contrast(2.5)",
          WebkitBackdropFilter: "saturate(4.2) brightness(2.5) contrast(2.5)",
          mask:
            "linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          transform: "translateZ(0)",
          opacity: 0.95,
          transition: "opacity 200ms ease",
        }}
      />

      <div className="relative z-[2] h-full w-full">{children}</div>
    </article>
  );
}
