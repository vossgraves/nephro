"use client";

import dynamic from "next/dynamic";

const KidneyScene = dynamic(() => import("@/components/hero/KidneyScene"), {
  ssr: false,
  loading: () => null,
});

const HeroContent = dynamic(() => import("@/components/hero/HeroContent"), {
  ssr: false,
  loading: () => null,
});

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0b1220] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 700px at 50% -10%, rgba(29,138,165,0.28), transparent 60%), radial-gradient(900px 600px at 85% 110%, rgba(63,191,143,0.16), transparent 60%)",
        }}
        aria-hidden="true"
      />
      <KidneyScene />
      <HeroContent />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b1220] to-transparent"
        aria-hidden="true"
      />
    </section>
  );
}
