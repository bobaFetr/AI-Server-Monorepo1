# Accessibility for blind and low-vision users

_Project assessment: 2026-08-25_

## Conclusion

Yes—the project could help people who are blind or have low vision, especially by answering questions about a scene, reading visible text, locating an object, and reporting device status without sending images to a cloud service. The existing camera → Python client → authenticated C# endpoint → local vision model flow is a useful technical foundation.

It is not an assistive product yet. The current implementation requires a user-selected image and returns text. The React glasses interface is primarily visual, and its voice mode, gaze data, object confidence, battery time, map, and scan progress are simulations. There is no implemented camera hardware agent, speech recognition, text-to-speech, speaker or bone-conduction output, haptic feedback, obstacle detector, or navigation safety layer.

The right product direction is therefore an **audio-first scene assistant with automatic hands-free narration plus voice and physical controls**, with the display as an optional low-vision feature rather than the main interface.

## Where it could help

- **On-demand scene description:** describe the immediate environment after an intentional capture.
- **Object finding:** answer questions such as “Where is the empty chair?” using clock-face direction and approximate distance when the available sensors support it.
- **Text access:** read signs, labels, menus, appliance displays, and short documents aloud.
- **Object and product identification:** distinguish common items, colours, packaging, and controls, while clearly expressing uncertainty.
- **Status access:** announce battery, connection, camera state, request progress, and failures through audio or distinct haptic patterns.
- **Privacy:** local inference can reduce disclosure to third-party AI services, provided captured images and transcripts are deleted by default and logs do not retain them.

These features should support—not replace—a cane, guide dog, orientation and mobility skills, or an approved navigation aid.

## What must change

### 1. Make every core task nonvisual

The essential loop should work with no HUD and no eye tracking. In automatic-description mode, the user should not need to press a button for each update:

```text
local sensors notice a meaningful scene change
      ↓
camera captures a new frame automatically
      ↓
local logic checks relevance and suppresses duplicates
      ↓
server analyzes the selected frame
      ↓
short spoken update
      ↓
voice or tactile control requests detail, pauses narration, or stops speech
```

Automatic mode must be explicitly enabled and clearly announced, and it must continue until the user pauses it, enters privacy mode, or the battery reaches a configured threshold. Use tactile controls that can be identified by shape as a fallback. Provide immediate tones or vibration for listening, capture, processing, success, offline state, and error. Voice control must not be the only control because wind, traffic, speech differences, and privacy can make it unreliable.

### 2. Add a real audio pipeline

The planned microphone and speaker or bone-conduction hardware are not connected in the current code. A useful prototype needs:

- automatic scene-change capture plus an optional push-to-talk or physical “describe now” control;
- speech-to-text for the user's question;
- text-to-speech for the answer and all important system states;
- adjustable speech rate, volume, verbosity, language, and interruption;
- optional single-ear or open-ear output so environmental sound remains audible;
- local fallback announcements when the AI server is unavailable.

Audio should announce privacy state. A physical camera shutter remains valuable because a software tone alone cannot prove that capture is disabled.

### 3. Use prompts designed for safe, actionable descriptions

The current default prompt asks for a general description and the object at the centre. A blindness-oriented mode should request a short, structured response, for example:

```text
Describe only what is visible. Start with immediate hazards, then important objects
and text. Use clock-face directions relative to the camera. Do not guess distance,
identity, traffic safety, or whether a route is clear. State uncertainty briefly.
```

Different commands should use different prompts: `describe`, `read text`, `find object`, and `more detail`. The system must never turn model confidence into a guarantee.

### 4. Do not claim navigation or obstacle safety from one image

A monocular still image and a general vision-language model cannot reliably establish depth, drop-offs, moving traffic, glass doors, head-height obstacles, or a continuously safe path. Network and inference latency also make the current request flow unsuitable for real-time collision avoidance.

Do not use phrases such as “safe to cross” or “path is clear.” If navigation becomes a goal, it needs dedicated low-latency sensors, continuous local processing, fail-safe behavior, extensive field testing, and specialist review. Keep the AI description feature clearly separate from safety-critical mobility functions.

### 5. Preserve the low-vision path without forcing it on blind users

