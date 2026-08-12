"use client";

import dynamic from "next/dynamic";

const KidneyScene = dynamic(() => import("@/components/hero/KidneyScene"), {
  ssr: false,
  loading: () => null,
});

export default function HeroScene({ className }: { className?: string }) {
  return <KidneyScene className={className} />;
}
