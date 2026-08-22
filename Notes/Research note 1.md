# Early research notes

> [!note] Consolidated design
> This is the original exploration. The current architecture and recommendations are in [[AI glasses server architecture]].

## Първоначална схема

Първо ще тествам Python client кода на лаптопа, преди да го прехвърля на Raspberry Pi.

ASP.NET Core сървърът може да използва:

1. Kestrel като HTTP application server;
2. HTTPS/REST за заявки и отговори;
3. SignalR (обикновено върху WebSockets, с fallback transports) за server push;
4. gRPC само за бъдеща комуникация между вътрешни услуги, ако има реална нужда.

MQTT не е задължителен за първата версия. REST + SignalR покриват текущите нужди; MQTT може да се добави по-късно при много устройства или IoT telemetry.
Друг е въпроса с:
 - обработката на прекъсната връзка
 - time out при заявки
 - логове
 - автоматично рестартиране
 - стабилен ip адрес
 - удостоверяване
 - автентикация

Лаптоп с Python ───────────────┐
                              │ HTTP API + JSON
Raspberry Pi с Python ─────────┼────────► Ubuntu Server
                              │           C# / ASP.NET Core
Телефонни известия ◄───────────┘
- The first python program must be a console app with some basic commands

## Ubuntu server setup

1. Ubuntu Server няма нужда от графична среда.
   - Използвай VS Code + Remote SSH на лаптопа.
   - На Ubuntu:

```bash
sudo apt update
sudo apt install openssh-server
sudo systemctl enable --now ssh
hostname -I
```

   - От development машината: `ssh твоят_потребител@192.168.1.50`

2. Да се направи постоянен локален IP адрес на Ubuntu машината.
 - В настройките на рутера да направя DHCP reservation за MAC адреса на убунту машината
 - По-сложният вариант е статичен адрес чрез Netplan; не е необходим, ако router reservation работи.

3. C# API на Ubuntu
  - dotnet new web -n AiServer
cd AiServer
- var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var expectedApiKey =
    Environment.GetEnvironmentVariable("AI_SERVER_API_KEY")
    ?? throw new InvalidOperationException(
        "Environment variable AI_SERVER_API_KEY is missing.");

app.MapGet("/api/health", () =>
{
    return Results.Ok(new
    {
        status = "ok",
        serverTimeUtc = DateTimeOffset.UtcNow
    });
});

app.MapPost(
    "/api/telemetry",
    IResult (TelemetryMessage message, HttpRequest request) =>
    {
        var receivedApiKey =
            request.Headers["X-Api-Key"].ToString();

        if (!string.Equals(
                receivedApiKey,
                expectedApiKey,
                StringComparison.Ordinal))
        {
            return Results.Unauthorized();
        }

        Console.WriteLine(
            $"Device: {message.DeviceId}, " +
            $"Value: {message.Value} {message.Unit}");

        return Results.Ok(new
        {
            accepted = true,
            receivedAtUtc = DateTimeOffset.UtcNow
        });
    });

app.Run();

record TelemetryMessage(
    string DeviceId,
    double Value,
    string Unit);

- Временен API ключ - export AI_SERVER_API_KEY="смени-това-с-дълъг-случаен-ключ"
- стартиране на сървъра
- автентикация с парола, когато се свързвам към сървъра
- Първоначално кода на Ubuntu ще трябва да връща записани съобщения. Например:
- Ai забремени онзи мъж -----> Не мога, защото не съм човек
4. Портът трябва да бъде отворен само за локалната мрежа.
 - sudo ufw allow OpenSSH
sudo ufw allow proto tcp from 192.168.1.0/24 to any port 5000
sudo ufw enable
sudo ufw status
- Това ще разреши порт 5000 да се ползва от локалната мрежа
4. Тестване на връзката
