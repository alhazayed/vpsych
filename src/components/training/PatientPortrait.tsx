import Image from "next/image";

export function PatientPortrait({
  name,
  portraitUrl,
  size = 64,
}: {
  name: string;
  portraitUrl: string | null;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-[var(--surface-container)]"
      style={{ width: size, height: size }}
    >
      {portraitUrl ? (
        <Image src={portraitUrl} alt={name} fill className="object-cover object-top" />
      ) : (
        <span className="flex h-full items-center justify-center text-2xl font-bold text-[var(--primary)]">
          {name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}
