import asyncio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket, WebSocketState, WebSocketDisconnect
from src.server import Server

app = FastAPI()
server = Server()

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
        if data["operation"] == "message":
            await s.send_message(data["uuid"], name, data["to"], data["message"])

async def ps_handler(ws: WebSocket, s: Server, name: str):
    message_channel = s.redis_client.pubsub()
    await message_channel.subscribe(f"{name}:message_channel")
    
    while ws.client_state != WebSocketState.DISCONNECTED:
        message = await message_channel.get_message(ignore_subscribe_messages=True, timeout=0.1)
        if message:
            if "[BEG]" in message["data"] and "[END]" in message["data"]:
                # Both begin and end present in message, assuming to be udp
                source, data = message["data"].split("[BEG]")
                uuid, meta = source.split("=")
                origin, timestamp = meta.split("@")
                payload = {
                    "type": "udp",
                    "uuid": uuid,
                    "timestamp": timestamp,
                    "from": origin,
                    "message": data.split("[END]")[0]
                }
                await ws.send_json(payload)

            elif "[CON]" in message["data"]:
                # Continuation flag present, assuming to be TCP
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
                    "uuid": uuid,
                    "timestamp": timestamp,
                    "from": origin,
                    "message": data
                }
                await ws.send_json(payload)

    await message_channel.aclose()

@app.websocket("/connect/{client_name}")
async def connection_handler(websocket: WebSocket, client_name: str):
    ws_handler_task, ps_handler_task = None, None

    try:
        await websocket.accept()
        await server.write_to_queue(f"{client_name} just joined!")
        ws_handler_task = asyncio.create_task(ws_handler(websocket, server, client_name))
        ps_handler_task = asyncio.create_task(ps_handler(websocket, server, client_name))
        await asyncio.gather(ws_handler_task, ps_handler_task)

    except WebSocketDisconnect as e:
        pass

    except Exception as e:
        pass

    finally:
        for task in (ws_handler_task, ps_handler_task):
            if task: task.cancel()
        if websocket.client_state != WebSocketState.DISCONNECTED: 
            await websocket.close()
        await server.rem_client(client_name)
        await server.write_to_queue(f"{client_name} just left!")

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