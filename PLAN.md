# KINTSUGI — production plan

A real-time, fully procedural short film for one browser tab.
One HTML file, raw WebGL2 + Web Audio, zero assets.

---

## Phase 1 — Concept

### Forty concepts

| # | Concept | Genre / mood |
|---|---------|--------------|
| 1 | An origami crane unfolds to a flat sheet, then refolds into the world it flies over | whimsy |
| 2 | A lighthouse keeper's life told only by the beam sweeping through fog | melancholy |
| 3 | A drop of ink becomes a calligraphic creature swimming through a scroll painting | myth |
| 4 | A world inside a soap film, living only as long as the bubble | fragility |
| 5 | A moth drawn to a lamp, scaled up to cosmic proportions | tragedy |
| 6 | **Kintsugi: the life of a tea bowl, from clay to fire to use to breaking to golden repair** | grief / hope |
| 7 | A felt-and-yarn stop-motion village knitted by an unseen hand | cozy |
| 8 | A clock escapement: time as a physical machine that jams | tension |
| 9 | Shadow-puppet theatre where the shadows leave their puppets | uncanny |
| 10 | A snowflake from nucleation to meltwater in a spring stream | cycle |
| 11 | A photograph developing in a darkroom tray, the scene coming alive as it emerges | memory |
| 12 | A cathedral floor over one day: the story is the stained-glass light moving across it | sacred |
| 13 | A handwritten letter's journey: ink, paper fibres, envelope, reader's tears | love |
| 14 | A seed's root system seen as an underground city | growth |
| 15 | Whale fall: a whale dies and becomes a deep-sea ecosystem | awe / death |
| 16 | A paper lantern floating downriver through a night festival | nostalgia |
| 17 | The last candle during a blackout, a family's evening in its circle | intimacy |
| 18 | A loom weaving the tapestry of the story it is in | meta |
| 19 | The comb and cylinder of a music box, from inside | childhood |
| 20 | A bioluminescent tide washing a beach at night | wonder |
| 21 | A tidepool's day as a microcosm | nature doc |
| 22 | A bubble of air trapped in glacier ice for 10,000 years, finally released | patience |
| 23 | Camera obscura: a dark room where the world outside is projected upside down | perception |
| 24 | A chess game played by the pieces themselves | strategy |
| 25 | One continuous line that draws the entire film and refuses to end | playful |
| 26 | Frost on a windowpane growing into a forest | winter |
| 27 | Tea leaves unfurling in a cup, each leaf remembering its mountain | calm |
| 28 | A dandelion seed crossing a continent | journey |
| 29 | Salt crystals growing from a dried tear | sorrow |
| 30 | A sand mandala built grain by grain and swept away | impermanence |
| 31 | A single spark's life inside a firework | euphoria |
| 32 | A map that becomes the land it depicts | adventure |
| 33 | A marionette that cuts its own strings | freedom |
| 34 | A mycelium network under a forest, passing a message tree to tree | connection |
| 35 | A lost astronaut seen only in reflections on their visor | isolation |
| 36 | Rain on a window, each drop refracting a different memory | longing |
| 37 | A tree's rings read as the history of a village | time |
| 38 | A bell being cast: bronze, mould, first strike | ceremony |
| 39 | A clockwork bird rebuilt by a child from scrap | repair |
| 40 | A photon's journey from the sun's core to a human eye | science |

### Elimination

Removed as creative-coding tropes or too safe:

- Particle galaxies / cosmic scale: 5, 40, 31
- Fractal or powers-of-ten gimmicks: 14, 21
- Flow fields, fluid-sim screensavers: 3, 20
- Terrain flyovers: 32, 28
- Raymarched blobs or soap: 4
- Rain-on-glass is a well-known shader: 36
- Frost/crystal growth is standard DLA: 26, 29
- Already iconic in other media, or needs readable human characters (hard to make wall-worthy procedurally): 13, 17, 33, 35, 24, 39
- Weaker emotional core: 1, 7, 8, 9, 18, 19, 23, 27, 30, 34, 37, 38, 10, 11, 12

Shortlist: **6 Kintsugi**, **22 Glacier breath**, **2 Lighthouse**, **15 Whale fall**, **16 Lantern**.

### Scoring (1–10)

| Concept | Beauty | Emotion | Difficulty | Originality | Total |
|---|---|---|---|---|---|
| **Kintsugi** | 9 | 10 | 9 | 9 | **37** |
| Glacier breath | 9 | 7 | 8 | 8 | 32 |
| Whale fall | 8 | 9 | 8 | 7 | 32 |
| Lighthouse | 8 | 8 | 7 | 6 | 29 |
| Lantern | 8 | 7 | 6 | 6 | 27 |

