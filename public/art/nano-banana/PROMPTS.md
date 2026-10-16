# Stormline — Google Flow / Nano Banana 2.1 test

Generated 16 October 2026 in the user's existing monsoon-rooftops project. Used the model explicitly requested by the user, through the Google Flow browser UI; no built-in image generator or API fallback was used. Each submission used one image and the UI showed 0 credits.

Project: https://flow.google.com/project/a83e7dd9-0d71-43f8-bef0-5adc11f4b4df

## 01 / Concept image

File: stormline-concept.jpg (original JPEG bytes, 1376 x 768, 172884 bytes).

Create one wide 16:9 art-direction concept image for STORMLINE: MONSOON ROOFTOPS, a fast mobile-friendly 3D rooftop grappling game set in a fictional near-future Mumbai during the monsoon. It must look achievable as a beautiful stylized real-time indie game: bold architectural silhouettes, simplified geometry, hand-painted material detail, strong depth and readable action. Third-person camera behind a small courier in a cream rain jacket with a burnt-orange scarf, captured mid-swing on a taut cable attached to a clearly visible acid-yellow crane hook. A sequence of wet concrete rooftops leads through the frame to an elevated commuter train. Rooftop water tanks, corrugated awnings, weathered residential towers and a few warm shop windows give the city local character. Flooded streets far below. Moody blue-green storm haze and warm amber practical lights; restrained off-white, charcoal teal, rust orange and acid-yellow palette. Keep landing surfaces and the grapple target brighter than distant background detail. Make the player tiny compared with the city to sell height and speed. Wide composition with quieter dark sky in the upper-left for a future menu title, but render NO text, NO logos, NO interface, NO watermarks. This is an aspirational game art reference, not a photoreal photograph or a screenshot of an existing game. Avoid busy neon cyberpunk, excessive bloom and unreadably dark rooftops.

## 02 / Concrete colour map

File: rooftop-concrete.jpg (original JPEG bytes, 1024 x 1024, 113264 bytes).

Generate one square, seamlessly tileable diffuse albedo texture for a stylized 3D game rooftop in a rainy near-future Mumbai city. The entire image is ONE continuous flat material sample of weathered grey-green poured concrete with subtle aggregate, irregular fine hairline cracks, tiny worn patches, scattered soft moss staining and restrained darker damp patches. Intended to repeat across a large flat rooftop in a mobile game, so use evenly distributed low-contrast detail at a consistent scale. Orthographic straight-down material scan, perfectly flat and filling every edge. Neutral diffuse illumination only: NO directional lighting, NO cast shadows, NO ambient occlusion, NO baked highlights, NO reflections, NO perspective, NO bevelled edges. No puddle mirrors, no objects, no border, no labels, no tiles or grid, no panels, no text or watermark. All four image boundaries must match seamlessly when repeated horizontally and vertically. Keep the base colour a medium desaturated grey with a slight teal cast; avoid bright white flecks, deep black cracks and obvious large repeating landmarks. Painterly game-ready material detail, not an illustration of a roof.

## Assessment

The concept provides a coherent atmosphere, local architectural detail and readable orange/yellow focal accents. It is reference art, not an image of the current game. The rope/hook configuration and landings are illustrative, not a physical level specification.

The concrete has appropriately flat lighting and restrained detail. It can be tested as a colour map on roof tops. Edge mismatch is small but nonzero: average RGB absolute difference across the left/right boundary is 5.13/255 and top/bottom 5.48/255, compared with 3.21/255 between adjacent pixels in the middle row. These checks do not guarantee seamlessness; inspect the repeat in index.html. Large damp stains may be recognisable with frequent tiling. No image retouching has been applied.

The initial texture-only test used ?art=flow and repeated the image every 12 world units with lighting and material response supplied by Three.js. The subsequent city art pass makes it the default, adds detailed procedural architecture and an animated courier, and retains ?art=plain for comparison. A safe untextured material remains if the image cannot load. The colour map adds one compressed image (~111 KiB) and five texture instances. Physical Android performance is not measured.

Recommendation: use Nano Banana for concept direction, selected surface colour maps, posters and cover art. Build or model geometry and animation separately. Do not claim generated concept art is gameplay.

## Verification

The original art test passed production build, texture loading, fallback-mode selection, browser movement, pause/retry and repeat controls. The later city pass passed a production build, 91 existing simulation checks, a complete four-grapple train landing and a 390 x 844 layout with the on-screen grapple control. The upgraded default loads its roof texture successfully. The desktop browser reported around 60 fps during the sampled run; 394 static draw calls were removed by batching. No browser console errors were observed. Physical Android performance has not been tested.
