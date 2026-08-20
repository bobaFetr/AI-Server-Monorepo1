using System.Net.Http.Json;
using System.Text.Json.Serialization;

public sealed class OllamaVisionModelClient(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<OllamaVisionModelClient> logger) : IVisionModelClient
{
    public async Task<string> DescribeAsync(
        ReadOnlyMemory<byte> image,
        string prompt,
        string mediaType,
        CancellationToken cancellationToken)
    {
        var model = configuration["Vision:Model"] ?? "gemma3:4b";
        var request = new OllamaRequest(
            model,
            false,
            [new OllamaMessage("user", prompt, [Convert.ToBase64String(image.Span)])]);

        logger.LogInformation("Sending vision request to model {Model} ({ImageBytes} bytes, {MediaType}).",
            model, image.Length, mediaType);
        using var response = await httpClient.PostAsJsonAsync("/api/chat", request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<OllamaResponse>(cancellationToken);
        var answer = result?.Message?.Content?.Trim();
        if (string.IsNullOrWhiteSpace(answer))
            throw new InvalidOperationException("The vision model returned an empty response.");
        return answer;
    }

    private sealed record OllamaRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("stream")] bool Stream,
        [property: JsonPropertyName("messages")] OllamaMessage[] Messages);

    private sealed record OllamaMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content,
        [property: JsonPropertyName("images")] string[] Images);

    private sealed record OllamaResponse(
        [property: JsonPropertyName("message")] OllamaResponseMessage? Message);

    private sealed record OllamaResponseMessage(
        [property: JsonPropertyName("content")] string? Content);
}
