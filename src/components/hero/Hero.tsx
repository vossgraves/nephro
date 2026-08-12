import HeroContent from "@/components/hero/HeroContent";
import HeroScene from "@/components/hero/HeroScene";
import type { HeroStat } from "@/components/hero/HeroStats";

// The message, metrics, and actions render on the server. WebGL enriches the experience
// but never gates readability or access to the calculator.
export default function Hero({ stats }: { stats: readonly HeroStat[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#07151c] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 680px at 76% 44%, rgba(14, 148, 144, 0.25), transparent 62%), radial-gradient(800px 600px at 18% -10%, rgba(8, 145, 178, 0.18), transparent 62%), linear-gradient(135deg, #07151c 0%, #09272b 54%, #06161d 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148, 233, 240, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 233, 240, 0.045) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(ellipse at center, black, transparent 76%)",
        }}
        aria-hidden="true"
      />
      <HeroScene />
      <HeroContent stats={stats} />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#07151c] via-[#07151c]/70 to-transparent"
        aria-hidden="true"
      />
    </section>
  );
}
