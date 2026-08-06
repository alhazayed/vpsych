"use client";

import Image from "next/image";
import type { PatientBehaviorState } from "@/lib/therapy-room";

/**
 * Patient presence — always visible, nonverbal cues from PME bridge only.
 */
export function PatientPresence({
  name,
  portraitUrl,
  behavior,
  muted,
}: {
  name: string;
  portraitUrl: string | null;
  behavior: PatientBehaviorState;
  muted?: boolean;
}) {
  const cues = new Set(behavior.activeCues);
  const phase = behavior.phase;

  const cueClass = [
    "trm-patient",
    `trm-patient--${phase}`,
    `trm-patient--affect-${behavior.affect}`,
    cues.has("look_away") ? "trm-patient--look-away" : "",
    cues.has("eye_contact") ? "trm-patient--eye-contact" : "",
    cues.has("head_down") ? "trm-patient--head-down" : "",
    cues.has("cross_arms") ? "trm-patient--cross-arms" : "",
    cues.has("fidget") || cues.has("restlessness")
      ? "trm-patient--fidget"
      : "",
    cues.has("tears") ? "trm-patient--tears" : "",
    cues.has("laughter") ? "trm-patient--laughter" : "",
    cues.has("psychomotor_retardation") || cues.has("slow_movements")
      ? "trm-patient--slow"
      : "",
    cues.has("psychomotor_agitation") ? "trm-patient--agitated" : "",
    cues.has("sigh") ? "trm-patient--sigh" : "",
    muted ? "trm-patient--muted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cueClass}
      data-animation-hooks={behavior.animationHooks.join(" ")}
      data-affect={behavior.affect}
      data-phase={phase}
      role="img"
      aria-label={name}
    >
      <div className="trm-patient__chair" aria-hidden />
      <div className="trm-patient__body">
        <div className="trm-patient__portrait">
          {portraitUrl ? (
            <Image
              src={portraitUrl}
              alt=""
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 70vw, 320px"
            />
          ) : (
            <span className="trm-patient__initial">{name.slice(0, 1)}</span>
          )}
          <span className="trm-patient__breath" aria-hidden />
          {cues.has("tears") && (
            <span className="trm-patient__tear" aria-hidden />
          )}
        </div>
      </div>
      {/* Intentionally no speaking/listening chips, AI badges, or bubbles */}
    </div>
  );
}
