"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

const actions = [
  { id: "look", icon: "◉", label: "LOOK & ASK", meta: "VISION QUERY" },
  { id: "voice", icon: "⌁", label: "VOICE", meta: "LISTEN MODE" },
  { id: "recent", icon: "▤", label: "RECENT", meta: "3 ANSWERS" },
  { id: "map", icon: "⌖", label: "MAP", meta: "NAVIGATION" },
  { id: "calibrate", icon: "⊕", label: "CALIBRATE", meta: "EYE TRACKER" },
  { id: "terminator", icon: "▰", label: "TERMINATOR CODE", meta: "CODE STREAM" },
] as const;

const terminatorLines = [
  "4000  A2 00       LDX #$00", "4002  A0 10       LDY #$10", "4004  BD 00 02    LDA $0200,X",
  "4007  9D 00 04    STA $0400,X", "400A  E8          INX", "400B  D0 F7       BNE $4004",
  "400D  AD 00 C0    LDA $C000", "4010  29 7F       AND #$7F", "4012  C9 20       CMP #$20",
  "4014  90 12       BCC $4028", "4016  99 00 03    STA $0300,Y", "4019  88          DEY",
  "401A  D0 FA       BNE $4016", "401C  18          CLC", "401D  69 01       ADC #$01",
  "401F  85 FE       STA $FE", "4021  A5 FF       LDA $FF", "4023  49 80       EOR #$80",
  "4025  85 FF       STA $FF", "4027  EA          NOP", "4028  4C 00 40    JMP $4000",
];

const targets = [
  { name: "WORKSTATION", detail: "A workstation with a display, keyboard, and dark desktop surface.", confidence: 94 },
  { name: "WINDOW", detail: "A window edge with daylight entering from the upper-left field of view.", confidence: 87 },
  { name: "COFFEE CUP", detail: "A ceramic cup positioned near the lower-right edge of the desk.", confidence: 91 },
  { name: "NETWORK HUB", detail: "A compact network device with two active status indicators.", confidence: 83 },
];

const recentAnswers = ["Server health verified", "Workstation identified", "Route to Sofia Center"];

function targetFor(x: number, y: number) {
  if (x < -55) return targets[1];
  if (x > 55 && y > 15) return targets[2];
  if (x > 55) return targets[3];
  return targets[0];
}

