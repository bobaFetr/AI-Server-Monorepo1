import { NextResponse } from "next/server";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 5_300_000;

async function readLimitedBody(request: Request) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function POST(request: Request) {
  const serverUrl = process.env.ARGUS_SERVER_URL;
  const apiKey = process.env.ARGUS_API_KEY;
  if (!serverUrl || !apiKey) return NextResponse.json({ title: "not_configured", detail: "Set ARGUS_SERVER_URL and ARGUS_API_KEY on the ARGUS UI server." }, { status: 503 });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) return NextResponse.json({ title: "invalid_form", detail: "A multipart image upload is required." }, { status: 415 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return NextResponse.json({ title: "image_too_large", detail: "Image must not exceed 5 MB." }, { status: 413 });
  try {
    const body = await readLimitedBody(request);
    if (!body) return NextResponse.json({ title: "image_too_large", detail: "Image must not exceed 5 MB." }, { status: 413 });
    const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/v1/vision/analyze`, { method: "POST", headers: { "X-API-Key": apiKey, "Content-Type": contentType }, body, signal: AbortSignal.timeout(95_000) });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ title: "server_unavailable", detail: "The ARGUS vision server could not be reached." }, { status: 503 });
  }
}
