import type { Metadata } from "next";
import ImagingWorkspace from "@/components/imaging/ImagingWorkspace";

export const metadata: Metadata = {
  title: "Imaging Lab | Local image review for Nephro",
  description:
    "Browser-only image review workspace for de-identified teaching images. Local rendering, deterministic image properties, and no diagnostic AI.",
};

export default function ImagingPage() {
  return <ImagingWorkspace />;
}
