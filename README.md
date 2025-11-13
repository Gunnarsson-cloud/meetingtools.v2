# Meeting Recap Assistant (Upgraded + Language toggle)

This is an upgraded Next.js 14 app that exposes an API route backed by your OpenAI Assistant
and a richer UI for users to paste or upload meeting transcripts and choose:

- Notes only
- Notes + audio file

New extras in this version:
- Language toggle: English / Swedish. The choice is sent as a hint along with the transcript.
- Nicer UI with light / dark mode toggle
- File upload for plain text files (`.txt`, `.md`)
- Local history stored in the browser (no backend persistence)
- "Download ZIP" button to download notes (`meeting_notes.md`) and audio (`meeting_recap.mp3`) as a single archive

## Environment variables

Set these in Vercel (Project Settings → Environment Variables):

- `OPENAI_API_KEY` – your OpenAI API key
- `OPENAI_ASSISTANT_ID` – the ID of your Assistant
  (for example: asst_13JyEdidVQ3kDqrldYHU2559)

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.
