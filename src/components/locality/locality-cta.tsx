"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useDiscovery } from "@/store/discovery";
import { formatCount } from "@/lib/format";

/** Hands the locality straight to the map rather than to another list page. */
export function LocalityCta({ slug, name, count }: { slug: string; name: string; count: number }) {
  const router = useRouter();
  const { setFilters, setUseBounds, selectLocality } = useDiscovery();

  return (
    <div className="mt-5 space-y-2 border-t border-line pt-4">
      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={() => {
          setUseBounds(false);
          setFilters({ localitySlugs: [slug] });
          selectLocality(null);
          router.push("/search");
        }}
      >
        Show {formatCount(count)} homes on the map
      </Button>
      <p className="text-[11px] text-faint">Opens {name} in PropIT&apos;s live map view.</p>
    </div>
  );
}
