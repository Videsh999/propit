# PropIT brand assets

The **navbar and footer mark is drawn in code**, not loaded from here — see
`src/components/nav/propit-mark.tsx`. A 1254px 3D render cannot be shown at 28px
without turning into a coloured smudge, and it would soften on every
non-integer device pixel ratio. So the lockup has no asset dependency and is
correct on a cold clone with this folder empty.

Two raster slots remain, both for contexts that genuinely want the full artwork:

| File | Used by | Notes |
|---|---|---|
| `public/brand/propit-logo.png` | Open Graph and Twitter link previews, from `src/app/layout.tsx` | The full globe-plus-wordmark lockup. A link preview is a wide card rendered at hundreds of pixels, where the detail pays off. |
| `src/app/icon.png` | the browser favicon and tab icon | The rounded-square app icon. Next.js picks this up **by filename convention** and generates every size itself — there is no config to change. Add `src/app/apple-icon.png` too for iOS home screens. |

Until those two exist, the link preview falls back to no image and the favicon to
the Next.js default. Nothing else is affected.

The wordmark beside the mark is live text. Its two hues are the `--brand-navy` /
`--brand-gold` tokens in `globals.css`, which is also where the reason the gold
is deepened from the artwork's own `#e9a21c` is recorded.
