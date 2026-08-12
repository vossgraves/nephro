import type { Metadata } from "next";
import ImagingWorkspace from "@/components/imaging/ImagingWorkspace";

export const metadata: Metadata = {
  title: "Imaging Lab | AI-assisted visual review for Nephro",
  description:
    "Local image review with optional OpenAI or Gemini visual-review requests for de-identified teaching images. Not diagnostic AI.",
};

export default function ImagingPage() {
  return <ImagingWorkspace />;
}
