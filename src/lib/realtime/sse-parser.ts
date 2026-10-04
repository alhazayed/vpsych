/**
 * Incremental Server-Sent Events parser (WHATWG event-stream framing).
 *
 * Handles chunks split anywhere (mid-line, mid-CRLF, mid-UTF-8 handled by the
 * caller's TextDecoder in stream mode), CRLF / CR / LF line endings, comment
 * lines, multi-line `data:` fields, and the optional single space after the
 * colon. Pure; no DOM dependency.
 */

export type SseMessage = { event: string; data: string; id?: string };

export type SseParser = {
  /** Feed decoded text; returns every message completed by this chunk. */
  push: (chunk: string) => SseMessage[];
  /** End of stream: a trailing message without a blank line is discarded (per spec). */
  end: () => void;
};

export function createSseParser(): SseParser {
  let buffer = "";
  let event = "";
  let data: string[] = [];
  let id: string | undefined;
  let sawCrAtEnd = false;

  const dispatch = (out: SseMessage[]) => {
    if (data.length > 0) {
      out.push({ event: event || "message", data: data.join("\n"), id });
    }
    event = "";
    data = [];
  };

  const processLine = (line: string, out: SseMessage[]) => {
    if (line === "") {
      dispatch(out);
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "event":
        event = value;
        break;
      case "data":
        data.push(value);
        break;
      case "id":
        if (!value.includes("\u0000")) id = value;
        break;
      default:
        break;
    }
  };

  return {
    push(chunk) {
      const out: SseMessage[] = [];
      if (!chunk) return out;
      // A CR ending the previous chunk may be the first half of a CRLF.
      if (sawCrAtEnd && chunk.startsWith("\n")) chunk = chunk.slice(1);
      sawCrAtEnd = false;
      buffer += chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i];
        if (c !== "\n" && c !== "\r") continue;
        processLine(buffer.slice(start, i), out);
        if (c === "\r") {
          if (i + 1 < buffer.length) {
            if (buffer[i + 1] === "\n") i++;
          } else {
            sawCrAtEnd = true;
          }
        }
        start = i + 1;
      }
      buffer = buffer.slice(start);
      return out;
    },
    end() {
      buffer = "";
      event = "";
      data = [];
    },
  };
}
