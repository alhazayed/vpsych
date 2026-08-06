import { requireAdmin } from "@/lib/auth";
import { isHandsFreeTherapyEnabled } from "@/lib/conversation";
import Link from "next/link";

export default async function AdminHftePage() {
  const { supabase } = await requireAdmin();

  if (!isHandsFreeTherapyEnabled()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--primary)]">
          Hands-Free Therapy Engine
        </h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          Set <code>ENABLE_HANDS_FREE_THERAPY=true</code> to enable HFTE metrics.
        </p>
        <Link href="/admin/reports" className="mt-6 inline-block text-sm underline">
          Back to reports
        </Link>
      </div>
    );
  }

  const { data } = await supabase
    .from("hfte_session_metrics")
    .select(
      "session_id, interruption_count, pause_count, speech_duration_ms, thinking_latency_ms, turn_count, vad_confidence_avg, network_disconnect_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];
  const n = rows.length || 1;
  const avgInterruptions =
    rows.reduce((s, r) => s + (r.interruption_count ?? 0), 0) / n;
  const avgLatency =
    rows.reduce((s, r) => s + (r.thinking_latency_ms ?? 0), 0) / n;
  const avgSpeech =
    rows.reduce((s, r) => s + (r.speech_duration_ms ?? 0), 0) / n;
  const avgPause = rows.reduce((s, r) => s + (r.pause_count ?? 0), 0) / n;
  const avgVad =
    rows.reduce((s, r) => s + (Number(r.vad_confidence_avg) || 0), 0) / n;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[var(--primary)]">
        HFTE conversation metrics
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        Aggregate UX metrics only — no raw audio or recordings are stored.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Avg interruptions" value={avgInterruptions.toFixed(2)} />
        <Stat label="Avg latency (ms)" value={Math.round(avgLatency).toString()} />
        <Stat label="Avg speech (ms)" value={Math.round(avgSpeech).toString()} />
        <Stat label="Avg pauses" value={avgPause.toFixed(2)} />
        <Stat label="Avg VAD confidence" value={avgVad.toFixed(2)} />
      </div>

      <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--outline-variant)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-[var(--outline)]">
            <tr>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Turns</th>
              <th className="px-3 py-2">Interruptions</th>
              <th className="px-3 py-2">Pauses</th>
              <th className="px-3 py-2">Speech ms</th>
              <th className="px-3 py-2">Latency ms</th>
              <th className="px-3 py-2">VAD</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[var(--on-surface-variant)]" colSpan={7}>
                  No HFTE sessions yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.session_id}
                  className="border-t border-[var(--outline-variant)]"
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/admin/reports/${r.session_id}`}
                      className="underline"
                    >
                      {String(r.session_id).slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.turn_count}</td>
                  <td className="px-3 py-2">{r.interruption_count}</td>
                  <td className="px-3 py-2">{r.pause_count}</td>
                  <td className="px-3 py-2">{r.speech_duration_ms}</td>
                  <td className="px-3 py-2">{r.thinking_latency_ms}</td>
                  <td className="px-3 py-2">
                    {Number(r.vad_confidence_avg).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--outline)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--on-surface)]">
        {value}
      </p>
    </div>
  );
}
