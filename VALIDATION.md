# Validation — 2026-09-07

- JavaScript syntax check passed using the bundled Node runtime.
- Served locally on port 8765 and inspected in the Codex browser.
- Canvas and analysis meters rendered; no browser warnings or errors reported.
- Liquid light and Orbital bloom presets changed effect, palette and parameters.
- Scene parameters survived reload and showed Previous scene restored.
- Generated a local 110 Hz sine-wave WAV and loaded through the file picker. Live FFT showed approximately 41% bass, 0% mids, 0% highs, and -27.3 dBFS RMS at gain 1.7.
- Fixed initial audio startup hanging by creating/resuming the AudioContext during the Open audio file click gesture, before opening the file picker.
- Repeated file selection and transition back to demo succeeded. Fullscreen entry displayed Exit fullscreen.
- The final user-facing browser session showed a connected built-in MacBook microphone with nonzero input meters. Left this active session unchanged.
- Rebuilt the standalone HTML from dist/index.html and dist/app.js.

Not verified: Apple Music system capture (BlackHole is not installed), every browser/codec, all scene-import edge cases, physical LED output, WLED discovery/synchronization, or ESP32 firmware. The latter network and firmware features are not implemented in this release.

## Audio pairing extension

- Node routing tests passed: low-frequency input does not trigger treble, blob positions remain within the assigned band, disabled routes and thresholds suppress output, narrow custom ranges resolve predictably, strongest-peak response differs from average level, release matches at 30/120 Hz, invalid values and excess routes are rejected, JSON round trip preserves configuration.
- Browser: previous version-1 scene restored; generative mix added three mappings; a fourth custom 800–4,000 Hz → blob size mapping was editable and activity meters updated. No console warnings/errors at that check.
- Browser: v2 scene restored all four pairings, including custom frequency bounds; disable and remove worked. Generative-only canvas rendered the new layers. Adjusted layer brightness after visual inspection so moderate activity remains visible.

## Audio-only regression checks

- Routing tests verify quiet/loud normalization, RMS gating, no phase advance without active audio and a speed route, and stable blob positions when adjacent band magnitudes cross.
- App-level tests execute the actual analysis/frame/render code in a Node VM with a canvas/DOM test double. Pixel buffers and phase stay exactly equal after Stop across simulated frames. Idle startup is confirmed; audible synthetic input produces nonzero pixels.
- Browser shows idle startup, zero activity, Dormant status, restored settings, and the new Noise floor control, without console errors.

## Forward-generation and intensity update

- The selected effects now use a forward-moving procedural field, while silence retains the exact rendered frame.
- Added the Field Intensity meter and full-spectrum → Field intensity route target. Browser verification confirmed it updates during demo audio and remains at zero while dormant.
- Regression checks confirmed every selected effect still responds to structure, sharpness, and scale without drawing a separate overlay layer.

## Focused engine and raw spectrum update

- Browser verification confirmed the un-normalized raw FFT spectrum shows bass, mid, and treble activity during the demo signal.
- Node VM checks verify Current trails, Mycelium bloom, Tidal pulses, Organic audio field, and Treble embers receive their declared audio drivers and render non-black output from their internal state.

## Beat and tempo update

- Synthetic 120 BPM input produced a locked tempo estimate within the intended 105–135 BPM tolerance and confidence above 35% after repeated transients.
- Beat pulse and tempo cycle routes are verified as modulation sources; dormant input zeroes both signals.
