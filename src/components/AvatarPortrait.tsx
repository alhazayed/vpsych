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
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-full bg-[var(--wash)] ring-1 ring-[var(--line)]">
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          className={`object-cover transition duration-500 ${
            speaking ? "scale-[1.03] brightness-110" : "scale-100"
          }`}
          priority
        />
      ) : (
        <div className="flex h-full items-center justify-center text-4xl text-[var(--muted)]">
          {name.slice(0, 1)}
        </div>
      )}
      <div
        className={`pointer-events-none absolute inset-0 rounded-full transition ${
          speaking
            ? "shadow-[inset_0_0_40px_rgba(15,118,110,0.35)]"
            : "shadow-none"
        }`}
      />
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {speaking ? "Speaking" : "Listening"}
      </p>
    </div>
  );
}
