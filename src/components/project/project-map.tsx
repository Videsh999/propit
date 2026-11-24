"use client";

import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useInView } from "motion/react";
import type { LatLng, Locality } from "@/types";
import type { MapPoint, MapProject } from "@/components/map/propit-map";

const PropitMap = dynamic(() => import("@/components/map/propit-map").then(module => module.PropitMap), {
  ssr: false, loading: () => <p role="status" className="grid h-full place-items-center text-sm text-muted">Loading the project map…</p>,
});

export function ProjectMap({ location, locality, project, points }: { location: LatLng; locality: Locality | null; project: MapProject; points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "200px" });
  const localities = useMemo(() => locality ? [locality] : [], [locality]);
  const projects = useMemo(() => [project], [project]);
  return <div ref={ref} className="mt-5 h-[280px] overflow-hidden rounded-2xl border border-line bg-sunk sm:h-[340px]">
    {visible ? <PropitMap compact initialCenter={location} localityScope={locality ?? undefined} followDiscoveryCamera={false} points={points} localities={localities} projects={projects} />
      : <p className="grid h-full place-items-center text-sm text-muted">Map of {locality?.name ?? "the project location"}</p>}
  </div>;
}
