# Supa Canvas — Audio Lab 02

A dependency-free local browser prototype for exploring audio → 2D effect field → mapped LED colors.

## Open it

Open Supa-Canvas.html in Chrome. You can also double-click Start-Supa-Canvas.command to serve the app at localhost:8765.

All interface code is bundled in that file and works offline. Click Demo signal to explore without audio. Local file audio permissions vary; if audio capture is unavailable, use the localhost option below.

### Localhost option

With Python 3 installed, open Terminal in this extracted folder and run:

    python3 -m http.server 8765 --bind 127.0.0.1 --directory dist

Then open http://localhost:8765 in Chrome. Stop the server with Control-C. There are no npm packages or build steps.

## Capture Apple Music on a Mac

1. Install BlackHole 2ch: https://github.com/ExistentialAudio/BlackHole
2. Open Audio MIDI Setup. Create a Multi-Output Device containing your physical speakers/headphones and BlackHole 2ch. Make the physical device the primary clock; enable drift correction on BlackHole and use matching sample rates.
3. Set the Mac output to that Multi-Output Device. Play Apple Music. You should hear the music normally. Set physical speaker volume before switching if the multi-output volume control is unavailable.
4. In Supa Canvas, click Find inputs. Allow the browser/macOS audio permission. Choose BlackHole 2ch and click Connect input.
5. Confirm meters move. If they do not, check the Mac output routing and selected browser input. Microphone is an alternate source for a quick speaker test.

The app does not play captured input back through the speakers, preventing an audio feedback loop. Audio stays in this browser; there is no upload, recording, analytics, or external script.

Share audio is an alternative using browser display capture. Availability of desktop or tab audio depends on browser/OS/source. The app rejects captures without an audio track. A silent track may still be returned, so check meters. BlackHole is the intended path for the initial Apple Music experiment.

Routing reference: https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device
Apple multi-output documentation: https://support.apple.com/guide/audio-midi-setup/play-audio-through-multiple-devices-at-once-ams7c093f372/mac
Browser capture: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia

## Explore and map

- Aurora ribbons: mids broaden the flowing ribbons; total band energy controls intensity.
- Bass ripples: bass brightens radial waves; detected onsets add a center pulse.
- Spectrum landscape: 48 logarithmic frequency bands drive bar height.
- Prism tunnel: total band energy illuminates a moving polar interference field.
- Liquid plasma: bass and mids reshape a flowing color field.
- Orbital bloom: bass expands the radius and treble changes the petal count.
- Pixel rain: frequency bands light and accelerate individual trails.
- Four quick looks set coordinated effect, palette, gain, smoothing, speed and brightness values.
- Fullscreen expands the canvas; Escape exits.
- Open audio file plays a local file through the analyzer with pause, seek and looping. It is never uploaded.
- Waveform ribbon: the actual time-domain waveform forms a luminous trace.
- Gain changes visual band response and waveform height. Input RMS remains pre-gain.
- Smoothing controls live FFT smoothing, not the synthetic demo or waveform.
- Audio motion amount scales an explicit speed pairing. With no speed pairing, shapes respond directly to changing audio; no timer moves them.
- Brightness affects the field and sampled LEDs.
- These are normalized visual band magnitudes, not calibrated frequency-band loudness measurements.
- Onset detection is a simple adaptive bass threshold, not BPM estimation.

Select a path, drag its white nodes, add points or reverse LED order. Arrow keys move the selected node; Shift moves it farther. Points are normalized (0–1), and LEDs are spaced by path length using the 960×540 canvas aspect ratio. The first node is LED 0. The sample paths on launch are examples, not discovered devices. Preview limits: 16 paths, 1,000 LEDs per path, 32 nodes per path.

Export scene saves effect parameters and paths as JSON. Load scene validates and restores them. Changes are automatically saved in browser local storage. The last scene is restored on reload; audio is never saved or reconnected automatically. Export a JSON backup to move between browsers or keep named scenes. If browser storage is unavailable, use Export scene. The two display checkboxes are view preferences and are not part of the scene.

## Architecture and next steps

