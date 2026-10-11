public sealed record ClientMessage(string? Message);

public sealed record ServerMessage(string Message);

public sealed record VisionResponse(
    string RequestId,
    string Answer,
    string Model,
    long LatencyMs,
    DateTimeOffset CompletedAtUtc);
