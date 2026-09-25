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
- Spike 3, **the seam** (`scenes/seam.glsl`).
  - Cracks are real geometry: the warped-Voronoi border carves a canyon
    through the shell.
  - Gold is a separate SDF that fills the canyon and domes over the
    glaze, gated by a front expanding from the impact point. It cools
    from molten emissive to burnished metal.
  - Problems found and fixed:
    - A carve sign error kept only the canyons.
    - Gold was dark in the void because it had nothing to reflect.
      Added a warm horizon and a low sun key.
    - The macro plain was featureless, the horizon tilted, and the
      camera looked across the seam instead of along it.
      - The seam is now traced in JS (`Bowl.traceSeam`, snapping to the
        border in (s, angle) space); the camera rides the polyline.
      - Camera up = surface normal; key light rakes from ahead.
      - Macro orange-peel ripple added.
  - **Result:** a canyon receding across a jade sea toward a low sun, the
    gold river arriving from the horizon, then the rise to the whole
    bowl. Proven. The rise framing needs direction work.
- Studio (clay) scene (`scenes/studio.glsl`).
  - Window shaft with analytic occlusion, dust motes, slip-covered wheel
    head, splash pan, blurred shelf of pots.
  - Throwing choreography: lump, cone, lump (centring), opened,
    cylinder, thrown, trimmed (foot grows), dipped (raw glaze from the
    rim down).
  - **Bug:** wet clay came out green because glaze colour was applied
    before any glaze existed. Glaze is now gated on
    `max(rawCoverage, melt)`.
- Kiln scene (`scenes/kiln.glsl`).
  - Brick vault with ash-glaze drips; volumetric flame; sparks; ember
    bed; the door opens to cool dawn light while the crackle forms.
  - First pass was an overexposed orange soup. Rebalanced:
    - Sparser flame tongues with noise stretched along the flow, plus
      ridged filaments.
    - Walls cooler and dimmer; the bowl cooler than the flames.
    - Exposure ramps down at the peak.
  - DOF blurred the flames because it used the depth of the wall behind
    them. The fire now writes a luminance-weighted depth.
  - TODO (review): more contrast between the tongues; the other wares
    still look like eggs; tune the start of the fire.
- Score (`src/js/audio.js`).
  - All synthesis is sample-level JS in `KintsugiSynth`.
  - Instruments:
    - Shakuhachi: sine core, breath band-pass, meri-kari bend, vibrato.
    - Koto: fractional-delay Karplus–Strong with pluck comb and oshide
      bend.
    - Felt piano: inharmonic additive partials, unison beating, hammer.
    - Wavetable string pads; taiko; rin bowl; music-box bells; glaze
      pings.
    - Noise sound design: brush, wheel, fire, door, pour, birds,
      cicadas, wind, shatter, gold shimmer.
  - Rendered in 4 parallel Workers (fixed time windows, separate RNGs for
    composition and noise, so the result is deterministic). Then an
    OfflineAudioContext adds convolution reverb (generated,
    energy-normalised IR), a compressor and a soft clipper, giving one
    AudioBuffer. Picture is clocked from its playback, so sync is
    sample-accurate and seeking is trivial.
  - Problems found and fixed:
    - Everything clipped at −2 dB RMS: the IR was not
      energy-normalised.
    - Synthesis took 80 s. Down to ~13 s single-threaded by moving
      pitch and envelope to control rate, inlining biquads, and adding
      early exits for piano partials; about 5 s wall-clock in parallel.
    - Koto was ~17 cents flat because the loop filter adds half a
      sample. Compensated; verified 0.0–0.1 cents by autocorrelation.
    - Dynamics were too flat because the compressor lifted the intro.
      The arc now goes: intro −19, clay −21, fire peak −10,
      cooling −20, life −17, alone −22, frozen −18, climax −9.9 (the
      loudest), mended −20.
  - Tools: `tools/audio.mjs` renders to WAV in headless Chromium;
    `tools/analyze.py` prints per-bar RMS/peak and draws a log-frequency
    spectrogram.
- Ensō scene (`scenes/enso.glsl`).
  - Washi fibres and pulp relief under raking light.
  - The stroke is pressure-driven: touch-down pool, bristle streaks,
    dry-brush tail, feathering, wet sheen. Gold variant for the end.
- AgX "punchy" look added to the final grade (power 1.35, sat 1.4). The
  base AgX toe lifted the blacks to about 0.4, so the ink read as grey.
- **Full director** (`src/js/film.js`).
  - 8 shots and 7 transitions: ink bleed, ember burn, mist, cut on
    impact, crossfade at macro scale, mist, ink bleed.
  - Cameras and grades blend across transitions; both scenes render with
    the shared camera, so the world-space compositor lines up.
  - Life is a time-lapse on a continuous day counter: seasons; tenmoku
    arrives day 1 and is gone after day 10; per-day placement jitter;
    gap closes until the bowls touch; tea each morning; candle nights;
    stain accumulates.
  - Lift, tremble and slip over the table edge; a slow-motion fall to
    the floorboards.
  - Break: shards rise from the impact into a constellation. The camera
    visits 4 memory shards on the musical fragment cues, then dives into
    the crack.

## Review pass 1 (51 frames, every 5 s, 768×321)

### Director
1. Ensō: the brush-tip disc renders ahead of the dry tail as a detached
   dot (t≈10).
2. Fire, t 55–88: 30 s of near-uniform orange haze. Monotonous, no arc.
   **Weakest section.** It needs a dark beginning with flames licking,
   a build, and a white-hot peak.
3. Cooled kiln, t 90–95: the other wares read as eggs; the ember floor
   reads as polka dots; the bowl looks like a toy under flat cold light.
4. Life: nights go pitch black; at 3.5 s/day that will strobe. Needs
   moonlight and shorter nights.
5. Life composition: bowls small, lots of dead dark table. Go lower and
   closer.
6. The fall, t≈155: the frame is empty (floor plus window band) while
   the bowl is out of frame.
7. Memories all look alike (bowl close-ups). Each needs a
   season-dominant image: blossom, green, maple, snow, candle.
8. Climax, t 205–220: the mended bowl sits in darkness at the musical
   peak. It should be the most glorious light in the film.
9. Mended: the steam is orange and huge. It reads as fire and covers the
   top-down shot at t≈240.
10. Title overlaps the ensō; it is too faint and small.

### Cinematographer
11. Studio: the wheel head is a flat pink disc; the wet clay has no gloss.
12. Life: table too dark, shoji clipped; the sun blade rarely touches the
    bowls.
13. Shards: thick beige halos from the fracture face plus edge glow; the
    portals are overexposed.
14. Mended room: murky; gold not gleaming.

### Engineer
15. Celadon rim: speckled white sparkle at bowl scale (aliasing in the
    thin-glaze rim).
16. Steam colour follows dusk sun too strongly.
