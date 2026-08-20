using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = false);
builder.Services.Configure<FormOptions>(options =>
    options.MultipartBodyLengthLimit = builder.Configuration.GetValue("Vision:MaxRequestBytes", 5_300_000));
builder.WebHost.ConfigureKestrel(options =>
    options.Limits.MaxRequestBodySize = builder.Configuration.GetValue("Vision:MaxRequestBytes", 5_300_000));
builder.Services.AddSingleton<VisionInferenceGate>();
builder.Services.AddHttpClient<IVisionModelClient, OllamaVisionModelClient>((services, client) =>
{
    var configuration = services.GetRequiredService<IConfiguration>();
    client.BaseAddress = new Uri(configuration["Vision:OllamaUrl"] ?? "http://127.0.0.1:11434");
    client.Timeout = TimeSpan.FromSeconds(configuration.GetValue("Vision:TimeoutSeconds", 90));
});

builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter =
                Math.Ceiling(retryAfter.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);

        await context.HttpContext.Response.WriteAsJsonAsync(
            new ServerMessage("Too many requests. Try again later."),
            cancellationToken);
    };

    options.AddPolicy("api", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("power", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseRouting();
app.UseRateLimiter();
app.UseMiddleware<ApiKeyAuthenticationMiddleware>();
app.MapMessageEndpoints();
app.MapInfrastructureEndpoints();
app.MapVisionEndpoints();
app.Run();
