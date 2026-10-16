# Stormline — Monsoon Rooftops

A playable movement prototype built into the existing Three.js project. No new dependencies or paid assets.

## Play

From the game folder run `npm run dev`, then open the Local URL printed by Vite.

- Default URL: Stormline grappling mode.
- Add `?mode=classic` to play the original rooftop runner, including its scoring and X challenge links.
- Existing `?line=...` challenge links also open Classic mode automatically.
- Desktop: Space / Up Arrow jumps. Hold E or hold the left mouse button over the scene to connect a grapple. Release to launch. R retries immediately. P / Escape pauses.
- Phone: tap JUMP; hold the larger GRAPPLE button and release to launch. The line automatically gives a small takeoff when it connects from a rooftop.

## The prototype

Four crane crossings lead to a moving train. A clean run takes roughly 15–25 seconds; this is a movement test, not a full campaign. The upper sky deck is an optional precision landing. Three energy cells, landing chains, completion time and a sky-deck bonus affect the score. The best completed run is saved locally and appears as a translucent ghost during subsequent runs.

The line follows a fixed-step, constrained-rope simulation. Holding it reels the powered tether in gradually. Releasing preserves the courier's velocity; the player is not teleported to a landing. Early release can miss the next rooftop. The orange target prompt indicates a useful release window, rather than guaranteeing a landing.

The new scene contains procedural buildings, cranes, floodwater, rain, rooftop props and the train. The character, sounds, materials and signage are generated in code. Optional web fonts have local system-font fallbacks.

## Verification

`npm run test:stormline` runs the standalone simulation suite. It covers a complete train landing, all three pickups, the upper landing route, early release, no-input failure, rope length, momentum on release, pause, reset and repeatability.

The implementation was also previewed in-browser: a full run was completed with real controls; best-run persistence, keyboard jump/grapple/release, pause/restart and 390px-wide layout were checked. Phone-sized browser testing is not a physical Android performance test. The existing classic simulation suite is retained.

## Next decision

Let people play the movement prototype before expanding it. Watch whether they voluntarily retry, learn the release timing and chase the ghost. The next content milestone would be a longer mission with train movement and environment-specific challenges, followed by real-device Android profiling. This prototype does not include an APK, native haptics, online leaderboards, accounts or monetization.

## Nano Banana art test

Open /art/nano-banana/index.html for the concept image, original concrete colour map and interactive repeat comparison. The generated roof texture is now part of the default city art; use ?art=plain to compare the earlier geometry. Generated in Google Flow with Nano Banana 2.1 on 16 October 2026. Exact prompts, provenance and assessment are in public/art/nano-banana/PROMPTS.md. The concept is reference art, not a gameplay screenshot.

## City and courier visual pass

The city art is now the default. `?art=plain` keeps the earlier geometry for comparison; `?art=flow` is still supported and uses the updated city. Classic mode and existing challenge links are retained.

The Google Flow concrete colour map is used on the five concrete roof tops. Repeated apartment windows, balconies, floor bands, awnings, air conditioning units and rain-streaked plaster add depth to the skyline. Roof huts, ribbed water tanks, shop signs, a cloudy teal sky, flood reflections and a railway viaduct carry the concept into real-time geometry. These are original procedural models; the concept image is not used as fake gameplay scenery.

The courier has a cream raincoat, hood, orange scarf, delivery backpack and articulated hips, knees, shoulders and elbows. Running strides, air poses, a hand aimed at the active anchor, scarf motion and landing compression are animated independently of physics. The rendered line starts at the courier's hand. A closer follow camera and landing ripple make movement easier to read.

Static architecture uses instancing; repeated crane and tank parts are batched after construction. The preview recorded 394 static draw calls removed and around 60 fps on this desktop browser. These are sample observations, not an Android performance guarantee. No new dependencies were added. Movement rules, level collision, scoring and stored ghost data are unchanged.

Verification includes production build, the existing 79 classic checks and 12 Stormline simulation checks, a complete four-grapple train landing in-browser, retry/pause and saved ghost, plus a 390 x 844 layout and holding/releasing the on-screen grapple button. Physical Android testing and an APK remain future work.
