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