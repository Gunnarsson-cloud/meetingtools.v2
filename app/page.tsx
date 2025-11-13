"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";

type Mode = "notes" | "notes+audio";
type Language = "en" | "sv";

interface RecapResponse {
  notes_markdown: string;
  audioBase64?: string | null;
  mimeType?: string | null;
}

interface HistoryItem {
  id: string;
  createdAt: string;
  mode: Mode;
  language: Language;
  notesSnippet: string;
}

const HISTORY_KEY = "meetingRecapHistory";
const THEME_KEY = "meetingRecapTheme";

export default function Page() {
  const [mode, setMode] = useState<Mode>("notes");
  const [language, setLanguage] = useState<Language>("en");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTheme = (window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null) || "dark";
    setTheme(storedTheme);
    document.body.classList.toggle("light", storedTheme === "light");

    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as HistoryItem[];
        setHistory(data);
      } catch {
        // ignore
      }
    }
  }, []);

  function persistHistory(next: HistoryItem[]) {
    setHistory(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    }
  }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, next);
      document.body.classList.toggle("light", next === "light");
    }
  }

  async function handleGenerate() {
    setError(null);
    setNotes("");
    setAudioUrl(null);
    setAudioBlob(null);

    if (!transcript.trim()) {
      setError("Please paste a transcript or upload a text file first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, mode, language }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text}`);
      }

      const data: RecapResponse = await res.json();
      setNotes(data.notes_markdown || "");

      const item: HistoryItem = {
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
        mode,
        language,
        notesSnippet: (data.notes_markdown || "").slice(0, 120),
      };
      const nextHistory = [item, ...history].slice(0, 20);
      persistHistory(nextHistory);

      if (data.audioBase64 && data.mimeType) {
        const blob = base64ToBlob(data.audioBase64, data.mimeType);
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function base64ToBlob(base64: string, mimeType: string) {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  async function handleDownloadZip() {
    if (!notes) {
      setError("There are no notes to download yet.");
      return;
    }

    const zip = new JSZip();
    zip.file("meeting_notes.md", notes);

    if (audioBlob) {
      zip.file("meeting_recap.mp3", audioBlob);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meeting_recap_bundle.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["text/plain", "text/markdown", ""];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && ext !== "txt" && ext !== "md") {
      setError("Only plain text files (.txt, .md) are supported in this version.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setTranscript(text);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
  }

  function restoreFromHistory(item: HistoryItem) {
    setNotes(item.notesSnippet + (item.notesSnippet.length === 120 ? " ..." : ""));
  }

  return (
    <main>
      <div className="app-shell">
        <header className="app-header">
          <div>
            <div className="app-title">
              <span className="logo-dot" />
              <span>Meeting Recap Assistant</span>
            </div>
            <p className="app-subtitle">
              Turn long transcripts into focused notes and a short spoken recap.
            </p>
          </div>
          <div className="controls-row">
            <div className="pill-group" aria-label="Output language">
              <button
                type="button"
                className={language === "en" ? "pill active" : "pill"}
                onClick={() => setLanguage("en")}
              >
                EN · English
              </button>
              <button
                type="button"
                className={language === "sv" ? "pill active" : "pill"}
                onClick={() => setLanguage("sv")}
              >
                SE · Svenska
              </button>
            </div>
            <button type="button" className="icon-button" onClick={toggleTheme}>
              {theme === "light" ? "🌙 Dark mode" : "☀️ Light mode"}
            </button>
          </div>
        </header>

        <section className="card">
          <h2>1. Input</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Choose what you want back and which language the notes and audio should use.
          </p>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <strong>Output type</strong>
              <div style={{ marginTop: 6 }}>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="notes"
                    checked={mode === "notes"}
                    onChange={() => setMode("notes")}
                  />{" "}
                  Notes only
                </label>
                <br />
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="notes+audio"
                    checked={mode === "notes+audio"}
                    onChange={() => setMode("notes+audio")}
                  />{" "}
                  Notes + audio recap
                </label>
              </div>
            </div>
            <div>
              <strong>Language for notes & audio</strong>
              <p className="muted" style={{ marginTop: 4 }}>
                EN = English, SE = Swedish (Svenska).
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>
              Upload transcript (.txt, .md)
            </label>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFileChange}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Or paste meeting transcript</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your meeting transcript here..."
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Generating..." : "Generate recap"}
            </button>
            <button type="button" className="secondary" onClick={handleDownloadZip}>
              Download ZIP (notes + audio)
            </button>
          </div>

          {error && (
            <p style={{ color: "#f97373", marginTop: 10 }}>
              <strong>Error:</strong> {error}
            </p>
          )}
        </section>

        <section className="grid-2 card">
          <div>
            <h2>2. Notes</h2>
            <pre className="notes">{notes}</pre>
          </div>
          <div>
            <h2>3. Audio recap</h2>
            {audioUrl ? (
              <audio controls src={audioUrl} style={{ width: "100%", marginTop: 8 }}>
                Your browser does not support the audio element.
              </audio>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>
                No audio generated yet. Select “Notes + audio recap” and generate again.
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Recent recaps (this browser only)</h2>
          {history.length === 0 ? (
            <p className="muted">You haven&apos;t generated any recaps yet.</p>
          ) : (
            <ul className="history-list">
              {history.map((h) => (
                <li key={h.id} className="history-item">
                  <div>
                    <div>
                      <strong>
                        {h.mode === "notes" ? "Notes" : "Notes + audio"} ·{" "}
                        {h.language === "en" ? "EN" : "SE"}
                      </strong>{" "}
                      <span className="muted">
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="muted">{h.notesSnippet}...</div>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => restoreFromHistory(h)}
                  >
                    View snippet
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Privacy</h2>
          <p className="muted">
            Your transcript is sent only to this tool&apos;s backend and a language model to generate
            notes and the optional audio recap. The tool itself does not store your transcript or
            full notes beyond the current request. A short local history is kept only in this
            browser (via localStorage) and is never uploaded. Audio, when generated, is returned
            directly to your browser and not stored in a shared database.
          </p>
        </section>
      </div>
    </main>
  );
}
