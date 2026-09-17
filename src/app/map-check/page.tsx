import type { Metadata } from "next";
import { MapCheck } from "@/components/map/map-check";
import { MapDiagnostic } from "@/components/map/map-diagnostic";

export const metadata: Metadata = {
  title: "Map diagnostics",
  description: "Checks whether this browser and network can load PropIT's map.",
  robots: { index: false, follow: false },
};

export default function MapCheckPage() {
  return (
    <main className="mx-auto max-w-[860px] px-5 py-14 md:px-8">
      <p className="eyebrow mb-2">Diagnostics</p>
      <h1 className="display text-[36px] leading-tight text-ink md:text-[44px]">
        Can this browser show the map?
      </h1>
      <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-muted">
        Everything below runs in your browser, on your network. If the map is blank for you but fine
        elsewhere, this says exactly which piece is failing.
      </p>
      <section className="mt-12 border-t border-line pt-10">
        <p className="eyebrow mb-2">Live render test</p>
        <h2 className="display text-[26px] leading-tight text-ink">
          What MapLibre actually does here.
        </h2>
        <p className="mb-6 mt-2 max-w-[56ch] text-[14px] leading-relaxed text-muted">
          Builds the map exactly as the homepage does, counts every tile request, and reads the
          canvas back to see whether anything painted. Takes about fifteen seconds.
        </p>
        <MapDiagnostic />
      </section>

      <MapCheck />
    </main>
  );
}
