/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Google OAuth Web client ID — same value as Supabase Google provider Client ID */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Sentry DSN for frontend error tracking */
  readonly VITE_SENTRY_DSN?: string;
  /** PostHog project API key */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog ingest host (defaults to app.posthog.com) */
  readonly VITE_POSTHOG_HOST?: string;
  /** VAPID public key for Web Push subscriptions */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}
