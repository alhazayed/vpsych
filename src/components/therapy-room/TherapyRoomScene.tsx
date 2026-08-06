"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  resolveTherapyRoomTheme,
  type TherapyRoomThemeId,
} from "@/lib/therapy-room";

/**
 * First-person consultation room backdrop.
 * Architecture is theme-id driven so a future 3D renderer can replace this
 * without changing TherapyRoomSession.
 */
export function TherapyRoomScene({
  themeId,
  children,
  className = "",
}: {
  themeId: TherapyRoomThemeId;
  children: ReactNode;
  className?: string;
}) {
  const theme = resolveTherapyRoomTheme(themeId);
  const style = theme.cssVars as CSSProperties;

  return (
    <div
      className={`trm-scene ${className}`}
      style={style}
      data-trm-theme={theme.id}
      data-trm-renderer="css2d"
    >
      <div className="trm-scene__sky" aria-hidden />
      <div className="trm-scene__window" aria-hidden />
      <div className="trm-scene__wall" aria-hidden />
      <div className="trm-scene__floor" aria-hidden />
      <div className="trm-scene__light" aria-hidden />
      <div className="trm-scene__desk" aria-hidden />
      <div className="trm-scene__content">{children}</div>
    </div>
  );
}
