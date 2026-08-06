"use client";

import { useTranslations } from "next-intl";

type ControlId =
  | "pause"
  | "resume"
  | "notes"
  | "mute"
  | "repeat"
  | "settings"
  | "end"
  | "transcript";

export function FloatingControls({
  paused,
  muted,
  notesOpen,
  settingsOpen,
  transcriptOpen,
  ending,
  onAction,
}: {
  paused: boolean;
  muted: boolean;
  notesOpen: boolean;
  settingsOpen: boolean;
  transcriptOpen: boolean;
  ending?: boolean;
  onAction: (id: ControlId) => void;
}) {
  const t = useTranslations("therapyRoom.controls");

  const items: Array<{
    id: ControlId;
    icon: string;
    label: string;
    danger?: boolean;
    active?: boolean;
  }> = [
    {
      id: paused ? "resume" : "pause",
      icon: paused ? "play_arrow" : "pause",
      label: paused ? t("resume") : t("pause"),
      active: paused,
    },
    {
      id: "notes",
      icon: "edit_note",
      label: t("notes"),
      active: notesOpen,
    },
    {
      id: "mute",
      icon: muted ? "volume_off" : "volume_up",
      label: muted ? t("unmute") : t("mute"),
      active: muted,
    },
    {
      id: "repeat",
      icon: "replay",
      label: t("repeat"),
    },
    {
      id: "transcript",
      icon: "subtitles",
      label: t("transcript"),
      active: transcriptOpen,
    },
    {
      id: "settings",
      icon: "tune",
      label: t("settings"),
      active: settingsOpen,
    },
    {
      id: "end",
      icon: "call_end",
      label: ending ? t("ending") : t("end"),
      danger: true,
    },
  ];

  return (
    <nav className="trm-controls" aria-label={t("aria")}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`trm-controls__btn ${item.active ? "is-active" : ""} ${item.danger ? "is-danger" : ""}`}
          onClick={() => onAction(item.id)}
          disabled={ending && item.id === "end"}
          title={item.label}
          aria-label={item.label}
          aria-pressed={item.active}
        >
          <span className="material-symbols-outlined">{item.icon}</span>
        </button>
      ))}
    </nav>
  );
}
