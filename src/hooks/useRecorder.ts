import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "ready";

// Maximum recording length in seconds. Configurable technical limit.
export const MAX_RECORDING_SECONDS = 15 * 60;

function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = 16000): Blob {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const ratio = sampleRate / targetRate;
  const outLength = ratio > 1 ? Math.floor(merged.length / ratio) : merged.length;
  const samples = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    samples[i] = merged[Math.floor(i * (ratio > 1 ? ratio : 1))] ?? 0;
  }
  const rate = ratio > 1 ? targetRate : sampleRate;

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let pos = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const pausedRef = useRef(false);

  const teardown = useCallback(() => {
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    if (state !== "recording") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const finish = useCallback(() => {
    const ctx = ctxRef.current;
    const rate = ctx?.sampleRate ?? 44100;
    teardown();
    const wav = encodeWav(chunksRef.current, rate);
    chunksRef.current = [];
    if (wav.size < 4096) {
      setError("A gravação ficou vazia. Verifique o microfone e grave novamente.");
      setState("idle");
      setSeconds(0);
      return;
    }
    setBlob(wav);
    setAudioUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(wav);
    });
    setState("ready");
  }, [teardown]);

  const stop = useCallback(() => {
    if (state !== "recording" && state !== "paused") return;
    finish();
  }, [finish, state]);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setSeconds(0);
    chunksRef.current = [];
    pausedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      node.onaudioprocess = (event) => {
        if (pausedRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));
        let peak = 0;
        for (let i = 0; i < input.length; i += 32) peak = Math.max(peak, Math.abs(input[i]));
        setLevel(peak);
      };
      source.connect(node);
      node.connect(ctx.destination);
      setState("recording");
    } catch {
      setError(
        "Não conseguimos acessar seu microfone. Autorize o uso do microfone no navegador e tente novamente.",
      );
      setState("idle");
    }
  }, []);

  useEffect(() => {
    if (state === "recording" && seconds >= MAX_RECORDING_SECONDS) finish();
  }, [seconds, state, finish]);

  const pause = useCallback(() => {
    if (state !== "recording") return;
    pausedRef.current = true;
    setState("paused");
  }, [state]);

  const resume = useCallback(() => {
    if (state !== "paused") return;
    pausedRef.current = false;
    setState("recording");
  }, [state]);

  const reset = useCallback(() => {
    teardown();
    chunksRef.current = [];
    pausedRef.current = false;
    setBlob(null);
    setSeconds(0);
    setLevel(0);
    setError(null);
    setState("idle");
    setAudioUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, [teardown]);

  return { state, seconds, level, error, blob, audioUrl, start, pause, resume, stop, reset };
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
