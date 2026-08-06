import type { TherapyRoomTheme, TherapyRoomThemeId } from "./types";

/**
 * Consultation-room themes. CSS vars drive the 2D scene;
 * 3D rooms should map the same theme ids onto materials/lighting.
 */
export const THERAPY_ROOM_THEMES: Record<TherapyRoomThemeId, TherapyRoomTheme> =
  {
    modern_clinic: {
      id: "modern_clinic",
      labelKey: "themes.modernClinic",
      defaultAmbience: "hvac",
      cssVars: {
        "--trm-wall": "#e8eef2",
        "--trm-wall-accent": "#d4dde4",
        "--trm-floor": "#c5b8a5",
        "--trm-floor-shadow": "#a89880",
        "--trm-wood": "#8b7355",
        "--trm-fabric": "#5a6b7a",
        "--trm-fabric-light": "#7a8b9a",
        "--trm-light": "rgba(255, 248, 235, 0.55)",
        "--trm-ambient": "#1a2430",
        "--trm-window": "#b8d4e8",
      },
    },
    academic_hospital: {
      id: "academic_hospital",
      labelKey: "themes.academicHospital",
      defaultAmbience: "hvac",
      cssVars: {
        "--trm-wall": "#f0f2f4",
        "--trm-wall-accent": "#dde3e8",
        "--trm-floor": "#9aa3ad",
        "--trm-floor-shadow": "#7a8490",
        "--trm-wood": "#6b7280",
        "--trm-fabric": "#4a5568",
        "--trm-fabric-light": "#718096",
        "--trm-light": "rgba(240, 245, 250, 0.5)",
        "--trm-ambient": "#1e293b",
        "--trm-window": "#cbd5e1",
      },
    },
    community_mental_health: {
      id: "community_mental_health",
      labelKey: "themes.communityMentalHealth",
      defaultAmbience: "clock",
      cssVars: {
        "--trm-wall": "#f5f0e8",
        "--trm-wall-accent": "#e8dfd0",
        "--trm-floor": "#b8a990",
        "--trm-floor-shadow": "#96876e",
        "--trm-wood": "#7a6548",
        "--trm-fabric": "#6b8f71",
        "--trm-fabric-light": "#8fad94",
        "--trm-light": "rgba(255, 250, 240, 0.5)",
        "--trm-ambient": "#2c3328",
        "--trm-window": "#c5d4b8",
      },
    },
    private_practice: {
      id: "private_practice",
      labelKey: "themes.privatePractice",
      defaultAmbience: "silence",
      cssVars: {
        "--trm-wall": "#f7f3ec",
        "--trm-wall-accent": "#ebe4d6",
        "--trm-floor": "#a89070",
        "--trm-floor-shadow": "#8a7458",
        "--trm-wood": "#6b5344",
        "--trm-fabric": "#8b6b5a",
        "--trm-fabric-light": "#a88878",
        "--trm-light": "rgba(255, 245, 230, 0.6)",
        "--trm-ambient": "#2a2218",
        "--trm-window": "#d4c4a8",
      },
    },
    child_psychiatry: {
      id: "child_psychiatry",
      labelKey: "themes.childPsychiatry",
      defaultAmbience: "silence",
      cssVars: {
        "--trm-wall": "#f0f5f2",
        "--trm-wall-accent": "#dce8e0",
        "--trm-floor": "#c4b8a0",
        "--trm-floor-shadow": "#a89880",
        "--trm-wood": "#8a7a60",
        "--trm-fabric": "#6a9e8a",
        "--trm-fabric-light": "#8abaa8",
        "--trm-light": "rgba(250, 255, 248, 0.55)",
        "--trm-ambient": "#1e2a24",
        "--trm-window": "#b8d8c8",
      },
    },
    emergency_psychiatry: {
      id: "emergency_psychiatry",
      labelKey: "themes.emergencyPsychiatry",
      defaultAmbience: "hvac",
      cssVars: {
        "--trm-wall": "#eef1f4",
        "--trm-wall-accent": "#d8dee5",
        "--trm-floor": "#8a9299",
        "--trm-floor-shadow": "#6a7279",
        "--trm-wood": "#5a6068",
        "--trm-fabric": "#4a5560",
        "--trm-fabric-light": "#6a7580",
        "--trm-light": "rgba(230, 235, 240, 0.45)",
        "--trm-ambient": "#121820",
        "--trm-window": "#a0a8b0",
      },
    },
  };

export const DEFAULT_THERAPY_ROOM_THEME: TherapyRoomThemeId = "modern_clinic";

export function resolveTherapyRoomTheme(
  id?: TherapyRoomThemeId | null,
): TherapyRoomTheme {
  if (id && THERAPY_ROOM_THEMES[id]) return THERAPY_ROOM_THEMES[id];
  return THERAPY_ROOM_THEMES[DEFAULT_THERAPY_ROOM_THEME];
}

export function allTherapyRoomThemeIds(): TherapyRoomThemeId[] {
  return Object.keys(THERAPY_ROOM_THEMES) as TherapyRoomThemeId[];
}
