import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

interface RecapRequest {
  transcript: string;
  mode?: "notes" | "notes+audio";
  language?: "en" | "sv";
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 },
    );
  }
  if (!ASSISTANT_ID) {
    return NextResponse.json(
      { error: "OPENAI_ASSISTANT_ID is not set" },
      { status: 500 },
    );
  }

  let body: RecapRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcript = (body.transcript || "").trim();
  const mode = body.mode || "notes";
  const language = body.language || "en";

  if (!transcript) {
    return NextResponse.json(
      { error: "Transcript is empty" },
      { status: 400 },
    );
  }

  const languageInstruction =
    language === "sv"
      ? "Please write the notes and voiceover script in Swedish."
      : "Please write the notes and voiceover script in English.";

  try {
    const thread = await client.beta.threads.create({
      messages: [
        {
          role: "user",
          content: `${languageInstruction}\n\nTranscript:\n\n${transcript}`,
        },
      ],
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: ASSISTANT_ID,
      response_format: { type: "json_object" },
    });

    if (run.status !== "completed") {
      return NextResponse.json(
        { error: `Run did not complete: ${run.status}` },
        { status: 500 },
      );
    }

    const messages = await client.beta.threads.messages.list(thread.id);
    const assistantMsg = messages.data.find((m) => m.role === "assistant");

    if (!assistantMsg || !assistantMsg.content.length) {
      return NextResponse.json(
        { error: "No assistant response found" },
        { status: 500 },
      );
    }

    const firstPart = assistantMsg.content[0];
    if (firstPart.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected assistant content type" },
        { status: 500 },
      );
    }

    const raw = firstPart.text.value;
    let parsed: { notes_markdown: string; voiceover_script?: string };

    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      return NextResponse.json(
        { error: "Failed to parse JSON from assistant", raw },
        { status: 500 },
      );
    }

    const notes_markdown = parsed.notes_markdown ?? "";
    const voiceover_script = parsed.voiceover_script ?? "";

    if (mode === "notes") {
      return NextResponse.json({
        notes_markdown,
        audioBase64: null,
        mimeType: null,
      });
    }

    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: voiceover_script,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    const audioBase64 = buffer.toString("base64");

    return NextResponse.json({
      notes_markdown,
      audioBase64,
      mimeType: "audio/mpeg",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
