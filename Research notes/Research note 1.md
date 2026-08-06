Схема
Първо ше тествам python client кода на машината преди да го прехвърля на 
raswberry pie.
The server back end must support comunication models like:
1.Kestrel
2. Websockets
3. SignalR
4. gRpc
Лаптоп с Python ───────────────┐
                              │ HTTP API + JSON
Raspberry Pi с Python ─────────┼────────► Ubuntu Server
                              │           C# / ASP.NET Core
Телефонни известия ◄───────────┘
