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
- Engine built (`src/js/engine.js`, `src/glsl/post.glsl`).
  - Scene pass to RGBA16F (rgb plus linear depth), then the world-space
    transition composite.
  - Half-res gather DOF.
  - 13-tap bloom pyramid.
  - AgX tonemap with grade, CA, vignette and grain.
  - Canvas is fitted to 2.39:1; dynamic resolution.
- Build: `node tools/build.mjs` inlines everything into `index.html`.
  Capture is `index.html?capture`, with
  `__renderAt("t:key=v,eye=x;y;z,tgt=…")` overrides for look-dev.
- Room / Life look-dev (`src/glsl/room.glsl`).
  - All parameters live in a `Mem` struct, so the same room can be
    re-traced at any remembered moment.
  - First pass was overexposed, with a mirror-like table and lattice
    shadows from paper, which is wrong.
    - Fixed: the paper is a soft area light; hard sun comes only through
      the slid-open gap as a blade of light.
    - Fixed: the reflected shoji blurs with roughness; fill light added
      from the room behind the camera.
  - AO ring artifacts came from bounding spheres being used inside the AO
    taps; the bound threshold was raised.
- Spike 2, **memory shards** (`src/glsl/shards.glsl`,
  `scenes/break.glsl`, `src/js/shatter.js`).
  - Shard = shell ∩ warped Voronoi cell. The warp is analytic sines,
    mirrored in JS for centroids and bounds.
  - Per-pixel ray vs bounding-sphere culling keeps ≤6 candidates.
  - Portal: the view ray is transformed into the shard frame, then into a
    per-memory camera, and the room is traced with that shard's `Mem`.
    - First try was too zoomed and drifted with shard orientation.
      Recentring on the camera→centroid direction frames each memory like
      a painting, with parallax kept.
  - **Result: legible.** Two bowls, shoji and the summer garden, each in
    its own shard. Proven.
  - Cost is about 2× the Life scene in SwiftShader.
- Known issue: a speckled "salty" inner rim on the celadon at small
  scale. Revisit in polish.