The monocular HUD may help some people with low vision if it supports large text, high contrast, simple layouts, adjustable brightness, magnification, and a mode that avoids blocking useful remaining vision. Eye tracking must remain optional. All setup, pairing, privacy, recovery, and calibration flows also need an audio/tactile path.

The existing web simulator already includes buttons, keyboard movement, labels, and some live regions, which is a helpful start for desktop accessibility. It still needs testing with screen readers, keyboard-only use, zoom/reflow, reduced motion, colour-contrast checks, and real spoken status—not only visual changes.

## Rapidly changing scenes

The scene in front of the glasses can change much faster than a local vision-language model can describe it. The wearer may turn their head, a person or vehicle may move, a door may open, or an object may be removed while an earlier frame is still uploading or being analyzed. A correct description can therefore become stale before it is spoken.

The system must attach every answer to the frame that produced it rather than present the answer as a live view. Each request should record a capture timestamp, head orientation when available, request ID, and sequence number. If the user turns significantly, captures a newer frame, or cancels the request, the older result should be discarded or introduced as an older observation—for example, “From the image taken three seconds ago…”. Never silently mix objects from several frames into one apparently current description.

Use four update modes:

1. **Automatic description:** a core hands-free mode. Lightweight processing on the glasses or companion continually compares frames and selects meaningful changes. It automatically sends selected frames for analysis and speaks concise updates without requiring a button press. It should also give a periodic summary when the wearer enters a substantially new place, even if no single object triggered an alert.
2. **Manual snapshot:** the user can request an immediate fresh description by voice or tactile control. This overrides automatic scheduling and is useful when the automatic mode has not described something important.
3. **Short scan:** after a command such as “scan for the door,” capture a small, time-bounded sequence while the user slowly turns. Process one frame at a time or use a dedicated tracking pipeline, suppress duplicates, and stop automatically after a few seconds. Announce that scan mode is active and allow immediate cancellation.
4. **Targeted change alerts:** limited to a selected target or event, such as “tell me if the door opens.” Lightweight local computer vision should detect candidate changes; the slower language model should be called only when a meaningful change needs explanation.

Automatic description does not mean uploading every video frame. Continuous raw-frame upload would increase latency, power use, privacy exposure, server load, and repeated or contradictory speech. The companion should continuously perform inexpensive local motion, scene-change, orientation, and object-tracking checks, then send a representative frame only when something relevant changes. It should impose a minimum interval between ordinary descriptions, while allowing a separate low-latency local warning channel for future dedicated safety sensors.

Do not describe every detected change. Compare the new observation with the last delivered state and speak only changes that are relevant to the active task. A person walking across the room may matter while finding a seat but not while reading a label. Repeated objects should keep stable labels such as “chair at two o'clock” for as long as tracking remains reliable. When tracking is lost, say so rather than pretending the same object is still present. The user should be able to choose quiet, normal, or detailed narration and commands such as “pause descriptions,” “resume,” “what changed?”, “describe now,” and “only tell me about doors.”

If the scene changes while speech is playing, use priority and interruption rules:

- an immediate locally detected hazard cue may interrupt everything;
- a requested target update may interrupt ordinary description after a short tone;
- general scene changes wait until the current sentence ends;
- cosmetic or low-confidence changes are suppressed;
- a new user command always takes priority and can cancel capture, inference, or speech.

The current monocular camera and server inference must not be treated as a real-time hazard detector. Any future urgent-alert channel requires dedicated low-latency local sensors and processing that continue working when the network or AI server fails.

## How the system should recognize people

The system must distinguish three different tasks:

1. **Person detection:** notice that one or more people are present and describe their approximate position or movement.
2. **General description:** describe visible, non-sensitive details useful in the moment, such as “a person in a red jacket is ahead-left.”
3. **Identity recognition:** suggest that the face matches a familiar person who has explicitly enrolled.

The current project can ask the vision model to describe visible people, but it does not contain a reliable identity-recognition system. A general vision-language model must not be trusted to name a person from appearance. Identity should be a separate, optional component with its own consent, security, and confidence rules.

### Consent-based enrollment