export default function Home() {
  const [active, setActive] = useState<(typeof actions)[number]["id"]>("look");
  const [scanning, setScanning] = useState(false);
  const [listening, setListening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connected, setConnected] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [calibration, setCalibration] = useState(0);
  const [notice, setNotice] = useState("SYSTEM READY");
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [modelAnswer, setModelAnswer] = useState<string | null>(null);
  const [aimOffset, setAimOffset] = useState({ x: 0, y: 0 });
  const [aimDragging, setAimDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const scanTimer = useRef<number | undefined>(undefined);
  const [clock, setClock] = useState("12:08:39");
  const [terminatorLine, setTerminatorLine] = useState(6);
  const target = targetFor(aimOffset.x, aimOffset.y);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB"));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => { window.clearInterval(timer); if (scanTimer.current) window.clearTimeout(scanTimer.current); };
  }, []);

  useEffect(() => {
    if (active !== "terminator") return;
    setTerminatorLine(6);
    const timer = window.setInterval(() => setTerminatorLine((line) => (line + 1) % terminatorLines.length), 150);
    return () => window.clearInterval(timer);
  }, [active]);

  async function runScan() {
    if (!connected || !cameraActive) { setNotice(!connected ? "LINK REQUIRED" : "ENABLE CAMERA"); return; }
    setActive("look"); setScanning(true); setNotice(capturedImage ? "UPLOADING CAPTURE" : `LOCKING ${target.name}`);
    if (capturedImage) {
      const form = new FormData();
      form.append("image", capturedImage); form.append("prompt", `Identify the object at the center and briefly describe the scene. Target hint: ${target.name}.`); form.append("requestId", crypto.randomUUID());
      try {
        const response = await fetch("/api/vision", { method: "POST", body: form });
        const result = await response.json() as { answer?: string; detail?: string; latencyMs?: number };
        if (!response.ok || !result.answer) throw new Error(result.detail ?? "Vision request failed.");
        setModelAnswer(result.answer); setNotice(`MODEL RESPONSE · ${result.latencyMs ?? 0} MS`); setScanning(false); return;
      } catch (error) {
        setNotice(error instanceof Error ? error.message.toUpperCase() : "VISION REQUEST FAILED"); setScanning(false); return;
      }
    }
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    scanTimer.current = window.setTimeout(() => { setScanning(false); setNotice(`${target.name} IDENTIFIED · ${target.confidence}%`); }, 1800);
  }

  function loadCapture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null; setCapturedImage(file); setModelAnswer(null);
    if (file && file.size > 5 * 1024 * 1024) { event.target.value = ""; setCapturedImage(null); setNotice("FRAME REJECTED · MAX 5 MB"); return; }
    setNotice(file ? `FRAME LOADED · ${(file.size / 1024).toFixed(0)} KB` : "FRAME CLEARED");
  }

  function selectMode(id: (typeof actions)[number]["id"]) {
    setActive(id); setScanning(false); setListening(false); setMenuOpen(false);
    setNotice(id === "calibrate" ? "FOLLOW CALIBRATION POINT" : `${id.toUpperCase()} MODULE READY`);
  }

  function startAimDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = { x: event.clientX - aimOffset.x, y: event.clientY - aimOffset.y }; setAimDragging(true);
  }

  function moveAim(event: ReactPointerEvent<HTMLDivElement>) {
    if (!aimDragging) return;
    const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
    setAimOffset({ x: clamp(event.clientX - dragOrigin.current.x, 190), y: clamp(event.clientY - dragOrigin.current.y, 150) });
  }

  function moveAimWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); runScan(); return; }
    const move = moves[event.key]; if (!move) return; event.preventDefault();
    setAimOffset((current) => ({ x: Math.max(-190, Math.min(190, current.x + move[0])), y: Math.max(-150, Math.min(150, current.y + move[1])) }));
  }

  function runCalibration() {
    const next = calibration >= 100 ? 0 : Math.min(100, calibration + 25);
    setCalibration(next); setNotice(next === 100 ? "GAZE CALIBRATION COMPLETE" : `CALIBRATION ${next}%`);
  }

  let answerTitle = modelAnswer ? "LIVE MODEL RESPONSE" : "VISUAL ANALYSIS"; let answerText = modelAnswer ?? target.detail;
  if (active === "voice") { answerTitle = listening ? "VOICE CAPTURE ACTIVE" : "VOICE CHANNEL"; answerText = listening ? "Listening… say your question, then tap stop to process locally." : "Microphone standing by. Start listening when you are ready."; }
  if (active === "recent") { answerTitle = "RECENT RESPONSES"; answerText = "Select a stored answer to bring it back into focus."; }
  if (active === "map") { answerTitle = "LOCAL MAP"; answerText = "Navigation ready. Current position is centered near Sofia with the server link active."; }
  if (active === "calibrate") { answerTitle = "GAZE CALIBRATION"; answerText = calibration === 100 ? "Calibration complete. Eye tracking quality is excellent." : "Focus on each point and confirm with the side control."; }
  if (active === "terminator") { answerTitle = "TERMINATOR CODE"; answerText = "PROCESSOR STREAM ACTIVE"; }
  const primaryLabel = active === "voice" ? (listening ? "■ STOP LISTENING" : "⌁ START LISTENING") : active === "calibrate" ? `⊕ CONFIRM POINT ${Math.min(4, calibration / 25 + 1)}/4` : scanning ? "SCANNING 79%" : "◎ CAPTURE SCENE";

  return (
    <main className={`hud-shell ${scanning ? "is-scanning" : ""} ${listening ? "is-listening" : ""}`}>
      <div className="grain" aria-hidden="true" />
      <header className="system-bar"><span className="brand"><b>△</b> ARGUS // VISION OS</span><span className="coordinates">N 42.6977 · E 23.3219</span><button className={`link-control ${connected ? "online" : "offline"}`} onClick={() => { setConnected((value) => !value); setNotice(connected ? "OFFLINE MODE ENABLED" : "SERVER LINK RESTORED"); }}><i /> {connected ? "LINK ACTIVE" : "OFFLINE MODE"}</button></header>
      <section className="glasses" aria-label="Dual lens glasses interface">
        <article className="lens lens-left">
          <div className="corner-data top-left"><span>L // ENVIRONMENT</span><small>CAMERA 01 · 30 FPS</small></div><div className="corner-data top-right"><span>FOV 82°</span><small>X {Math.round(aimOffset.x)} · Y {Math.round(aimOffset.y)}</small></div>
          <div className="range-scale" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</div><div className="scan-line" aria-hidden="true" />
          <div className={`aim-control ${aimDragging ? "is-dragging" : ""}`} style={{ transform: `translate(calc(-50% + ${aimOffset.x}px), calc(-50% + ${aimOffset.y}px))` }} onPointerDown={startAimDrag} onPointerMove={moveAim} onPointerUp={() => setAimDragging(false)} onPointerCancel={() => setAimDragging(false)} onKeyDown={moveAimWithKeys} role="slider" aria-label="Scene targeting reticle" aria-valuemin={-190} aria-valuemax={190} aria-valuenow={Math.round(aimOffset.x)} aria-valuetext={`${target.name}, x ${Math.round(aimOffset.x)}, y ${Math.round(aimOffset.y)}`} tabIndex={0}><div className="reticle" aria-hidden="true"><span /><b>+</b></div><div className="target-chip">{String(targets.indexOf(target) + 1).padStart(2, "0")}</div></div>
          <div className="target-card"><small>VISUAL TARGET {String(targets.indexOf(target) + 1).padStart(2, "0")}</small><strong>{scanning ? "ANALYZING…" : target.name}</strong><div className="confidence"><i style={{ background: `linear-gradient(90deg,var(--signal) ${scanning ? 79 : target.confidence}%,#173039 ${scanning ? 79 : target.confidence}%)` }} /><span>{scanning ? "MODEL INFERENCE" : `CONFIDENCE ${target.confidence}%`}</span></div></div>
          <div className="lens-telemetry lens-telemetry-left"><div className="battery"><span>BAT 72%</span><i><b /></i><small>4H 18M</small></div><span>WIFI −58 dBm</span><button onClick={() => selectMode("calibrate")}>GAZE {calibration === 100 ? "CALIBRATED" : "READY"}</button></div>
        </article>
        <div className="bridge" aria-hidden="true"><i /><span>∞</span></div>
        <article className="lens lens-right">
          <div className="corner-data top-left"><span>R // ASSISTANT</span><small>GEMMA VISION · LOCAL</small></div><div className="corner-data right-clock"><span>{clock}</span><small>UTC +03:00</small></div>
          <button className={`menu-toggle ${menuOpen ? "is-open" : ""}`} type="button" aria-label={menuOpen ? "Close glasses menu" : "Open glasses menu"} aria-expanded={menuOpen} aria-controls="glasses-menu" onClick={() => setMenuOpen((open) => !open)}><i /><i /><i /></button>
          <div className={`answer-card ${active === "terminator" ? "terminator-card" : ""}`} aria-live="polite"><div className="answer-heading"><span className="pulse-orb" /><small>{scanning ? "ANALYZING FRAME" : answerTitle}</small><em>{scanning ? "79%" : listening || active === "terminator" ? "LIVE" : "READY"}</em></div>{active === "terminator" ? <pre className="terminator-code">{Array.from({ length: 12 }, (_, offset) => terminatorLines[(terminatorLine - 5 + offset + terminatorLines.length) % terminatorLines.length]).join("\n")}</pre> : <p>{scanning ? "Extracting objects and spatial context from the captured frame…" : answerText}</p>}
            {active === "recent" && <div className="recent-list">{recentAnswers.map((item, index) => <button key={item} onClick={() => { setNotice(`OPENED RESPONSE 0${index + 1}`); setActive(index === 2 ? "map" : "look"); }}>{`0${index + 1}`} <span>{item}</span></button>)}</div>}
            {active === "map" && <div className="mini-map" aria-label="Local navigation map"><i className="route route-a" /><i className="route route-b" /><i className="map-grid" /><b className="map-marker">●</b><span>N 42.6977<br />E 23.3219</span></div>}
            {active === "calibrate" && <div className="calibration-meter"><i style={{ width: `${calibration}%` }} /><span>{calibration}%</span></div>}
            <div className="waveform" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ height: `${7 + ((i * 13) % 22)}px` }} />)}</div>
          </div>
          <nav id="glasses-menu" className={`action-grid ${menuOpen ? "menu-visible" : ""}`} aria-label="Glasses menu" aria-hidden={!menuOpen}><div className="menu-heading"><span>APPLICATION MENU</span><small>SELECT MODULE</small></div>{actions.map((item) => <button key={item.id} tabIndex={menuOpen ? 0 : -1} className={active === item.id ? "active" : ""} onClick={() => selectMode(item.id)} aria-pressed={active === item.id}><span className="action-icon">{item.icon}</span><span>{item.label}<small>{item.meta}</small></span><b>›</b></button>)}</nav>
          <button className="ask-button" onClick={() => active === "voice" ? (setListening((value) => !value), setNotice(listening ? "VOICE CAPTURE SAVED" : "MICROPHONE ACTIVE")) : active === "calibrate" ? runCalibration() : runScan()} disabled={scanning}>{primaryLabel}</button>
          <div className="lens-telemetry lens-telemetry-right"><button className="privacy" aria-label={`Camera ${cameraActive ? "active" : "blocked"}. Toggle privacy mode.`} onClick={() => { setCameraActive((value) => !value); setNotice(cameraActive ? "CAMERA PRIVACY MODE" : "CAMERA ENABLED"); }}>◉ CAMERA {cameraActive ? "ACTIVE" : "BLOCKED"}</button><span>SERVER {connected ? "192.168.1.50" : "OFFLINE"}</span><span>AI {connected ? "READY · 12 MS" : "LOCAL ONLY"}</span></div>
        </article>
      </section>
      <div className="interaction-bar"><span aria-live="polite">{notice}</span><label className="frame-loader"><input type="file" accept="image/jpeg,image/webp" capture="environment" onChange={loadCapture} />{capturedImage ? "REPLACE FRAME" : "LOAD CAMERA FRAME"}</label><button onClick={() => setAimOffset({ x: 0, y: 0 })}>CENTER RETICLE</button><small>DRAG / ARROWS TO AIM · ENTER TO CAPTURE</small></div>
    </main>
  );
}
