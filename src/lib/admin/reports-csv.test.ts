import { describe, expect, it } from "vitest";
import {
  REPORT_CSV_HEADER,
  buildReportsCsv,
  csvCell,
  reportToCsvRecord,
  type ReportExportRow,
} from "@/lib/admin/reports-csv";

function row(overrides: Partial<ReportExportRow> = {}): ReportExportRow {
  return {
    session_id: "11111111-1111-1111-1111-111111111111",
    created_at: "2026-10-04T10:00:00Z",
    language: "ar-JO",
    scores: {
      overall: 72,
      items: [
        { id: "empathy", label: "Empathy", score: 4, max: 5 },
        { id: "risk", label: "Risk assessment", score: 3, max: 5 },
      ],
    },
    sessions: {
      started_at: "2026-10-04T09:20:00Z",
      ended_at: "2026-10-04T09:58:00Z",
      status: "completed",
      profiles: { display_name: "سارة" },
      avatars: { name: "Layan", disorder: "Major depressive disorder" },
    },
    ...overrides,
  };
}

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas in user-controlled text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-2")).toBe("'-2");
  });

  it("renders empty values as empty cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("reportToCsvRecord", () => {
  it("maps a report to the header's column order", () => {
    const record = reportToCsvRecord(row());
    expect(record).toHaveLength(REPORT_CSV_HEADER.length);
    expect(record[5]).toBe("سارة");
    expect(record[9]).toBe("72");
    expect(record[10]).toBe("ai_examiner");
    expect(record[11]).toBe("Empathy: 4/5; Risk assessment: 3/5");
  });

  it("flags heuristic-fallback reports so instructors can filter them out", () => {
    const record = reportToCsvRecord(
      row({
        scores: {
          overall: 40,
          items: [],
          scientific_provenance: { assessment_mode: "heuristic_fallback" },
        },
      }),
    );
    expect(record[10]).toBe("heuristic_fallback");
  });

  it("tolerates a missing session join and malformed scores", () => {
    const record = reportToCsvRecord(row({ sessions: null, scores: null }));
    expect(record.slice(2, 8)).toEqual(["", "", "", "", "", ""]);
    expect(record[9]).toBe("");
    expect(record[11]).toBe("");
  });
});

describe("buildReportsCsv", () => {
  it("starts with a BOM and header and uses CRLF line endings", () => {
    const csv = buildReportsCsv([row(), row()]);
    expect(csv.startsWith("﻿session_id,report_created_at,")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(4);
  });

  it("produces only the header for an empty export", () => {
    expect(buildReportsCsv([])).toBe(`﻿${REPORT_CSV_HEADER.join(",")}\r\n`);
  });
});
