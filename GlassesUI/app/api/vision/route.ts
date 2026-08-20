import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const serverUrl = process.env.ARGUS_SERVER_URL;
  const apiKey = process.env.ARGUS_API_KEY;
  if (!serverUrl || !apiKey) return NextResponse.json({ title: "not_configured", detail: "Set ARGUS_SERVER_URL and ARGUS_API_KEY on the ARGUS UI server." }, { status: 503 });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) return NextResponse.json({ title: "invalid_form", detail: "A multipart image upload is required." }, { status: 415 });
  try {
    const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/v1/vision/analyze`, { method: "POST", headers: { "X-API-Key": apiKey, "Content-Type": contentType }, body: await request.arrayBuffer(), signal: AbortSignal.timeout(95_000) });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ title: "server_unavailable", detail: "The ARGUS vision server could not be reached." }, { status: 503 });
  }
}
