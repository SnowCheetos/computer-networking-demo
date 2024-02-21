import asyncio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket, WebSocketState, WebSocketDisconnect
from src.server import Server, make_log_message, get_timestamp

app = FastAPI()
server = Server()
ssl_key = "fb1c6285e40ae416300b35d2d2c400e45306b81ed3e9ab3c9297a7c688c6edf8"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"])

app.mount(
    "/static", 
    StaticFiles(directory="./static"), 
    name="static")

@app.get("/")
async def home():
    return FileResponse("./static/index.html")

@app.get("/client/init/{client_name}")
async def init_client(client_name: str):
    if await server.redis_client.sismember("clients", client_name):
        return Response(status_code=400, content="Client name already registered")
    await server.add_client(client_name)
    return Response(status_code=200)

async def ws_handler(ws: WebSocket, s: Server, name: str):
    while ws.client_state != WebSocketState.DISCONNECTED:
        data = await ws.receive_json()
        await s.send_message(data["operation"], data["uuid"], name, data["to"], data["message"], data.get("https"))

async def ps_handler(ws: WebSocket, s: Server, name: str):
    message_channel = s.redis_client.pubsub()
    await message_channel.subscribe(f"{name}:message_channel")
    
    while ws.client_state != WebSocketState.DISCONNECTED:
        message = await message_channel.get_message(ignore_subscribe_messages=True, timeout=0.1)
        if message:
            operation, data = message["data"].split("~")
            if operation == "udp":
                source, data_ = message["data"].split("//")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "udp",
                    "uuid": uuid.split("~")[1],
                    "timestamp": timestamp,
                    "from": origin,
                    "message": (data_.split("[BEG]")[1]).split("[END]")[0]
                }
                await ws.send_json(payload)

            elif operation == "tcp":
                if "[BEG]" in message["data"]:
                    source, data = message["data"].split("[BEG]")
                    uuid, meta = source.split("=")
                    origin, timestamp = meta.split("@")
                    data = data[:-5]
                else:
                    source, data = message["data"][:-5].split("[CON]")
                    uuid, meta = source.split("=")
                    origin, timestamp = meta.split("@")
                payload = {
                    "type": "tcp",
                    "uuid": uuid.split("~")[1],
                    "timestamp": timestamp.split("//")[0],
                    "from": origin,
                    "message": data.lower()
                }
                await ws.send_json(payload)

            elif operation == "get":
                source, data_ = message["data"].split("//")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "get",
                    "uuid": uuid.split("~")[1],
                    "https": False,
                    "timestamp": timestamp,
                    "from": origin,
                    "message": (data_.split("[BEG]")[1]).split("[REQ]")[0].lower()
                }
                await ws.send_json(payload)

            elif operation == "gets":
                source, data_ = message["data"].split("//")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "get",
                    "uuid": uuid.split("~")[1],
                    "https": True,
                    "timestamp": timestamp,
                    "from": origin,
                    "message": (data_.split("[BEG]")[1]).split("[REQ]")[0]
                }
                await ws.send_json(payload)

            elif operation == "post":
                source, data_ = message["data"].split("//")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "post",
                    "uuid": uuid.split("~")[1],
                    "timestamp": timestamp,
                    "from": origin,
                    "message": (data_.split("[BEG]")[1]).split("[REQ]")[0]
                }
                await ws.send_json(payload)
            
            elif operation == "posts":
                source, data_ = message["data"].split("//")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "post",
                    "uuid": uuid.split("~")[1],
                    "https": True,
                    "timestamp": timestamp,
                    "from": origin,
                    "message": (data_.split("[BEG]")[1]).split("[REQ]")[0]
                }
                await ws.send_json(payload)

            elif operation == "response":
                source, data_ = message["data"].split("//")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "response",
                    "uuid": uuid.split("~")[1],
                    "timestamp": timestamp,
                    "from": origin,
                    "message": (data_.split("[RES]")[1]).split("[END]")[0]
                }
                await ws.send_json(payload)
            
            elif operation == "responses":
                source, data_ = message["data"].split("//")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "response",
                    "uuid": uuid.split("~")[1],
                    "https": True,
                    "timestamp": timestamp,
                    "from": origin,
                    "message": (data_.split("[RES]")[1]).split("[END]")[0]
                }
                await ws.send_json(payload)

    await message_channel.aclose()

@app.websocket("/connect/{client_name}")
async def connection_handler(websocket: WebSocket, client_name: str):
    ws_handler_task, ps_handler_task = None, None

    try:
        await websocket.accept()
        await server.write_to_queue(make_log_message(
            get_timestamp(), 
            f'<div class="name-tag">{client_name}</div><div>just joined!</div>'))
        ws_handler_task = asyncio.create_task(ws_handler(websocket, server, client_name))
        ps_handler_task = asyncio.create_task(ps_handler(websocket, server, client_name))
        await asyncio.gather(ws_handler_task, ps_handler_task)

    except WebSocketDisconnect as e:
        print(str(e))

    except Exception as e:
        print(str(e))

    finally:
        for task in (ws_handler_task, ps_handler_task):
            if task: task.cancel()
        if websocket.client_state != WebSocketState.DISCONNECTED: 
            await websocket.close()
        await server.rem_client(client_name)
        await server.write_to_queue(make_log_message(
            get_timestamp(), 
            f'<div class="name-tag">{client_name}</div><div>just left!</div>'))

@app.websocket("/global_data")
async def global_data_stream(websocket: WebSocket):
    try:
        await websocket.accept()
        while websocket.client_state != WebSocketState.DISCONNECTED:
            data = {
                "clients": list(await server.redis_client.smembers("clients")),
                "global_logs": await server.redis_client.lrange("messages", -50, -1)
            }
            await websocket.send_json(data)
            await asyncio.sleep(1)

    except WebSocketDisconnect as e:
        pass

    except Exception as e:
        pass

    finally:
        if websocket.client_state != WebSocketState.DISCONNECTED: 
            await websocket.close()