Current: Web Audio (2,048-point FFT) → normalized audio features → 240×135 effect field upscaled to 960×540 → RGB samples along LED paths. The full canvas is a preview; the LED samples show the actual spatial mapping. No microphone/loopback permission is requested until an audio button is clicked.

This release does NOT discover, pair, synchronize or transmit to WLED devices, and is NOT flashable ESP32 firmware.

Next Mac phase:
- Local service for WLED discovery and explicit IP-based device assignment.
- Map path LED 0/count to a controller output range.
- Send RGB samples with DDP over UDP port 4048; cap frame rate and measure real latency/frame loss.
- Introduce transport-independent effect functions, versioned audio frames, and deterministic timing.

ESP32 phase:
- Store the editor assets on the device and use a browser to configure it.
- Port the selected effect math and normalized path sampling to C++/ESP-IDF; evaluate only at LED coordinates instead of drawing a large raster.
- Add microphone/line-in acquisition hardware or receive compact audio feature packets from the Mac. An ESP32 cannot acquire the Mac's internal playback just by being on the same Wi-Fi.
- Use DDP for shared-canvas pixel output. WLED audio sync sends audio features for effects running on receivers; it is a different rendering model.
- Select the precise ESP32/module/audio interface after measuring LED count, target frame rate and memory needs. Prefer investigating an ESP32-S3 with PSRAM; this prototype does not establish a hardware capacity guarantee.

WLED references:
https://kno.wled.ge/interfaces/ddp/
https://kno.wled.ge/advanced/ddp/
https://kno.wled.ge/advanced/audio-reactive/

## Source

Edit dist/index.html, dist/app.js, and dist/modulation.js. Supa-Canvas.html is the combined standalone copy. To regenerate it, run `python3 scripts/build.py`.

See VALIDATION.md for checks and hardware limitations.

## System audio and the ESP32 boundary

Browser microphone permission does not automatically capture Apple Music. This version uses BlackHole as a selectable input. A native helper using Apple ScreenCaptureKit could remove the virtual-driver routing step, but is not implemented here. Apple Music capture must be checked on the actual Mac with moving meters; demo and file playback do not verify system capture.

For the eventual standalone controller, keep normalized audio features and LED path coordinates as the interface between audio analysis, effect evaluation, and network output. Port selected effects to firmware and calculate colors only at mapped LED positions. The browser editor can then be served by the ESP32, while firmware does the real-time work. The Mac still needs to provide playback features unless the ESP32 has its own microphone or line input.

