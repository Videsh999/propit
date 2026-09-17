import type { Metadata } from "next";
import { CompareView } from "@/components/compare/compare-view";

export const metadata: Metadata = {
  title: "Compare homes",
  description: "Compare up to four homes side by side — price, area, configuration, amenities and location.",
  robots: { index: false, follow: false },
};

export default function ComparePage() {
  return (
    <main>
      <CompareView />
    </main>
  );
}
