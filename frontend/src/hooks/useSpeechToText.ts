import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function fullTranscriptFromEvent(event: SpeechRecognitionEvent): string {
  let text = "";
  for (let i = 0; i < event.results.length; i++) {
    text += event.results[i][0].transcript;
  }
  return text.replace(/\s+/g, " ").trim();
}

export type SpeechToTextOptions = {
  /** Text in the box when mic was pressed — preserved while dictating. */
  baseText: string;
  /** Full phrase so far (base + dictated); replaces textarea while listening. */
  onPhrase: (phrase: string) => void;
};

/**
 * Dictation via Web Speech API. Rebuilds the full phrase from all result
 * segments each update so nothing is dropped mid-sentence.
 */
export function useSpeechToText({ baseText, onPhrase }: SpeechToTextOptions) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recRef.current?.abort();
    };
  }, []);

  const merge = useCallback(
    (dictated: string) => {
      const base = baseRef.current.trim();
      if (!dictated) {
        onPhrase(base);
        return;
      }
      onPhrase(base ? `${base} ${dictated}` : dictated);
    },
    [onPhrase],
  );

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    recRef.current?.abort();
    baseRef.current = baseText;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      merge(fullTranscriptFromEvent(event));
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [baseText, merge]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, toggle, stop };
}
