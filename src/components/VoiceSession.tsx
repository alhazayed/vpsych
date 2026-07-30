"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { SessionTimer } from "@/components/SessionTimer";
import { remainingSeconds } from "@/lib/session-timer";
import type { SessionMessage, TherapySession } from "@/lib/types";

type ClientAvatar = {
  id: string;
  name: string;
  disorder: string;
  age: number | null;
  gender: string | null;
  portrait_url: string | null;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number };
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function VoiceSession({
  session,
  avatar,
  initialMessages,
}: {
  session: TherapySession;
  avatar: ClientAvatar;
  initialMessages: SessionMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(session.started_at, session.max_duration_sec),
  );
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Ready — hold the mic or type a turn.");
  const [ending, setEnding] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const endingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    setStatus("Ending session and generating admin report…");
    try {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setStatus(data?.error ?? "Failed to end session. Try again.");
        endingRef.current = false;
        setEnding(false);
        return;
      }
      router.push(`/sessions/${session.id}/complete`);
      router.refresh();
    } catch {
      setStatus("Failed to end session. Try again.");
      endingRef.current = false;
      setEnding(false);
    }
  }, [router, session.id]);

  useEffect(() => {
    const tick = () => {
      const left = remainingSeconds(
        session.started_at,
        session.max_duration_sec,
      );
      setRemaining(left);
      if (left <= 0 && !endingRef.current) {
        void endSession();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endSession, session.max_duration_sec, session.started_at]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || endingRef.current) return;
      setPending(true);
      setStatus("Patient is responding…");
      setDraft("");
      try {
        const res = await fetch(`/api/sessions/${session.id}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.expired) {
            await endSession();
            return;
          }
          setStatus(data.error ?? "Failed to send message");
          return;
        }
        setMessages((prev) => [
          ...prev,
          data.userMessage as SessionMessage,
          data.assistantMessage as SessionMessage,
        ]);
        speak((data.assistantMessage as SessionMessage).content);
        setStatus("Listening for your next turn.");
      } catch {
        setStatus("Network error — try again.");
      } finally {
        setPending(false);
      }
    },
    [endSession, pending, session.id],
  );

  function toggleListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("Speech recognition unavailable — type your turn below.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += piece;
        else interim += piece;
      }
      if (finalText) {
        setDraft(finalText);
        setStatus("Captured speech — sending…");
        void sendMessage(finalText);
      } else if (interim) {
        setDraft(interim);
        setStatus("Listening…");
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      setStatus(`Mic error: ${event.error}. You can type instead.`);
    };
    recognition.onend = () => setListening(false);

    recognition.start();
    setListening(true);
    setStatus("Listening — speak now.");
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Live session
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
              {avatar.name}
            </h1>
            <p className="mt-1 text-[var(--muted)]">{avatar.disorder}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">
              Time left
            </p>
            <SessionTimer remaining={remaining} />
          </div>
        </div>

        <AvatarPortrait
          name={avatar.name}
          src={avatar.portrait_url}
          speaking={speaking}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={toggleListen}
            disabled={pending || ending}
            className={`rounded-full px-5 py-3 text-sm font-medium transition ${
              listening
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--ink)] text-[var(--paper)] hover:opacity-90"
            } disabled:opacity-50`}
          >
            {listening ? "Stop mic" : "Hold to talk"}
          </button>
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={ending}
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm text-[var(--ink)] hover:bg-[var(--wash)] disabled:opacity-50"
          >
            {ending ? "Ending…" : "End session"}
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">{status}</p>
      </section>

      <section className="flex min-h-[28rem] flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)]/70 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          Transcript
        </h2>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages
            .filter((m) => m.role !== "system")
            .map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "bg-[var(--wash)] text-[var(--ink)]"
                }`}
              >
                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  {m.role === "user" ? "You" : avatar.name}
                </p>
                {m.content}
              </div>
            ))}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-4 flex gap-2 border-t border-[var(--line)] pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a turn if mic is unavailable…"
            className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            disabled={pending || ending}
          />
          <button
            type="submit"
            disabled={pending || ending || !draft.trim()}
            className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--paper)] disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
