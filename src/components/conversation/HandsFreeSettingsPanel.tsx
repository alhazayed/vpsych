"use client";

import { useEffect, useState } from "react";
import type { VoiceConversationPreferences } from "@/lib/conversation";
import {
  loadLocalVoicePreferences,
  mergeVoicePreferences,
  saveLocalVoicePreferences,
} from "@/lib/conversation";

type Props = {
  open: boolean;
  onClose: () => void;
  value: VoiceConversationPreferences;
  onChange: (next: VoiceConversationPreferences) => void;
  labels: {
    title: string;
    mode: string;
    handsFree: string;
    pushToTalk: string;
    autoInterrupt: string;
    thinkingDelay: string;
    waveform: string;
    sensitivity: string;
    close: string;
  };
};

export function HandsFreeSettingsPanel({
  open,
  onClose,
  value,
  onChange,
  labels,
}: Props) {
  if (!open) return null;

  function patch(partial: Partial<VoiceConversationPreferences>) {
    const next = mergeVoicePreferences(value, partial);
    onChange(next);
    saveLocalVoicePreferences(next);
    void fetch("/api/conversation/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }).catch(() => {
      /* local prefs still apply */
    });
  }

  return (
    <div className="fixed end-4 top-24 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--on-surface)]">
          {labels.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-[var(--on-surface-variant)]"
        >
          {labels.close}
        </button>
      </div>
      <label className="mb-3 block text-xs font-semibold text-[var(--on-surface-variant)]">
        {labels.mode}
        <select
          className="field-input mt-1 w-full text-sm"
          value={value.mode}
          onChange={(e) =>
            patch({
              mode: e.target.value === "push_to_talk" ? "push_to_talk" : "hands_free",
            })
          }
        >
          <option value="hands_free">{labels.handsFree}</option>
          <option value="push_to_talk">{labels.pushToTalk}</option>
        </select>
      </label>
      <Toggle
        label={labels.autoInterrupt}
        checked={value.autoInterrupt}
        onChange={(autoInterrupt) => patch({ autoInterrupt })}
      />
      <Toggle
        label={labels.waveform}
        checked={value.showWaveform}
        onChange={(showWaveform) => patch({ showWaveform })}
      />
      <label className="mb-3 block text-xs font-semibold text-[var(--on-surface-variant)]">
        {labels.thinkingDelay}
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={value.thinkingDelayScale}
          onChange={(e) =>
            patch({ thinkingDelayScale: Number(e.target.value) })
          }
          className="mt-2 w-full"
        />
      </label>
      <label className="block text-xs font-semibold text-[var(--on-surface-variant)]">
        {labels.sensitivity}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value.voiceSensitivity}
          onChange={(e) =>
            patch({ voiceSensitivity: Number(e.target.value) })
          }
          className="mt-2 w-full"
        />
      </label>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--on-surface-variant)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/** Hydrate preferences from localStorage then optional server. */
export function useVoicePreferences(enabled: boolean) {
  const [prefs, setPrefs] = useState(() => loadLocalVoicePreferences());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/conversation/preferences");
        if (!res.ok) return;
        const data = (await res.json()) as {
          preferences?: VoiceConversationPreferences;
        };
        if (!cancelled && data.preferences) {
          setPrefs(data.preferences);
          saveLocalVoicePreferences(data.preferences);
        }
      } catch {
        /* keep local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return [prefs, setPrefs] as const;
}