A familiar person should enroll deliberately with the wearer present. The companion captures several face views under different lighting and angles, verifies image quality, associates them with a name chosen by the wearer, and converts the images into face embeddings—a numerical representation used for matching. Enrollment must explain how the data will be used and provide an accessible way to review or delete it.

Store embeddings encrypted on the wearer's companion device or private server. Do not build a shared face database, search social media, or upload faces to a public recognition service. Delete the enrollment photos after generating the embeddings unless both people explicitly choose to retain them. Recognition should be disabled by default for children and in sensitive places unless there is a carefully reviewed reason to support it.

### Recognition flow

```text
local camera detects a face
      ↓
check image quality, face angle, and possible spoofing
      ↓
create a temporary face embedding
      ↓
compare only with the wearer's enrolled familiar people
      ↓
apply a strict match threshold across more than one useful frame
      ↓
speak a cautious result or report an unknown person
      ↓
discard the temporary image and embedding according to policy
```

Matching should preferably happen locally so an unknown person's face does not need to leave the companion device. The slower server vision model may separately describe the scene, but it should receive a neutral label such as `familiar-person-1` rather than biometric data when identity is not necessary.

### What the wearer should hear

The device should not repeatedly announce every visible person. It should speak when someone enters the relevant area, approaches, is the subject of a question, or matches an enrolled person after sufficient evidence.

Examples:

- “One person is approaching from your left.”
- “The person ahead may be Maria, but I am not certain.”
- “Maria is likely ahead-right, about two metres away,” only if calibrated depth sensing supports the distance.
- “I do not recognize this person.”
- “I cannot see the person's face clearly.”

Never announce “This is Maria” as a certainty based on one frame. The wearer should be able to ask “who is here?”, “where is Maria?”, or “describe the person,” and should be able to mute identity announcements while keeping ordinary person detection active. A newly detected person can also confirm their identity by speaking or using a paired phone; this is safer than relying on face matching alone.

### Safety, privacy, and prohibited inferences

Face matching can fail because of lighting, camera angle, masks, ageing, similar-looking people, occlusion, or deliberate spoofing. A wrong name can create social and physical risk. Use temporal confirmation, quality checks, conservative thresholds, and a clear unknown state. Test false matches and missed matches separately with diverse participants and real wearable camera angles.

Do not infer or announce race, ethnicity, religion, health, disability, sexual orientation, emotional state, criminality, or trustworthiness from a person's face or appearance. Do not guess age or gender unless the user has a specific legitimate need, the description is visibly grounded, and co-design shows that it is appropriate; neutral wording such as “person” is the safe default. Clothing colour, direction, action, and an enrolled name are usually more useful.

Provide an unmistakable camera-active signal, a fast privacy control, encrypted storage, an audit showing when recognition was used, and accessible deletion of each enrolled identity. Recognition data must never be included in ordinary logs, analytics, backups, or model-training data without separate explicit consent.

For the first accessible MVP, implement anonymous person detection and spatial descriptions before identity recognition. Add familiar-person matching only after automatic narration, deletion, authentication, and privacy controls work reliably and blind users confirm that the feature is genuinely useful.

## How information should reach the user

The glasses should serve information in layers instead of reading a long visual description all at once:

```text
distinct tone or vibration
→ one-sentence summary
→ the most relevant direction or change
→ pause for the user
→ more detail only when requested
```

For example:

```text
[capture tone]
“Indoor hallway. A closed door is at eleven o'clock.”
[pause]
User: “More detail.”
“Two people are approximately ahead-right. A sign on the door reads Reception.”
```

The spoken answer should normally follow this order:

1. system state if the request failed or the observation may be stale;
2. urgent non-navigation warning, with uncertainty stated;
3. the answer to the user's specific question;
4. important object or text and its clock-face direction;
5. optional background detail available through “more detail.”

Use short sentences and spatial language agreed during user testing. Clock-face direction can describe left and right, but distance must be labelled approximate and spoken only when supported by calibrated depth information. Avoid unexplained percentages. “I am not sure whether that is a step” is more useful than a simulated confidence score.

Information channels should have separate roles:

