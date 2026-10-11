using System.Diagnostics;

public static class VisionEndpoints
{
    public static IEndpointRouteBuilder MapVisionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/v1/vision/analyze", AnalyzeAsync)
            .WithMetadata(new ApiKeyProtectedAttribute())
            .RequireRateLimiting("api")
            .DisableAntiforgery();
        return endpoints;
    }

    private static async Task<IResult> AnalyzeAsync(
        HttpRequest request,
        IVisionModelClient visionModel,
        VisionInferenceGate inferenceGate,
        IConfiguration configuration,
        ILogger<Program> logger,
        CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
            return Problem("content_type", "Use multipart/form-data with image and prompt fields.", 415);

        IFormCollection form;
        try { form = await request.ReadFormAsync(cancellationToken); }
        catch (InvalidDataException) { return Problem("invalid_form", "The multipart form is invalid or too large.", 413); }

        var image = form.Files.GetFile("image");
        var prompt = form["prompt"].ToString().Trim();
        var requestId = form["requestId"].ToString().Trim();
        if (image is null || image.Length == 0) return Problem("image_required", "An image is required.", 400);
        if (string.IsNullOrWhiteSpace(prompt)) prompt = "Describe the scene and identify the object at the center.";
        if (prompt.Length > 1000) return Problem("prompt_too_long", "Prompt must not exceed 1000 characters.", 400);
        if (string.IsNullOrWhiteSpace(requestId)) requestId = Guid.NewGuid().ToString();
        if (!Guid.TryParse(requestId, out _)) return Problem("invalid_request_id", "requestId must be a UUID.", 400);

        var maxBytes = configuration.GetValue("Vision:MaxImageBytes", 5 * 1024 * 1024);
        if (image.Length > maxBytes) return Problem("image_too_large", $"Image must not exceed {maxBytes} bytes.", 413);

        byte[] bytes;
        await using (var stream = image.OpenReadStream())
        {
            using var memory = new MemoryStream((int)image.Length);
            await stream.CopyToAsync(memory, cancellationToken);
            bytes = memory.ToArray();
        }
        var maxWidth = configuration.GetValue("Vision:MaxWidth", 1920);
        var maxHeight = configuration.GetValue("Vision:MaxHeight", 1080);
        if (!ImageValidation.TryDecodeAndSanitize(bytes, maxWidth, maxHeight, out var validated, out var validationError))
            return Problem("invalid_image", validationError, 415);

        if (!inferenceGate.TryEnter(out var inferenceLease))
        {
            request.HttpContext.Response.Headers.RetryAfter = "2";
            return Problem("inference_busy", "The vision model is busy. Try again shortly.", 503);
        }
        using (inferenceLease)
        {

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var answer = await visionModel.DescribeAsync(validated!.Bytes, prompt, validated.MediaType, cancellationToken);
            stopwatch.Stop();
            return Results.Ok(new VisionResponse(requestId, answer,
                configuration["Vision:Model"] ?? "gemma3:4b", stopwatch.ElapsedMilliseconds, DateTimeOffset.UtcNow));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { return Results.StatusCode(499); }
        catch (OperationCanceledException exception)
        {
            logger.LogWarning(exception, "Vision model request {RequestId} timed out.", requestId);
            return Problem("model_timeout", "The local vision model timed out.", 504);
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Vision model request {RequestId} failed.", requestId);
            return Problem("model_unavailable", "The local vision model is unavailable.", 503);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Vision request {RequestId} failed.", requestId);
            return Problem("inference_failed", "Vision inference failed.", 500);
        }
        }
    }

    private static IResult Problem(string code, string detail, int status) =>
        Results.Problem(title: code, detail: detail, statusCode: status);
}
