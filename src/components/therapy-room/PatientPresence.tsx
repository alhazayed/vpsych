"use client";

import Image from "next/image";
import type { PatientBehaviorState } from "@/lib/therapy-room";

/**
 * Patient presence — always visible, nonverbal cues from PME + NBE only.
 * Animation classes are emotion-scheduled (never Math.random loops).
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
  const anim = new Set(behavior.animationClasses ?? []);

  const cueClass = [
    "trm-patient",
    `trm-patient--${phase}`,
    `trm-patient--affect-${behavior.affect}`,
    cues.has("look_away") || anim.has("trm-patient--look-away")
      ? "trm-patient--look-away"
      : "",
    cues.has("eye_contact") || anim.has("trm-patient--eye-contact")
      ? "trm-patient--eye-contact"
      : "",
    anim.has("trm-patient--eye-glance") ? "trm-patient--eye-glance" : "",
    cues.has("head_down") || anim.has("trm-patient--head-down")
      ? "trm-patient--head-down"
      : "",
    anim.has("trm-patient--head-nod") ? "trm-patient--head-nod" : "",
    anim.has("trm-patient--head-tilt") ? "trm-patient--head-tilt" : "",
    anim.has("trm-patient--head-shake") ? "trm-patient--head-shake" : "",
    cues.has("cross_arms") ? "trm-patient--cross-arms" : "",
    cues.has("fidget") ||
    cues.has("restlessness") ||
    anim.has("trm-patient--fidget")
      ? "trm-patient--fidget"
      : "",
    cues.has("tears") || anim.has("trm-patient--tears")
      ? "trm-patient--tears"
      : "",
    cues.has("laughter") ? "trm-patient--laughter" : "",
    cues.has("psychomotor_retardation") ||
    cues.has("slow_movements") ||
    anim.has("trm-patient--slow")
      ? "trm-patient--slow"
      : "",
    cues.has("psychomotor_agitation") ? "trm-patient--agitated" : "",
    cues.has("sigh") || anim.has("trm-patient--sigh")
      ? "trm-patient--sigh"
      : "",
    cues.has("blink") || anim.has("trm-patient--blink")
      ? "trm-patient--blink"
      : "",
    cues.has("smile") ||
    [...anim].some((c) => c.startsWith("trm-patient--smile-"))
      ? [...anim].find((c) => c.startsWith("trm-patient--smile-")) ??
        "trm-patient--smile-soft"
      : "",
    anim.has("trm-patient--hand-tremor") ? "trm-patient--hand-tremor" : "",
    anim.has("trm-patient--hand-soothe") ? "trm-patient--hand-soothe" : "",
    anim.has("trm-patient--hand-open") ? "trm-patient--hand-open" : "",
    anim.has("trm-patient--breath-shallow")
      ? "trm-patient--breath-shallow"
      : "",
    anim.has("trm-patient--breath-deep") ? "trm-patient--breath-deep" : "",
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
      data-nbe={behavior.animationClasses?.length ? "1" : "0"}
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
          {(cues.has("tears") || anim.has("trm-patient--tears")) && (
            <span className="trm-patient__tear" aria-hidden />
          )}
          <span className="trm-patient__hands" aria-hidden />
        </div>
      </div>
      {/* Intentionally no speaking/listening chips, AI badges, or bubbles */}
    </div>
  );
}
