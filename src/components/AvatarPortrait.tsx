"use client";

import Image from "next/image";

export function AvatarPortrait({
  name,
  src,
  speaking,
}: {
  name: string;
  src: string | null;
  speaking: boolean;
}) {
  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[18rem] items-center justify-center">
      <div className="absolute -z-10 h-[120%] w-[120%] rounded-full bg-gradient-to-b from-[color-mix(in_srgb,var(--primary)_8%,transparent)] via-[var(--background)] to-[var(--background)] opacity-60 blur-3xl" />
      <div
        className={`relative h-full w-full overflow-hidden rounded-full border-4 border-[color-mix(in_srgb,var(--primary)_12%,transparent)] bg-[var(--surface-container-lowest)] shadow-2xl transition duration-500 ${
          speaking ? "scale-[1.02]" : "scale-100"
        }`}
      >
        {src ? (
          <Image
            src={src}
            alt={name}
            fill
            className={`object-cover transition duration-500 ${
              speaking ? "brightness-110" : "brightness-100"
            }`}
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center font-[family-name:var(--font-headline)] text-5xl font-bold text-[var(--primary)]">
            {name.slice(0, 1)}
          </div>
        )}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_85%,transparent)] px-3 py-1 backdrop-blur-sm">
          <span className="material-symbols-outlined text-[14px] text-white">
            {speaking ? "record_voice_over" : "hearing"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">
            {speaking ? "Speaking" : "Listening"}
          </span>
        </div>
      </div>
    </div>
  );
}
