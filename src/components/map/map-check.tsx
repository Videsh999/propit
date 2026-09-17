"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, type MapSourceDataEvent, type ErrorEvent } from "maplibre-gl";
import { Check, X, Loader2, Copy } from "lucide-react";
import {
  basemapSources, buildRasterStyle, loadVectorStyle, GLYPHS_URL, type BasemapSource,
} from "@/lib/providers/basemap";
import { cn } from "@/lib/utils";

type State = "pending" | "pass" | "fail";
interface Row {
  id: string;
  label: string;
  detail: string;
  state: State;
}

/** A tile request the browser actually performs, so extensions and DNS count. */
function probeImage(url: string, timeoutMs = 12000): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    const started = performance.now();
    const img = new Image();
    img.crossOrigin = "anonymous";
    const done = (ok: boolean, detail: string) => {
      img.onload = img.onerror = null;
      resolve({ ok, detail });
    };
    const timer = window.setTimeout(() => done(false, "timed out after 12s"), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      done(true, `${Math.round(performance.now() - started)} ms · ${img.naturalWidth}×${img.naturalHeight}`);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      done(false, "blocked or unreachable");
    };
    img.src = url;
  });
}

export function MapCheck() {
  const [rows, setRows] = useState<Row[]>([]);
  const [copied, setCopied] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  const set = useCallback((id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const run = useCallback(async () => {
    const providers = basemapSources();
    const initial: Row[] = [
      { id: "webgl", label: "WebGL", detail: "checking…", state: "pending" },
      { id: "glyphs", label: "Map fonts (served by PropIT)", detail: "checking…", state: "pending" },
      ...providers.map((p: BasemapSource) => ({
        id: `tiles-${p.id}`,
        label: `${p.kind === "vector" ? "Style" : "Tiles"} · ${p.name}`,
        detail: "checking…",
        state: "pending" as State,
      })),
      { id: "render", label: "Map actually paints", detail: "waiting…", state: "pending" },
    ];
    setRows(initial);

    // 1. WebGL
    let gl: WebGLRenderingContext | null = null;
    try {
      const c = document.createElement("canvas");
      gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "available";
      set("webgl", { state: "pass", detail: renderer.slice(0, 60) });
    } else {
      set("webgl", { state: "fail", detail: "not available — the map cannot render" });
    }

    // 2. Glyphs, served from this app
    try {
      const res = await fetch(GLYPHS_URL.replace("{fontstack}", "Open%20Sans%20Regular").replace("{range}", "0-255"));
      set("glyphs", {
        state: res.ok ? "pass" : "fail",
        detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} — labels will not draw`,
      });
    } catch (e) {
      set("glyphs", { state: "fail", detail: (e as Error).message });
    }

    // 3. Each source, in the order the map tries them
    let firstWorking: BasemapSource | null = null;
    for (const p of providers) {
      if (p.kind === "vector") {
        const started = performance.now();
        try {
          const res = await fetch(p.styleUrl!, { signal: AbortSignal.timeout(12000) });
          const ok = res.ok;
          set(`tiles-${p.id}`, {
            state: ok ? "pass" : "fail",
            detail: ok ? `HTTP ${res.status} · ${Math.round(performance.now() - started)} ms` : `HTTP ${res.status}`,
          });
          if (ok && !firstWorking) firstWorking = p;
        } catch (e) {
          set(`tiles-${p.id}`, { state: "fail", detail: (e as Error).message });
        }
        continue;
      }
      const url = (p.tiles?.[0] ?? "")
        .replace("{z}/{y}/{x}", "12/1846/2941")
        .replace("{z}", "12")
        .replace("{x}", "2941")
        .replace("{y}", "1846");
      const probe = await probeImage(url);
      set(`tiles-${p.id}`, { state: probe.ok ? "pass" : "fail", detail: probe.detail });
      if (probe.ok && !firstWorking) firstWorking = p;
    }

    // 4. A bare MapLibre map — no PropIT layers — to isolate our code from theirs
    if (!gl || !mapNode.current) {
      set("render", { state: "fail", detail: gl ? "no container" : "needs WebGL" });
      return;
    }
    const provider = firstWorking ?? providers[0];
    let bareStyle;
    try {
      bareStyle =
        provider.kind === "vector"
          ? await loadVectorStyle(provider, "light")
          : buildRasterStyle(provider, "light");
    } catch {
      set("render", { state: "fail", detail: `${provider.name} style would not load` });
      return;
    }
    const map = new MapLibreMap({
      container: mapNode.current,
      style: bareStyle,
      center: [78.46, 17.4],
      zoom: 10.5,
      attributionControl: false,
    });
    let painted = false;
    map.on("sourcedata", (e: MapSourceDataEvent) => {
      if (e.tile && !painted) {
        painted = true;
        set("render", { state: "pass", detail: `imagery drawn from ${provider.name}` });
      }
    });
    map.on("error", (e: ErrorEvent) => {
      if (!painted) set("render", { state: "fail", detail: e.error?.message ?? "map error" });
    });
    window.setTimeout(() => {
      if (!painted) {
        set("render", {
          state: "fail",
          detail: "no tile reached the canvas within 10s",
        });
      }
    }, 10000);
  }, [set]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();
  }, [run]);

  const summary = rows
    .map((r) => `${r.state === "pass" ? "PASS" : r.state === "fail" ? "FAIL" : "…"}  ${r.label} — ${r.detail}`)
    .join("\n");

  return (
    <div className="mt-10">
      <ul className="divide-y divide-[var(--line)] border-y border-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3.5">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                r.state === "pass"
                  ? "bg-[var(--accent-wash)] text-accent"
                  : r.state === "fail"
                    ? "bg-[color-mix(in_srgb,var(--data-clay)_14%,transparent)] text-[var(--data-clay)]"
                    : "bg-sunk text-faint",
              )}
            >
              {r.state === "pass" ? (
                <Check size={13} strokeWidth={2.5} />
              ) : r.state === "fail" ? (
                <X size={13} strokeWidth={2.5} />
              ) : (
                <Loader2 size={12} className="animate-spin" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] text-ink">{r.label}</span>
              <span className="block truncate text-[12px] text-faint">{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(summary);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-[var(--r-md)] border border-line bg-raised px-4 text-[14px] text-ink transition-colors hover:border-line-strong"
        >
          <Copy size={14} strokeWidth={1.75} />
          {copied ? "Copied" : "Copy results"}
        </button>
        <span className="text-[12px] text-faint">Paste these back and I&apos;ll know exactly what to fix.</span>
      </div>

      <p className="eyebrow mt-10 mb-3">Bare MapLibre map — no PropIT code</p>
      <div
        ref={mapNode}
        className="overflow-hidden rounded-[var(--r-lg)] border border-line"
        style={{ height: 360 }}
      />
      <p className="mt-2.5 text-[12px] leading-relaxed text-faint">
        If this square shows a map but the homepage doesn&apos;t, the problem is in PropIT&apos;s map
        layer. If this is blank too, it&apos;s WebGL or the network.
      </p>
    </div>
  );
}