### Why Kintsugi

*Kintsugi* (金継ぎ) is the Japanese practice of mending broken pottery with
lacquer and gold, so that the break becomes the most beautiful part of the
object.

- **Emotion.** A whole human life can be told without one human on screen,
  through what happens to a bowl on a table: tea poured, a second bowl
  arriving, years of mornings, a place at the table suddenly empty, a
  trembling lift, a fall. Grief and repair are universal, and the ending
  earns its hope.
- **Beauty.** Wet clay under raking light, a wood-fired kiln, celadon
  glaze with crackle, dust in window light, and molten gold in the dark.
  Every scene has a strong lighting idea.
- **Difficulty.** A thrown-clay lathe SDF, layered glaze shading
  (thickness pooling, crackle, tea stains), volumetric kiln fire and ash
  glaze melt, a time-lapse room with seasons, a procedural fracture into
  Voronoi shards, and a continuous zoom into a crack.
- **Originality.**
  - **Shards as windows into memory.** In the frozen moment after the
    bowl breaks, each shard's glaze shows a different moment of its life,
    rendered live: the same procedural room re-traced at a different
    time, season and light for each shard. This is the film's
    unprecedented moment.
  - **Continuous zoom.** The camera zooms without a cut from a bowl on a
    table into the gap between two shards, where the fracture faces
    become canyon walls and gold flows in as rivers. It then rises back
    out to the mended bowl.
- **Structure.** The bowl is always the anchor, so the worlds can change
  around it without cutting to black. The ensō (the Zen brush circle)
  opens and closes the film, matched to the bowl's rim seen from above.

---

## Phase 2 — Pre-production

### Logline

A tea bowl is thrown, fired, and loved through a lifetime of shared
mornings. When the person it belonged to is gone, it falls and breaks,
and in the frozen instant of breaking it remembers everything. Then it is
mended with gold.

### Emotional arc

`stillness → becoming → ordeal → warmth / companionship → loss → rupture → memory → repair → quiet hope`

The protagonist is the bowl. The people are never seen. They exist only
through tea, steam, candlelight, a second bowl, a lift that trembles, and
an absence.

### Tempo grid

- 72 BPM, 4/4, so one bar is 3.333 s.
- Scene boundaries sit on bar lines so that picture and score lock.
- Total length is 76 bars, about 4:13.

### Timed shot list

