# PROGRESS

Running production log. Newest entries at the bottom of each section.

## Tooling
- `tools/capture.mjs <url> <prefix> <args…>`: headless Chromium (SwiftShader
  WebGL2), calls `window.__renderAt(arg)`, and saves PNGs.
- `tools/sheet.py`: contact sheets for review.
- Local server: `http-server -p 8123 -s -c-1 .`

## Log

### Session 1

- Concept chosen: KINTSUGI (see PLAN.md).
- Spike 1, bowl look-dev (`spikes/bowl.html`).
  - Lathe SDF from an 8-point profile, Catmull-Rom resampled to 16
    points.
  - **Problem:** a polyline lathe shows faceted bands under glossy
    shading.
    - Fix: Phong-style normal correction. The shader computes the
      faceted and the interpolated 2D profile normals and adds the
      difference to the numerical normal, which keeps the wobble and
      ridge detail.
  - Celadon: Beer–Lambert thickness absorption plus milky scatter.
    Crackle is a warped two-scale Voronoi border.
    - Fixed: the first pass was too dense and read as reptile skin.
  - Gold seams share the fracture seeds and read well on the first try.
  - Pooled glaze showed sparkle noise from a high-frequency thickness
    term; replaced with a low-frequency term.
