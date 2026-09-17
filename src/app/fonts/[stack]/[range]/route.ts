import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Glyph ranges PropIT does not ship.
 *
 * `public/fonts/` carries Latin (0–511), which covers street names and locality
 * labels. It does not carry U+20B9 — the rupee sign — which lives in range
 * 8192–8447 and appears in every price on the map. Nor does it carry Telugu.
 *
 * Unserved ranges used to fall through to the app router and come back as an
 * HTML 404, which MapLibre logged as an AJAXError once per range per font. It
 * recovers either way by rasterising the codepoint with a local font, so this
 * changes nothing on screen — it just makes the miss a legitimate empty answer
 * rather than an error, and answers it instantly instead of rendering a page.
 *
 * Ranges that do exist are served straight from `public/` and never reach here.
 */

/** A glyphs PBF containing one fontstack with no glyphs in it. */
function emptyStack(name: string, range: string): ArrayBuffer {
  const enc = new TextEncoder();
  const field = (num: number, payload: Uint8Array) => {
    const head = [(num << 3) | 2];
    let len = payload.length;
    // protobuf varint length prefix
    const lenBytes: number[] = [];
    do {
      let b = len & 0x7f;
      len >>>= 7;
      if (len) b |= 0x80;
      lenBytes.push(b);
    } while (len);
    return Uint8Array.from([...head, ...lenBytes, ...payload]);
  };

  const stack = new Uint8Array([
    ...field(1, enc.encode(name)), // fontstack.name
    ...field(2, enc.encode(range)), // fontstack.range
  ]);
  const out = field(1, stack); // glyphs.stacks
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ stack: string; range: string }> },
) {
  const { stack, range } = await ctx.params;
  const name = decodeURIComponent(stack);
  const file = decodeURIComponent(range);

  // Defend the read: these segments come from the URL.
  if (!/^[\w .-]+$/.test(name) || !/^\d+-\d+\.pbf$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const buf = await readFile(path.join(process.cwd(), "public", "fonts", name, file));
    return new Response(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, {
      headers: {
        "Content-Type": "application/x-protobuf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(emptyStack(name, file.replace(/\.pbf$/, "")), {
      headers: {
        "Content-Type": "application/x-protobuf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
}