| Scene | Bars | Time | Camera | Key visual | Music cue |
|---|---|---|---|---|---|
| **0 — ENSŌ** | 0–6 | 0:00–0:20 | Locked top-down over rice paper, slow push-in | A brush paints an ensō in one breath: bristle streaks, dry-brush breakup at the end, ink bleeding into the paper fibres | Rin bell. Solo shakuhachi states the theme (A–C–D–E–D). |
| ↳ transition | 5–6 | 0:17–0:20 | Push through the paper | The circle aligns with a spinning clay rim seen from above. The paper dissolves as ink-wash, from the circle outwards, into the studio. | Breath swells into the koto's first pluck. |
| **1 — CLAY** | 6–17 | 0:20–0:57 | Top-down tilts to a ¾ low orbit around the wheel, slowing | Dark studio, one window shaft with dust motes. The clay rises from a lump to a cylinder to an open bowl (animated lathe profile). Wet glossy clay with throwing rings. The wheel slows. Then a time-lapse of drying: dark wet clay to pale bisque, and the light moves. | Koto arpeggios, soft pad, water and wheel-hum sound design. Theme on koto. |
| ↳ transition | 16–17 | 0:53–0:57 | Orbit continues | The window light reddens. From the floor outwards the studio walls are consumed by an ember-edged burn front, revealing kiln brick. | Low drone, first taiko. |
| **2 — FIRE** | 17–29 | 0:57–1:37 | Slow dolly in, then a macro on the glaze | A wood-fired kiln chamber with volumetric flame. Ash motes land and melt into glassy runs. The bowl glows incandescent (blackbody), with heat shimmer. At bar 25 the fire dies to embers; the glaze cools to celadon; crackle lines race across the surface with tiny *pings*. | Taiko accelerando, low strings, dissonant cluster, peak at bar 24. Then silence plus tuned glaze-crazing pings. |
| ↳ transition | 28–29 | 1:33–1:37 | Pull back | The last ember glow becomes low dawn sun. Brick dissolves into plaster and a wooden table. | Pings resolve into piano. |
| **3 — LIFE** | 29–47 | 1:37–2:37 | Very slow orbit and height drift, never still | A room by a shōji window. **Time-lapse:** the sun sweeps; the seasons pass outside (blossom, green, maple, snow). Matcha is poured, with froth and steam. A dark tenmoku bowl arrives beside it. Over the years the two bowls drift closer until they touch, and tea stains darken the crackle. Candle nights. **Bar 42:** the dark bowl is gone, leaving a faint ring on the wood. Winter, no steam, and time slows. | Piano with flute and koto duet: the theme in two voices. At bar 42 the second voice drops out and the piano plays alone, sparse. |
| **4 — BREAK** | 47–56 | 2:37–3:07 | Low, close | The bowl lifts from the table (unseen hands), trembles, and drops. Super slow motion: the fracture propagates from the impact point and shards separate. Time freezes. The room falls away into darkness. The camera drifts among suspended shards; **each shard's glaze is a window into a different remembered moment** (spring morning with two bowls, candle night, autumn). | Silence for the fall. Shatter: layered noise and tuned ceramic tinks. Reverse-reverb swell. Each memory shard sounds a fragment of the theme as the camera passes it. |
| **5 — THE SEAM** | 56–67 | 3:07–3:40 | Continuous zoom in, then a rise | Shards drift back together. The camera enters the closing gap: fracture faces become canyon walls of fired clay, glaze strata at the rim. Gold light appears far off and flows through the canyons like a river at dawn, with tributaries joining. The camera rises; the gold network becomes the seam lines of the mended bowl. | The theme returns fully harmonised: strings, piano, flute, koto, taiko. A key lift at the climax (bar 62). |
| **6 — MENDED** | 67–76 | 3:40–4:13 | Orbit, then a slow crane up to top-down | Spring morning. The bowl on the table with gold seams catching the sun, fresh tea and steam. The empty place beside it is still empty, but sunlit; one blossom petal lands there. Top-down: rim plus seams dissolve into a **gold ensō** on paper. Title. | Koto and flute restate the theme in major, then the rin bell. |

### Technical breakdown

**Engine** (raw WebGL2, no libraries, so every pixel is ours)

- Timeline and sequencer, clocked by `AudioContext.currentTime`.
  - Keyframe tracks with easing drive every uniform.
  - Scene table with overlap regions for transitions.
- Per-scene raymarched fragment shaders that share a GLSL library: noise,
  SDF operators, the bowl, materials and lighting.
- Each scene writes HDR colour to an RGBA16F target, with linear depth in
  the alpha channel.
- **World-space transition compositor.**
  - Both scenes render with the same camera.
  - The compositor reconstructs world position from depth and blends with
    a scene-specific spatial mask: ember burn front, ink bleed, light
    bloom.
  - The result is transitions that happen *in the world*, not in screen
    space.
- Post chain:
  - Bloom: a dual-filter pyramid.
  - Heat shimmer and lens distortion.
  - Chromatic aberration at the edges.
  - Per-scene colour grade (lift / gamma / gain).
  - Filmic tonemap (AgX-like).
  - Vignette and film grain.
  - Letterbox at 2.39:1.
- Dynamic resolution driven by a GPU-time estimate from frame time, so
  weaker GPUs stay at 60fps.
- Debug: `#debug` shows a scrubber, time readout, fps and scale, and
  `#t=123.4` jumps to a time. Capture mode (`?capture`) gives
  deterministic time for the screenshot pipeline.

**The bowl**

- Lathe SDF.
  - A 2D profile polyline of up to 16 points, revolved.
  - Distance to a thick stroke: the wall has a thickness profile.
  - Angle-dependent wabi-sabi: rim height wobble, slight oval.
- Throwing:
  - Profile keyframes are interpolated on the CPU.
  - Throwing rings are a normal perturbation.
  - Rotation reads through texture noise and slurry streaks.
- Glaze shading:
  - Thickness field (pooling in the well, drips on the exterior that stop
    above the foot).
  - Beer–Lambert celadon absorption over the clay body.
  - Clearcoat GGX with Fresnel.
  - Crackle network: a Voronoi edge field that tea stains darken over
    time.
  - Unglazed foot ring flashed toasted orange.
  - Blackbody emission for the kiln.
  - Wet / dry / bisque parameters.
- Kintsugi seams are the *same* Voronoi cells used for the fracture:
  metallic gold with a lacquer bead, so the story is consistent.

