"use client";

import { useEffect, useState } from "react";

const actions = [
  { id: "look", icon: "◉", label: "LOOK & ASK", meta: "VISION QUERY" },
  { id: "voice", icon: "⌁", label: "VOICE", meta: "LISTEN MODE" },
  { id: "recent", icon: "▤", label: "RECENT", meta: "3 ANSWERS" },
  { id: "calibrate", icon: "⌖", label: "CALIBRATE", meta: "EYE TRACKER" },
];

const responses: Record<string, { title: string; text: string }> = {
  look: { title: "VISUAL ANALYSIS", text: "I can see a workstation with a display, keyboard, and a dark desktop surface." },
  voice: { title: "VOICE CHANNEL", text: "Listening locally. Ask a question when the waveform turns solid." },
  recent: { title: "RECENT RESPONSE 03", text: "Your server was healthy. Vision model latency was 1.8 seconds." },
  calibrate: { title: "GAZE CALIBRATION", text: "Focus on the left reticle, then confirm with the side control." },
};

export default function Home() {
  const [active, setActive] = useState("look");
  const [scanning, setScanning] = useState(false);
  const [clock, setClock] = useState("12:08:39");
  const response = responses[active];

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB"));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function runScan() {
    setActive("look");
    setScanning(true);
    window.setTimeout(() => setScanning(false), 1800);
  }

  return (
    <main className={`hud-shell ${scanning ? "is-scanning" : ""}`}>
      <div className="grain" aria-hidden="true" />
      <header className="system-bar">
        <span className="brand"><b>△</b> ARGUS // VISION OS</span>
        <span className="coordinates">N 42.6977 · E 23.3219</span>
        <span className="status-live"><i /> LINK ACTIVE</span>
      </header>

      <section className="glasses" aria-label="Dual lens glasses interface">
        <article className="lens lens-left">
          <div className="corner-data top-left"><span>L // ENVIRONMENT</span><small>CAMERA 01 · 30 FPS</small></div>
          <div className="corner-data top-right"><span>FOV 82°</span><small>AUTO EXPOSURE</small></div>
          <div className="range-scale" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</div>
          <div className="scan-line" aria-hidden="true" />
          <div className="reticle" aria-hidden="true"><span /><b>+</b></div>
          <div className="target-chip">04</div>
          <div className="target-card">
            <small>VISUAL TARGET 04</small><strong>{scanning ? "ANALYZING…" : "WORKSTATION"}</strong>
            <div className="confidence"><i /><span>{scanning ? "MODEL INFERENCE" : "CONFIDENCE 94%"}</span></div>
          </div>
          <div className="lens-footer"><span>ISO 320</span><span>1/120</span><span>RAW + DEPTH</span></div>
        </article>

        <div className="bridge" aria-hidden="true"><i /><span>∞</span></div>

        <article className="lens lens-right">
          <div className="corner-data top-left"><span>R // ASSISTANT</span><small>GEMMA VISION · LOCAL</small></div>
          <div className="corner-data top-right"><span>{clock}</span><small>UTC +03:00</small></div>
          <div className="answer-card" aria-live="polite">
            <div className="answer-heading"><span className="pulse-orb" /><small>{scanning ? "ANALYZING FRAME" : response.title}</small><em>{scanning ? "79%" : "READY"}</em></div>
            <p>{scanning ? "Extracting objects and spatial context from the captured frame…" : response.text}</p>
            <div className="waveform" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ height: `${7 + ((i * 13) % 22)}px` }} />)}</div>
          </div>
          <nav className="action-grid" aria-label="Glasses menu">
            {actions.map((item) => (
              <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => { setActive(item.id); setScanning(false); }} aria-pressed={active === item.id}>
                <span className="action-icon">{item.icon}</span><span>{item.label}<small>{item.meta}</small></span><b>›</b>
              </button>
            ))}
          </nav>
          <button className="ask-button" onClick={runScan} disabled={scanning}>{scanning ? "SCANNING 79%" : "◎ CAPTURE SCENE"}</button>
          <div className="lens-footer"><span>QUEUE 0</span><span>AI READY</span><span>12 MS</span></div>
        </article>
      </section>

      <footer className="telemetry-bar">
        <div className="battery"><span>BAT 72%</span><i><b /></i><small>4H 18M</small></div>
        <span>WIFI −58 dBm</span><span>GAZE CALIBRATED</span>
        <span className="privacy">◉ CAMERA ACTIVE</span><span>SERVER 192.168.1.50</span>
      </footer>
      <p className="hint">GAZE TO SELECT · SIDE BUTTON TO CONFIRM · HOLD TO DISMISS</p>
    </main>
  );
}
