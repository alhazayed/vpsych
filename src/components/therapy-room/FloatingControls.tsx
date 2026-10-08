"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type ControlId =
  | "interrupt"
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
  canInterrupt = false,
  onAction,
}: {
  paused: boolean;
  muted: boolean;
  notesOpen: boolean;
  settingsOpen: boolean;
  transcriptOpen: boolean;
  ending?: boolean;
  /** True while a patient clip is playing (or loading) and can be cut off. */
  canInterrupt?: boolean;
  onAction: (id: ControlId) => void;
}) {
  const t = useTranslations("therapyRoom.controls");
  const [moreOpen, setMoreOpen] = useState(false);

  const items: Array<{
    id: ControlId;
    icon: string;
    label: string;
    danger?: boolean;
    active?: boolean;
    /** Folded into the "More" menu on narrow screens. */
    secondary?: boolean;
  }> = [
    ...(canInterrupt
      ? [
          {
            id: "interrupt" as const,
            icon: "front_hand",
            label: t("interrupt"),
            active: true,
          },
        ]
      : []),
    {
      id: paused ? "resume" : "pause",
      icon: paused ? "play_arrow" : "pause",
      label: paused ? t("resume") : t("pause"),
      active: paused,
    },
    {
      id: "notes",
      secondary: true,
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
      secondary: true,
      icon: "replay",
      label: t("repeat"),
    },
    {
      id: "transcript",
      secondary: true,
      icon: "subtitles",
      label: t("transcript"),
      active: transcriptOpen,
    },
    {
      id: "settings",
      secondary: true,
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

  const secondary = items.filter((item) => item.secondary);
  const endIndex = items.findIndex((item) => item.id === "end");

  return (
    <nav className="trm-controls" aria-label={t("aria")}>
      {items.map((item, i) => (
        <span key={item.id} className="trm-controls__slot">
          {/* Phones: the More button sits just before End. */}
          {i === endIndex && (
            <button
              type="button"
              className={`trm-controls__btn trm-controls__more ${moreOpen ? "is-active" : ""}`}
              onClick={() => setMoreOpen((v) => !v)}
              title={t("more")}
              aria-label={t("more")}
              aria-expanded={moreOpen}
              aria-controls="trm-controls-more"
            >
              <span className="material-symbols-outlined">more_horiz</span>
            </button>
          )}
          <button
            type="button"
            className={`trm-controls__btn ${item.active ? "is-active" : ""} ${item.danger ? "is-danger" : ""} ${item.secondary ? "is-secondary" : ""}`}
            onClick={() => onAction(item.id)}
            disabled={ending && item.id === "end"}
            title={item.label}
            aria-label={item.label}
            aria-pressed={item.active}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
          </button>
        </span>
      ))}
      {moreOpen && (
        <div id="trm-controls-more" className="trm-controls__menu">
          {secondary.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`trm-controls__menu-item ${item.active ? "is-active" : ""}`}
              onClick={() => {
                setMoreOpen(false);
                onAction(item.id);
              }}
              aria-pressed={item.active}
            >
              <span className="material-symbols-outlined" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