**Scenes**

- Paper and ensō: 2D shader.
  - The brush path is a param curve with bristle streak noise, pressure
    over time, and dry-brush breakup.
  - Ink bleed follows the paper fibre field (anisotropic noise).
- Studio:
  - Box room with a window shaft; volumetric light with analytic
    occlusion by the window frame.
  - Dust motes: analytic points inside the shaft.
- Kiln:
  - Brick arch SDF.
  - Volumetric fire: domain-warped fbm density, blackbody colour, 24–32
    steps.
  - Ash particles are analytic.
  - Emission lights the bowl through an approximate irradiance.
- Room:
  - Table (wood grain), shōji window with a paper-diffused sun, and a
    seasonal garden seen through the open panel as a stylised 2.5D
    raymarched background.
  - Matcha surface with froth, steam volumes, candle.
  - A sun-shaft volumetric.
  - Second bowl (tenmoku).
  - All parametrised by `(dayTime, season, occupancy)`, so the same
    function can be evaluated at *any past moment*. That is what makes the
    memory shards possible.
- Shards:
  - 3D Voronoi of about 14 seeds on the bowl surface. Each shard is the
    shell intersected with its cell, with its own rigid transform.
  - Per-pixel culling: a ray vs bounding-sphere pass collects up to 6
    candidate shards, and only those are marched.
  - Fracture faces show the rough clay body with a thin glaze line.
- Memory portals: on shard hit, the glaze term is replaced by a trace of
  the room function at `memory[i] = (dayTime, season, occupancy)`,
  through a parallax-correct virtual window, blended with a Fresnel
  reflection.
- Seam world:
  - A continuous-scale camera; detail functions stay scale-aware so
    micro-roughness becomes canyon relief.
  - Fracture faces are conchoidal-fracture noise (ridged, curved).
  - Gold flow is an advected front along the canyon floor with emissive
    blackbody-to-gold colour, viscous surface noise, and the bloom
    feeding the atmosphere.

**Audio** (Web Audio API, all synthesised)

- Instruments:
  - Shakuhachi: breath noise into a bandpass, a sine core with vibrato,
    pitch bends and a jet-noise attack.
  - Koto: Karplus–Strong via AudioWorklet, with oshide bend.
  - Felt piano: inharmonic additive partials, hammer noise, sympathetic
    resonance.
  - String pad: detuned saws through a lowpass.
  - Taiko: pitched sine drop plus skin noise.
  - Rin bell: inharmonic partials, long decay.
- Convolution reverb with a generated stereo impulse response.
- One master timeline schedules the notes and the sound-design events
  (wheel hum, water, fire roar, glaze pings, pour, steam hiss, rain,
  shatter, gold shimmer).

### Risk register and proofs (spikes)

| Risk | Why risky | Proof |
|---|---|---|
| Glaze look-dev | The whole film rests on the bowl reading as real ceramic | `spikes/bowl.html`: lathe SDF, celadon glaze, crackle, stills from 4 lighting setups |
| Shard SDF performance and correctness | 14 cells × planes × march steps | `spikes/shards.html`: Voronoi cells, culling, fracture faces |
| Memory portals legibility | Could read as noise instead of memories | Same spike, with the room function re-traced per shard |
| Continuous zoom into a crack | Precision and detail across 3 orders of magnitude | `spikes/seam.html` |
| Kiln fire | Volumetric cost; must not look like a generic flame shader | `spikes/fire.html` |
| Score quality | Must be real music, not beeps | `spikes/audio.html`, rendered offline to WAV, checked by spectrogram and levels |

### Performance budget (1080p output, mid-range laptop GPU)

- The render scale is dynamic from 0.5 to 1.0; the table gives the target
  scale per scene.
- Post-processing is about 1.5 ms per frame.

| Scene | Target render scale | Primary cost | Budget |
|---|---|---|---|
| Ensō | 1.0 | 2D fbm | 2 ms |
| Clay | 0.75 | bowl march, 64 steps, plus shaft (16 steps) | 8 ms |
| Fire | 0.6 | fire volume (28 steps) plus bowl | 11 ms |
| Life | 0.7 | room march, soft shadow, steam (16 steps), shaft | 10 ms |
| Break / shards | 0.7 | culling plus ≤6 cells plus portal trace | 11 ms |
| Seam | 0.7 | heightfield march, 80 steps, gold | 9 ms |
| Transitions (2 scenes) | 0.55 | both scenes | 13 ms |
