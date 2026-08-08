Схема
Първо ше тествам python client кода на машината преди да го прехвърля на 
raswberry pie.
The server back end must support comunication models like:
1.Kestrel
2. Websockets
3. SignalR
4. gRpc
Ще ми трябва MQTT с цел двупосочна комуникация между системите.
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

1. The ubuntu server does will not need GUI
- Vscode on laptop
- Install Remote - SSH
- connect to the physical ubuntu server
- Edit the files on the server like they are local
- На Ubuntu
- sudo apt update
sudo apt install openssh-server
sudo systemctl enable --now ssh
- Проверка на ip адреса: hostname -I
- после от dev машината: ssh твоят_потребител@192.168.1.50
2. Да се направи постоянен локален ip  адрес на Ubuntu машината
 - В настройките на рутера да направя DHCP reservation за MAC адреса на убунту машината
 - За начинаещи не(другия вариант е да се използва статичен адрес чрез NetPlan)
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
4. Порта трябва да бъде отворен само за локалната мрежа.
 - sudo ufw allow OpenSSH
sudo ufw allow proto tcp from 192.168.1.0/24 to any port 5000
sudo ufw enable
sudo ufw status
- Това ще разреши порт 5000 да се ползва от локалната мрежа
4. Тестване на връзката 