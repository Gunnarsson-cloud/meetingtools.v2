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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTheme = window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
    if (storedTheme) {
      setTheme(storedTheme);
      document.body.classList.toggle("dark", storedTheme === "dark");
    }

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
      document.body.classList.toggle("dark", next === "dark");
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
      <div className="toggle-row">
        <div>
          <h1>Meeting Recap Assistant</h1>
          <p>
            Paste a meeting transcript or upload a text file, then choose whether you want{" "}
            <strong>notes only</strong> or <strong>notes + audio recap</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--fg)",
            }}
          >
            <option value="en">EN</option>
            <option value="sv">SV</option>
          </select>
          <button className="secondary" onClick={toggleTheme}>
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
        </div>
      </div>

      <section className="card row">
        <h3>Input</h3>
        <div className="row">
          <label style={{ display: "block", marginBottom: 4 }}>Mode:</label>
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
            Notes + audio file
          </label>
        </div>

        <div className="row">
          <label style={{ display: "block", marginBottom: 4 }}>Upload transcript (.txt, .md):</label>
          <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleFileChange} />
        </div>

        <div className="row">
          <label style={{ display: "block", marginBottom: 4 }}>Or paste meeting transcript:</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your meeting transcript here..."
          />
        </div>

        <div className="row" style={{ display: "flex", gap: 12 }}>
          <button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate recap"}
          </button>
          <button className="secondary" type="button" onClick={handleDownloadZip}>
            Download ZIP
          </button>
        </div>

        {error && (
          <p style={{ color: "red", marginTop: 8 }}>
            <strong>Error:</strong> {error}
          </p>
        )}
      </section>

      <section className="row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="card">
          <h2>Notes</h2>
          <pre className="notes">{notes}</pre>
        </div>
        <div className="card">
          <h2>Audio</h2>
          {audioUrl ? (
            <audio controls src={audioUrl} style={{ width: "100%" }}>
              Your browser does not support the audio element.
            </audio>
          ) : (
            <p className="muted">No audio generated (or mode was set to notes only).</p>
          )}
        </div>
      </section>

      <section className="card row">
        <h2>Local history (this browser only)</h2>
        {history.length === 0 ? (
          <p className="muted">No previous recaps yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id} className="history-item">
                <div>
                  <div>
                    <strong>
                      {h.mode === "notes" ? "Notes" : "Notes + audio"} ·{" "}
                      {h.language === "en" ? "EN" : "SV"}
                    </strong>{" "}
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: "var(--muted)" }}>{h.notesSnippet}...</div>
                </div>
                <button className="secondary" type="button" onClick={() => restoreFromHistory(h)}>
                  View snippet
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="row">
        <div className="card">
          <h3>Privacy</h3>
          <p>
            This tool sends your transcript only to this app&apos;s backend and to OpenAI&apos;s API,
            where it is processed by a dedicated assistant. The app itself does not persist your
            transcript or full notes beyond handling the current request. A short local history is
            stored only in your browser (using localStorage) and never sent anywhere else. The audio,
            when generated, is returned directly to your browser and not stored in a shared database.
          </p>
        </div>
      </section>
    </main>
  );
}
