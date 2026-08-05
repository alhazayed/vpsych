"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CQI_CATEGORIES,
  CQI_CONFIDENCES,
  CQI_SEVERITIES,
  CQI_VERSION,
  type CqiAnnotation,
  type CqiCategory,
  type CqiConfidence,
  type CqiQualityScores,
  type CqiSeverity,
} from "@/lib/cqi/types";
import type { ResolvedAvatar, SessionMessage, TherapySession } from "@/lib/types";

type Props = {
  session: TherapySession;
  avatar: ResolvedAvatar;
  messages: SessionMessage[];
};

const SCORE_KEYS: Array<{ key: keyof CqiQualityScores; labelKey: string }> = [
  { key: "clinical_realism", labelKey: "scoreClinical" },
  { key: "conversation_realism", labelKey: "scoreConversation" },
  { key: "educational_usefulness", labelKey: "scoreEducational" },
  { key: "voice_realism", labelKey: "scoreVoice" },
  { key: "assessment_quality", labelKey: "scoreAssessment" },
  { key: "overall_confidence", labelKey: "scoreConfidence" },
];

export function FlagThisMoment({ session, avatar, messages }: Props) {
  const t = useTranslations("session.cqi");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<CqiCategory>("clinical_realism");
  const [severity, setSeverity] = useState<CqiSeverity>("medium");
  const [confidence, setConfidence] = useState<CqiConfidence>("probably");
  const [freeText, setFreeText] = useState("");
  const [suggested, setSuggested] = useState("");
  const [expected, setExpected] = useState("");
  const [reducesEdu, setReducesEdu] = useState<"yes" | "no" | "">("");
  const [residency, setResidency] = useState<"yes" | "no" | "">("");
  const [recommend, setRecommend] = useState<"yes" | "no" | "">("");
  const [anonymous, setAnonymous] = useState(false);
  const [scores, setScores] = useState<CqiQualityScores>({});
  const [highlightQuote, setHighlightQuote] = useState("");
  const [highlightNote, setHighlightNote] = useState("");
  const [annotations, setAnnotations] = useState<CqiAnnotation[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const recent = useMemo(() => messages.slice(-8), [messages]);

  function addAnnotation() {
    const quote = highlightQuote.trim();
    if (!quote) return;
    setAnnotations((prev) => [
      ...prev,
      { quote, note: highlightNote.trim() || undefined },
    ]);
    setHighlightQuote("");
    setHighlightNote("");
  }

  async function startVoiceNote() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: "audio/webm" }));
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
      };
      rec.start();
      setMediaRecorder(rec);
      setRecording(true);
    } catch {
      setError(t("micDenied"));
    }
  }

  function stopVoiceNote() {
    mediaRecorder?.stop();
    setMediaRecorder(null);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setDoneId(null);
    try {
      const browser = {
        user_agent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        viewport: { w: window.innerWidth, h: window.innerHeight },
      };

      const res = await fetch(`/api/sessions/${session.id}/cqi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymous,
          category,
          severity,
          confidence,
          free_text: freeText,
          suggested_improvement: suggested || undefined,
          expected_behaviour: expected || undefined,
          reduces_educational_quality:
            reducesEdu === "" ? null : reducesEdu === "yes",
          usable_in_residency: residency === "" ? null : residency === "yes",
          would_recommend: recommend === "" ? null : recommend === "yes",
          scores,
          annotations,
          context: {
            session_id: session.id,
            browser,
            patient_mind_state: null,
            assessment_state: null,
            llm_model: null,
            cqi_version: CQI_VERSION,
          },
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        flag_id?: string;
        error?: string;
      };
      if (!res.ok || !data.flag_id) {
        setError(data.error || t("submitFailed"));
        return;
      }

      const flagId = data.flag_id;

      if (audioBlob) {
        const fd = new FormData();
        fd.set("flag_id", flagId);
        fd.set("kind", "audio");
        fd.set(
          "file",
          new File([audioBlob], "voice-note.webm", { type: "audio/webm" }),
        );
        await fetch(`/api/sessions/${session.id}/cqi/attachments`, {
          method: "POST",
          body: fd,
        });
      }

      if (file) {
        const fd = new FormData();
        fd.set("flag_id", flagId);
        fd.set(
          "kind",
          file.type.startsWith("image/")
            ? "screenshot"
            : file.type.startsWith("video/")
              ? "screen_recording"
              : file.type === "application/pdf"
                ? "pdf"
                : "other",
        );
        fd.set("file", file);
        await fetch(`/api/sessions/${session.id}/cqi/attachments`, {
          method: "POST",
          body: fd,
        });
      }

      setDoneId(flagId);
      setFreeText("");
      setSuggested("");
      setExpected("");
      setAnnotations([]);
      setAudioBlob(null);
      setFile(null);
    } catch {
      setError(t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setDoneId(null);
          setError(null);
        }}
        className="fixed bottom-24 end-4 z-[60] inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-lg transition hover:bg-[var(--primary-fixed)] md:bottom-8 md:end-8"
        aria-label={t("flagButton")}
      >
        <span className="material-symbols-outlined text-[20px]">flag</span>
        {t("flagButton")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cqi-dialog-title"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-2xl md:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-5 py-4">
              <div>
                <h2
                  id="cqi-dialog-title"
                  className="font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]"
                >
                  {t("dialogTitle")}
                </h2>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {t("dialogSubtitle", {
                    patient: avatar.name,
                    disorder: avatar.disorder,
                  })}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary h-9 px-3 text-xs"
                onClick={() => setOpen(false)}
              >
                {t("close")}
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              <p className="rounded-lg bg-[var(--surface-container)] px-3 py-2 text-xs text-[var(--on-surface-variant)]">
                {t("autoContext")}
              </p>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("category")}</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CQI_CATEGORIES.map((c) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="cqi-cat"
                        checked={category === c}
                        onChange={() => setCategory(c)}
                      />
                      {t(`categories.${c}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-semibold">{t("severity")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                    value={severity}
                    onChange={(e) =>
                      setSeverity(e.target.value as CqiSeverity)
                    }
                  >
                    {CQI_SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {t(`severities.${s}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold">{t("confidence")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                    value={confidence}
                    onChange={(e) =>
                      setConfidence(e.target.value as CqiConfidence)
                    }
                  >
                    {CQI_CONFIDENCES.map((c) => (
                      <option key={c} value={c}>
                        {t(`confidences.${c}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="font-semibold">{t("freeText")}</span>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder={t("freeTextPlaceholder")}
                />
              </label>

              <label className="block text-sm">
                <span className="font-semibold">{t("suggested")}</span>
                <textarea
                  className="mt-1 min-h-16 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                  value={suggested}
                  onChange={(e) => setSuggested(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="font-semibold">{t("expected")}</span>
                <textarea
                  className="mt-1 min-h-16 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="font-semibold">{t("reducesEdu")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                    value={reducesEdu}
                    onChange={(e) =>
                      setReducesEdu(e.target.value as "yes" | "no" | "")
                    }
                  >
                    <option value="">—</option>
                    <option value="yes">{t("yes")}</option>
                    <option value="no">{t("no")}</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold">{t("residency")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                    value={residency}
                    onChange={(e) =>
                      setResidency(e.target.value as "yes" | "no" | "")
                    }
                  >
                    <option value="">—</option>
                    <option value="yes">{t("yes")}</option>
                    <option value="no">{t("no")}</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-semibold">{t("recommend")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-white px-3 py-2"
                    value={recommend}
                    onChange={(e) =>
                      setRecommend(e.target.value as "yes" | "no" | "")
                    }
                  >
                    <option value="">—</option>
                    <option value="yes">{t("yes")}</option>
                    <option value="no">{t("no")}</option>
                  </select>
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("scores")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SCORE_KEYS.map(({ key, labelKey }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <span className="w-40 shrink-0">{t(labelKey)}</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className="w-20 rounded border border-[var(--outline-variant)] px-2 py-1"
                        value={scores[key] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value
                            ? Number(e.target.value)
                            : undefined;
                          setScores((s) => ({ ...s, [key]: v }));
                        }}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">
                  {t("annotate")}
                </legend>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {t("annotateHint")}
                </p>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--outline-variant)] p-2 text-xs">
                  {recent.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="block w-full rounded px-2 py-1 text-start hover:bg-[var(--surface-container)]"
                      onClick={() => setHighlightQuote(m.content)}
                    >
                      <span className="font-semibold">{m.role}: </span>
                      {m.content.slice(0, 180)}
                    </button>
                  ))}
                </div>
                <input
                  className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
                  placeholder={t("quotePlaceholder")}
                  value={highlightQuote}
                  onChange={(e) => setHighlightQuote(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
                  placeholder={t("annotationNote")}
                  value={highlightNote}
                  onChange={(e) => setHighlightNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary h-9 px-3 text-xs"
                  onClick={addAnnotation}
                >
                  {t("addAnnotation")}
                </button>
                {annotations.length > 0 && (
                  <ul className="list-disc ps-5 text-xs">
                    {annotations.map((a, i) => (
                      <li key={`${a.quote}-${i}`}>
                        “{a.quote.slice(0, 80)}”
                        {a.note ? ` — ${a.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("evidence")}</legend>
                <div className="flex flex-wrap gap-2">
                  {!recording ? (
                    <button
                      type="button"
                      className="btn-secondary h-9 px-3 text-xs"
                      onClick={() => void startVoiceNote()}
                    >
                      {t("recordVoice")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary h-9 px-3 text-xs"
                      onClick={stopVoiceNote}
                    >
                      {t("stopVoice")}
                    </button>
                  )}
                  {audioBlob && (
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      {t("voiceReady")}
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs"
                />
              </fieldset>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                {t("anonymous")}
              </label>

              {error && (
                <p className="text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              {doneId && (
                <p className="text-sm text-green-800" role="status">
                  {t("submitOk", { id: doneId.slice(0, 8) })}
                </p>
              )}

              <div className="flex justify-end gap-2 pb-2">
                <button
                  type="button"
                  className="btn-secondary h-10 px-4 text-sm"
                  onClick={() => setOpen(false)}
                >
                  {t("close")}
                </button>
                <button
                  type="button"
                  className="btn-primary h-10 px-4 text-sm"
                  disabled={submitting || freeText.trim().length < 8}
                  onClick={() => void submit()}
                >
                  {submitting ? t("submitting") : t("submit")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
