"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Checkbox } from "@/components/ui";
import { TRANSCRIPT_TEXT_LIMIT } from "@shared/growth/dealTranscripts";

interface DeviceRecognizer {
  lang: string;
  continuous: boolean;
  processLocally: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface RecognitionConstructor {
  new(): DeviceRecognizer;
  available?(options: { langs: string[]; processLocally: true }): Promise<string>;
}

export function ConversationCapture({ onAppend, remaining }: { onAppend: (text: string) => void; remaining: number }) {
  const [allowed, setAllowed] = useState(false);
  const [mode, setMode] = useState<"idle" | "starting" | "recording" | "transcribing" | "stopping">("idle");
  const [message, setMessage] = useState("");
  const [words, setWords] = useState("");
  const [audio, setAudio] = useState<{ url: string; extension: string } | null>(null);
  const session = useRef(0);
  const stopCapture = useRef<(() => void) | null>(null);
  const discardCapture = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    session.current++;
    discardCapture.current?.();
  }, []);
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio.url); }, [audio]);

  async function begin(kind: "audio" | "text") {
    if (!allowed || mode !== "idle") return;
    const ticket = ++session.current;
    const current = () => session.current === ticket;
    const finish = () => {
      if (!current()) return;
      stopCapture.current = discardCapture.current = null;
      setMode("idle");
    };
    setMode("starting");
    setMessage("");
    try {
      if (kind === "text") {
        const browser = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
        const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
        const lang = navigator.language;
        if (!Recognition?.available || !lang || !("processLocally" in Recognition.prototype)
          || await Recognition.available({ langs: [lang], processLocally: true }) !== "available") {
          throw new Error("On-device transcription is unavailable for this browser language. You can paste reviewed text or import a transcript file.");
        }
        if (!current()) return;
        const recognizer = new Recognition();
        recognizer.lang = lang;
        recognizer.processLocally = true;
        if (recognizer.processLocally !== true) throw new Error("This browser could not confirm on-device processing.");
        recognizer.continuous = true;
        let recognized = "";
        recognizer.onresult = event => {
          if (!current()) return;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (!event.results[i].isFinal) continue;
            const next = [recognized, event.results[i][0].transcript.trim()].filter(Boolean).join(" ");
            if (next.length > TRANSCRIPT_TEXT_LIMIT) {
              setMessage("The next phrase exceeded the transcript limit. Review the captured text and start a separate excerpt if needed.");
              recognizer.stop();
              return;
            }
            recognized = next;
          }
          setWords(recognized);
        };
        recognizer.onend = finish;
        recognizer.onerror = () => { if (current()) setMessage("Transcription was interrupted. Review any available words before saving."); };
        stopCapture.current = () => recognizer.stop();
        discardCapture.current = () => recognizer.abort();
        recognizer.start();
        setMode("transcribing");
      } else {
        if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("Microphone recording is unavailable in this browser.");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const release = () => stream.getTracks().forEach(track => track.stop());
        if (!current()) { release(); return; }
        discardCapture.current = release;
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        let bytes = 0;
        const stop = () => { if (recorder.state !== "inactive") recorder.stop(); };
        const timer = window.setTimeout(stop, 15 * 60_000);
        const cleanup = () => { window.clearTimeout(timer); release(); };
        discardCapture.current = () => { stop(); cleanup(); };
        stopCapture.current = stop;
        recorder.ondataavailable = event => {
          if (!current() || !event.data.size) return;
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes >= 16 * 1024 * 1024) stop();
        };
        recorder.onerror = () => { if (current()) setMessage("Recording was interrupted. Review any available audio."); stop(); cleanup(); };
        recorder.onstop = () => {
          cleanup();
          if (!current()) return;
          const type = recorder.mimeType || chunks[0]?.type || "application/octet-stream";
          if (bytes) setAudio({ url: URL.createObjectURL(new Blob(chunks, { type })), extension: /mp4/i.test(type) ? "mp4" : /webm/i.test(type) ? "webm" : /ogg/i.test(type) ? "ogg" : "audio" });
          else setMessage("No audio was captured.");
          finish();
        };
        recorder.start(1000);
        setMode("recording");
      }
    } catch (error) {
      if (!current()) return;
      discardCapture.current?.();
      setMessage(error instanceof Error ? error.message : "Capture could not start.");
      finish();
    }
  }

  function stop() {
    if (mode === "starting") {
      session.current++;
      setMode("idle");
    } else {
      setMode("stopping");
      stopCapture.current?.();
    }
  }

  return <div className="space-y-2 rounded-lg bg-surface-2 p-3">
    <p className="text-sm font-medium">Capture a conversation on this device</p>
    <p className="text-xs text-ink-2">Only sound reaching this microphone can be captured. Audio stays in this tab until you download or discard it. Each recording stops after 15 minutes or about 16 MB. On-device transcription uses your browser language when an installed language pack is available.</p>
    <Checkbox label="Everyone whose voice will be captured agreed to this recording or transcription" checked={allowed} disabled={mode !== "idle"} onCheckedChange={v => setAllowed(v === true)} />
    <div className="flex flex-wrap gap-2">
      {mode === "idle" ? <>
        <Button size="sm" variant="secondary" disabled={!allowed || audio !== null} onClick={() => void begin("audio")}>Record microphone audio</Button>
        <Button size="sm" variant="secondary" disabled={!allowed || Boolean(words)} onClick={() => void begin("text")}>Transcribe on this device</Button>
      </> : <Button size="sm" disabled={mode === "stopping"} onClick={stop}>{mode === "starting" ? "Cancel capture" : "Stop capture"}</Button>}
    </div>
    {mode !== "idle" && <p role="status">{mode === "starting" ? "Preparing capture…" : mode === "recording" ? "Microphone recording is active." : mode === "transcribing" ? "On-device transcription is active." : "Finishing capture…"}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {audio && <div className="space-y-2"><audio controls src={audio.url} aria-label="Review local microphone recording" className="max-w-full" />
      <a className="text-sm underline" href={audio.url} download={`conversation.${audio.extension}`}>Download audio</a>
      <Button size="sm" variant="ghost" onClick={() => setAudio(null)}>Discard audio</Button></div>}
    {words && <div className="space-y-2"><p className="whitespace-pre-wrap break-words text-sm">{words}</p>
      {mode === "idle" && <><Button size="sm" variant="secondary" disabled={words.length > remaining} onClick={() => { onAppend(words); setWords(""); }}>Add words to transcript draft</Button>
        {words.length > remaining && <p className="text-xs">There is insufficient space in this draft. Copy the words you need or shorten the existing draft.</p>}
        <Button size="sm" variant="ghost" onClick={() => setWords("")}>Discard words</Button></>}
    </div>}
  </div>;
}
