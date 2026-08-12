import HeroContent from "@/components/hero/HeroContent";
import HeroVideo from "@/components/hero/HeroVideo";
import type { HeroStat } from "@/components/hero/HeroStats";

// The clinical narrative, metrics, and calculator access are always server-rendered.
// Video enriches the page but never gates content or the primary action.
export default function Hero({ stats }: { stats: readonly HeroStat[] }) {
  return (
    <section className="relative isolate overflow-hidden border-y border-slate-200/80 bg-[#fbfbfa] text-slate-950">
      <HeroVideo />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(251,251,250,0.98)_0%,rgba(251,251,250,0.94)_33%,rgba(251,251,250,0.58)_52%,rgba(251,251,250,0.16)_76%,rgba(251,251,250,0.26)_100%)] md:bg-[linear-gradient(90deg,rgba(251,251,250,0.99)_0%,rgba(251,251,250,0.96)_36%,rgba(251,251,250,0.64)_52%,rgba(251,251,250,0.14)_75%,rgba(251,251,250,0.34)_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(90deg, black 0%, black 40%, transparent 78%)",
        }}
        aria-hidden="true"
      />
      <HeroContent stats={stats} />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbfbfa] to-transparent"
        aria-hidden="true"
      />
    </section>
  );
}
