"use client";

import { GlowingEffect } from "./glowing-effect";

export function GlowingEffectCard() {
  return (
    <div className="relative min-h-[240px] w-full overflow-hidden rounded-2xl border border-white/15 bg-white/5 md:min-h-[260px]">
      {/* Reliable visible glow background (doesn't depend on pseudo/mask utilities) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(800px circle at 20% 20%, rgba(221,123,187,0.35), transparent 40%), radial-gradient(700px circle at 80% 60%, rgba(90,146,44,0.25), transparent 35%)",
        }}
      />

      {/* Keep the GlowingEffect (it may enhance on pointer move) */}
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
      />

      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <div
          aria-hidden="true"
          className="h-3 w-3 rounded-full bg-white/60 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
        />
      </div>
    </div>
  );
}
