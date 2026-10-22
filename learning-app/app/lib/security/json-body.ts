export class JsonBodyError extends Error {
  constructor(public readonly status: 400 | 413 | 415) {
    super(status === 413 ? "Request body is too large" : status === 415 ? "JSON content required" : "Invalid JSON body");
  }
}

export async function readBoundedJsonObject(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const parsed = await readBoundedJson(request, maxBytes);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new JsonBodyError(400);
  return parsed as Record<string, unknown>;
}

// Bound actual streamed bytes as well as Content-Length: a missing or forged
// header must not turn a small public form into an unbounded JSON allocation.
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid JSON body limit");
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new JsonBodyError(415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new JsonBodyError(400);
  if (length !== null && Number(length) > maxBytes) throw new JsonBodyError(413);
  if (!request.body) throw new JsonBodyError(400);

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new JsonBodyError(413);
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    // Do not wait for an upstream sender to finish after rejecting its body.
    void reader.cancel().catch(() => undefined);
    throw error instanceof JsonBodyError ? error : new JsonBodyError(400);
  } finally {
    reader.releaseLock();
  }
}
