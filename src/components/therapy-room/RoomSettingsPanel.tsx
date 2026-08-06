"use client";

import { useTranslations } from "next-intl";
import {
  allTherapyRoomThemeIds,
  resolveTherapyRoomTheme,
  type TherapyRoomSettings,
  type TherapyRoomThemeId,
} from "@/lib/therapy-room";

export function RoomSettingsPanel({
  open,
  settings,
  onChange,
  onClose,
}: {
  open: boolean;
  settings: TherapyRoomSettings;
  onChange: (next: TherapyRoomSettings) => void;
  onClose: () => void;
}) {
  const t = useTranslations("therapyRoom");
  if (!open) return null;

  return (
    <aside className="trm-settings" aria-label={t("settings.title")}>
      <header className="trm-settings__header">
        <h2>{t("settings.title")}</h2>
        <button type="button" onClick={onClose} aria-label={t("settings.close")}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <label className="trm-settings__field">
        <span>{t("settings.theme")}</span>
        <select
          value={settings.themeId}
          onChange={(e) =>
            onChange({
              ...settings,
              themeId: e.target.value as TherapyRoomThemeId,
            })
          }
        >
          {allTherapyRoomThemeIds().map((id) => (
            <option key={id} value={id}>
              {t(resolveTherapyRoomTheme(id).labelKey)}
            </option>
          ))}
        </select>
      </label>

      <label className="trm-settings__toggle">
        <input
          type="checkbox"
          checked={settings.showLiveTranscript}
          onChange={(e) =>
            onChange({ ...settings, showLiveTranscript: e.target.checked })
          }
        />
        <span>{t("settings.liveTranscript")}</span>
      </label>

      <label className="trm-settings__toggle">
        <input
          type="checkbox"
          checked={settings.showTimer}
          onChange={(e) =>
            onChange({ ...settings, showTimer: e.target.checked })
          }
        />
        <span>{t("settings.showTimer")}</span>
      </label>

      <label className="trm-settings__field">
        <span>{t("settings.timerMode")}</span>
        <select
          value={settings.timerMode}
          onChange={(e) =>
            onChange({
              ...settings,
              timerMode: e.target.value as "elapsed" | "remaining",
            })
          }
        >
          <option value="remaining">{t("settings.remaining")}</option>
          <option value="elapsed">{t("settings.elapsed")}</option>
        </select>
      </label>

      <label className="trm-settings__toggle">
        <input
          type="checkbox"
          checked={settings.ambienceEnabled}
          onChange={(e) =>
            onChange({ ...settings, ambienceEnabled: e.target.checked })
          }
        />
        <span>{t("settings.ambience")}</span>
      </label>
    </aside>
  );
}