Sources: [Apple ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit), [BlackHole routing](https://github.com/ExistentialAudio/BlackHole/wiki/Getting-Started%3A-Creating-a-Multi-Output-Device), [WLED DDP](https://kno.wled.ge/interfaces/ddp/), [WLED audio reactive](https://kno.wled.ge/advanced/audio-reactive/).

## Audio → attributes

Pairings modify the **selected effect itself**. There are no separately rendered blob or radial-peak overlays.

- Structure / lobes changes the selected effect’s folds, cell density, petal depth, or trail width.
- Peak sharpness changes that effect’s crests, contour contrast, or tips.
- Effect scale changes its width, radius, height, or spacing.
- Field intensity changes how much of the selected field is revealed. The Field Intensity meter shows its final audio-driven value.
- Motion speed advances the effect only while driven by an active audio pairing; Audio motion amount scales this input.
- Color shift and Extra brightness change the selected field’s palette and brightness.

The description under Canvas effect explains how the three shape controls work for that effect. Cyan **Required drivers** fields identify the audio information an engine needs. They are visible above the palette controls so an engine never appears to be moving for an unexplained reason.

The effect engines do not expose a standing procedural texture. Audio events seed state, and travel comes only from a confident tempo estimate or a Motion speed pairing. When audio falls below the noise floor, evolution stops on the exact current frame.

The focused engine set contains the retained **Organic audio field** plus five new engines: **Current trails** carries discrete full-spectrum events through a tempo-driven vector field; **Mycelium bloom** grows from bass and beat seeds; **Tidal pulses** propagates bass and beat impulses; **Treble embers** only seeds bright high-frequency bodies; and **Spectrum columns** is the deliberate direct FFT exception.

**Organic audio field** is the default generative engine. It starts empty instead of presenting a standing texture: bass and beat events seed larger, slower bodies; treble seeds smaller, brighter bodies; their state is carried through a noise flow whose travel rate follows the BPM estimate when it is confident. Structure increases seeding, Effect scale changes blob radius, and Peak sharpness shapes the visible edge. The flow is part of this one selected effect, rather than an overlay.

## Raw audio spectrum

The always-visible **Raw audio spectrum** monitor shows the analyser's un-normalized FFT magnitudes from 30 Hz to 12 kHz. Its green, blue, and pink regions mark the bass, mid, and treble ranges used by pairings. It remains useful when the noise gate is closed: the monitor can show incoming activity while the canvas correctly stays dormant.

The **Live response trace** separates raw bass from its fast-attack, slower-release envelope, final Peak Intensity, and the short impact envelope. Structure uses adaptive bass or treble novelty: a sustained note settles into a local baseline, while a new rise creates an impact. Use **Capture data** to retain up to 60 seconds of 30 Hz frames, including raw and smoothed 48-band values plus bass and treble novelty, then export them as JSON for tuning thresholds and release times.

## Beat and tempo tracking

The app now detects transient pulses from a weighted bass/mid energy envelope, estimates a tempo from recent intervals, and shows **Tempo estimate** plus confidence. It is designed for visual modulation rather than DJ-grade beatgridding: it needs several consistent transients before reporting BPM, chooses the 70–180 BPM octave, and reports low confidence when the intervals disagree.

Two new modulation sources appear in the Audio band menu:

- **Beat pulse** fires on detected onsets and fades quickly. Pair it with Peak sharpness, Effect scale, Field intensity, or any other attribute.
- **Tempo cycle** is a confidence-weighted decaying pulse between estimated BPM grid points. Pair it with Motion speed for steady tempo travel or with an effect parameter for slower beat-synced evolution.

Both sources become zero when the input is dormant. BPM and confidence are estimates, not a guarantee of the musical downbeat.

## 1D LED output preview

The glowing bar below the canvas is the mapped LED output, rather than a separate visualizer. Each row represents a configured LED path and samples the same effect field at that path's LED coordinates. Long strips are condensed into up to 180 displayed cells; each cell averages its represented LEDs. The selected path gets a lime outline. It is a preview of the colors ready to send to each strip, including the result of the current audio-driven effect.

Each of up to 12 pairings selects bass (30–250 Hz), mids (250–2,000 Hz), treble (2–12 kHz), full spectrum, Beat pulse, Tempo cycle, or a custom frequency range. Analysis uses 48 logarithmic bands; narrower custom ranges resolve to the nearest analysis band. Average level uses the selected range’s mean; Strongest peak uses its maximum spectral magnitude, not a beat detector.

Amount controls strength, Threshold ignores low relative activity, Release smooths falling activity while audio is present. Pairings add together within limits and can be disabled or removed. Try generative mix adds only missing bass → structure, mids → speed, treble → sharpness, and full spectrum → intensity pairings. Identical duplicate routes from older saved scenes are collapsed on load.

## Silence and quiet audio

The app starts idle. Demo is opt-in and includes a two-second silent interval every eight seconds. Silence, file pause, and Stop audio hold the last canvas frame immediately, including motion phase and release envelopes. LED mapping controls remain editable. A canvas effect responds directly to changing audio features; time alone does not animate it. Motion comes from a confident BPM estimate or a Motion speed pairing.

Noise floor (default −60 dBFS) gates DC-corrected floating-point input RMS. Below it, the field holds still. Above it, the spectrum is normalized and compressed so quiet passages remain usable and strong passages stay bounded. Lower the floor for quiet sources; raise it to ignore room noise. RMS remains an unprocessed level readout; band percentages are relative visual responses, not calibrated loudness.

Scene format v2 saves pairings and the noise floor. Version 1 and earlier v2 scenes still load, receiving the default noise floor where missing.

## Verification

Run `node tests/modulation.test.cjs` for band isolation, range validation, dynamic response, and motion gating. Run `node tests/dormancy.test.cjs` for application-level pixel comparisons, silence freezing, wall-clock independence, and selected-effect parameter behavior. See VALIDATION.md for results and physical hardware limitations.