- **Speech:** scene descriptions, recognized text, answers, errors, and settings.
- **Earcons:** very short, learnable sounds for capture, processing, ready, cancel, offline, and failure.
- **Haptics:** private confirmation and urgent device states; patterns must be few and clearly distinguishable.
- **Optional low-vision display:** large, high-contrast keywords and magnification, synchronized with speech.

The user must be able to repeat the last answer, slow or speed speech, request more or less detail, interrupt immediately, and ask “when was that captured?”. Store the last answer and its timestamp locally long enough for repeat, without taking another image. When the server is busy, announce “Server busy; no new description” instead of replaying an old answer as if it were current.

In automatic mode, the first update should establish context, such as “You appear to be in a kitchen.” Later speech should primarily describe changes: “A person has entered from your right,” or “The door ahead is now open.” After a long quiet period or a large head movement, the system may give a new short scene summary. It must avoid talking continuously over conversation, alarms, traffic, or other important environmental sound. Microphone-based conversation detection may temporarily reduce narration, but it must be processed locally and remain user-configurable.

### Proposed delivery state machine

```text
IDLE
  → AUTOMATIC MONITORING
  → MEANINGFUL CHANGE DETECTED
  → CAPTURE CONFIRMED
  → PROCESSING
  → SPEAKING SUMMARY
  → RESUME AUTOMATIC MONITORING

At any point:
  new request → cancel older request and capture again
  large head movement → mark pending observation stale
  timeout/offline → speak failure and return to IDLE
  pause/privacy control → stop automatic capture, inference, and narration
  stop-speech control → silence speech but keep monitoring if configured
```

This behavior should run in the Python device agent or companion device. Capture cues, cancellation, stale-result rejection, cached status messages, haptics, and basic speech control must remain available locally; the C# server supplies analysis but should not control the only accessible interface.

## Recommended accessible MVP

Build this before custom waveguides or eye tracking:

1. Use a phone, laptop, or Raspberry Pi companion with one outward camera, tactile pause/privacy and manual-request controls, and open-ear audio.
2. Add an automatic-description mode that detects meaningful scene changes locally, selects frames, and narrates updates without requiring a button press.
3. Support immediate requests by voice or tactile control: describe now, read text, find named object, what changed, or more detail.
4. Speak a short answer and allow immediate repeat, interrupt, and cancel.
5. Announce offline, timeout, server busy, low battery, and camera blocked states locally.
6. Delete the image after inference by default; make retention opt-in and accessible.
7. Test first at a desk and in controlled indoor spaces, not during street crossing or independent navigation.

## Acceptance tests

The first accessibility milestone is complete only when:

- a blindfolded developer can start, use, cancel, and recover the feature without seeing a screen;
- blind participants can complete the same tasks using their preferred audio settings and physical controls;
- every capture has an unmistakable user cue and every failure has a spoken or haptic explanation;
- the system distinguishes observation from uncertainty and never gives a crossing-safety judgment;
- speech can be interrupted immediately and repeated without taking another photo;
- automatic description works without a button press and can be paused or resumed nonvisually;
- repeated or insignificant scene changes do not produce constant speech;
- stale automatic results are discarded after a newer capture or substantial head movement;
- useful ambient sound remains available while the device speaks;
- offline and server-failure behavior is predictable;
- measured end-to-end latency is acceptable to participants for each task;
- testing records incorrect, omitted, and invented descriptions—not only successful answers;
- images, prompts, and transcripts follow explicit retention and deletion rules.

## Research and co-design

Do not design the interaction only through blindfold simulations. Recruit blind and low-vision people early, compensate them for testing, and include an orientation-and-mobility specialist when evaluating use outside controlled spaces. Their feedback should determine preferred controls, wording, speech timing, wearing comfort, privacy signals, and which tasks are genuinely useful.

## Decision

Keep accessibility as a primary use case, but change the priority order:

```text
camera-to-local-AI proof
→ audio + tactile end-to-end prototype
→ co-design and controlled usability testing
→ reliability, privacy, and failure testing
→ optional low-vision display
→ navigation research only as a separate safety-critical project
```

This route uses the strongest work already in the repository while avoiding dependence on the least accessible parts of the current concept: a visual HUD, targeting reticle, and eye-gaze menu.
