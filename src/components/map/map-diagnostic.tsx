"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, type ErrorEvent } from "maplibre-gl";
// Side effect: repoints MapLibre at a worker URL the server can serve.
import "@/lib/map/worker";
import { basemapSources, loadVectorStyle } from "@/lib/providers/basemap";
import { INITIAL_FIT, HYDERABAD_MAX_BOUNDS, MAX_ZOOM, MIN_ZOOM } from "@/lib/map/viewport";

/**
 * Builds a map exactly the way the product does and records what happens.
 *
 * A screenshot cannot distinguish "no tile was requested" from "the tile
 * arrived and painted nothing" — and those have opposite fixes. This drives a
 * real MapLibre instance, counts every tile request and error, then posts the
 * result to the dev server so the findings survive the browser they happened in.
 */
export function MapDiagnostic() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState("starting…");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const errors: string[] = [];
    const tiles: { url: string; ok: boolean; status: number | string }[] = [];
    let map: MapLibreMap | null = null;
    let cancelled = false;

    // Count real tile traffic by wrapping fetch for the life of the test.
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const interesting = /openfreemap|arcgisonline|tile\.openstreetmap|\/fonts\//.test(url);
      try {
        const res = await realFetch(input, init);
        if (interesting) tiles.push({ url, ok: res.ok, status: res.status });
        return res;
      } catch (err) {
        if (interesting) tiles.push({ url, ok: false, status: String(err) });
        throw err;
      }
    };

    (async () => {
      const gl = (() => {
        try {
          const c = document.createElement("canvas");
          const ctx = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
          if (!ctx) return { supported: false };
          const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
          return {
            supported: true,
            vendor: dbg ? ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : "n/a",
            renderer: dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "n/a",
          };
        } catch (e) {
          return { supported: false, error: String(e) };
        }
      })();

      setPhase("fetching the basemap style…");
      const source = basemapSources()[0];
      let style;
      try {
        style = await loadVectorStyle(source, "light");
      } catch (e) {
        errors.push(`style fetch failed: ${String(e)}`);
        finish({ gl, styleLoaded: false });
        return;
      }
      if (cancelled) return;

      setPhase("building the map…");
      map = new MapLibreMap({
        container: host,
        style,
        bounds: INITIAL_FIT.bounds,
        fitBoundsOptions: INITIAL_FIT.fitBoundsOptions,
        maxBounds: HYDERABAD_MAX_BOUNDS,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        attributionControl: false,
      });

      map.on("error", (e: ErrorEvent) => errors.push(e.error?.message ?? "unknown map error"));

      setPhase("waiting 12s for tiles…");
      await new Promise((r) => setTimeout(r, 12000));
      if (cancelled) return;

      const m = map;
      const sourceIds = Object.keys(m.getStyle()?.sources ?? {});
      const sourceLoaded: Record<string, boolean | string> = {};
      for (const id of sourceIds) {
        try {
          sourceLoaded[id] = m.isSourceLoaded(id);
        } catch (e) {
          sourceLoaded[id] = String(e);
        }
      }

      // Does the canvas actually contain more than one colour? This is the only
      // honest answer to "did anything paint".
      let paint: Record<string, unknown> = {};
      try {
        const canvas = m.getCanvas();
        const gl2 = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (gl2) {
          const w = canvas.width;
          const h = canvas.height;
          const px = new Uint8Array(4 * 64 * 64);
          (gl2 as WebGLRenderingContext).readPixels(
            Math.max(0, (w >> 1) - 32),
            Math.max(0, (h >> 1) - 32),
            64,
            64,
            (gl2 as WebGLRenderingContext).RGBA,
            (gl2 as WebGLRenderingContext).UNSIGNED_BYTE,
            px,
          );
          const seen = new Set<string>();
          for (let i = 0; i < px.length; i += 4) seen.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
          paint = { distinctColours: seen.size, sample: [...seen].slice(0, 6) };
        }
      } catch (e) {
        paint = { error: String(e) };
      }

      finish({
        gl,
        styleLoaded: true,
        styleLayers: m.getStyle()?.layers?.length ?? 0,
        renderedFeatures: (() => {
          try {
            return m.queryRenderedFeatures().length;
          } catch {
            return "query failed";
          }
        })(),
        mapLoaded: m.loaded(),
        styleIsLoaded: m.isStyleLoaded(),
        zoom: +m.getZoom().toFixed(2),
        canvasSize: [m.getCanvas().width, m.getCanvas().height],
        containerSize: [host.clientWidth, host.clientHeight],
        sourceLoaded,
        paint,
      });
    })();

    function finish(extra: Record<string, unknown>) {
      const out = {
        at: new Date().toISOString(),
        userAgent: navigator.userAgent,
        visibility: document.visibilityState,
        devicePixelRatio: window.devicePixelRatio,
        online: navigator.onLine,
        ...extra,
        errors,
        tileRequests: {
          total: tiles.length,
          failed: tiles.filter((t) => !t.ok).length,
          byHost: tiles.reduce<Record<string, number>>((a, t) => {
            const h = (() => {
              try {
                return new URL(t.url, location.href).host;
              } catch {
                return "?";
              }
            })();
            a[h] = (a[h] ?? 0) + 1;
            return a;
          }, {}),
          firstTen: tiles.slice(0, 10),
        },
      };
      window.fetch = realFetch;
      setReport(out);
      setPhase("done — report sent");
      void realFetch("/api/diag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(out),
      });
    }

    return () => {
      cancelled = true;
      window.fetch = realFetch;
      map?.remove();
    };
  }, []);

  return (
    <div>
      <p className="text-[15px] text-ink">
        Status: <span className="font-medium">{phase}</span>
      </p>
      <div
        ref={hostRef}
        className="mt-5 h-[420px] w-full overflow-hidden rounded-[var(--r-md)] border border-line bg-sunk"
      />
      {report && (
        <pre className="scroll-quiet mt-5 max-h-[420px] overflow-auto rounded-[var(--r-md)] border border-line bg-sunk p-4 text-[12px] leading-relaxed text-muted">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}
