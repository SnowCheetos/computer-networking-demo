import redis.asyncio as aioredis
from hashlib import sha256
from src.utils import *

class Server:
    def __init__(self) -> None:
        self.redis_client = aioredis.Redis(decode_responses=True)
        self.admin_hash = "961e187b04f4c1d6c087401cdfb2b11414a3e91a780fd51b599ba31ea5ea09a3"

    async def is_admin(self, client_name: str) -> bool:
        return sha256(client_name.lower().encode()).hexdigest() == self.admin_hash

    async def write_to_queue(self, message: str):
        await self.redis_client.rpush("messages", message)

    async def add_client(self, client_name: str):
        await self.redis_client.sadd("clients", client_name)
    
    async def rem_client(self, client_name: str):
        await self.redis_client.srem("clients", client_name)

    async def client_connected(self, client_name: str):
        return await self.redis_client.sismember("clients", client_name)

    async def send_message(self, operation: str, uuid: str, source: str, target: str, message: str, https: bool):
        if https: operation += "s"
        if await self.client_connected(source) and await self.client_connected(target):
            timestamp = get_timestamp()
            await self.redis_client.publish(
                f"{target}:message_channel", 
                f"{operation}~{uuid}={source}@{timestamp}//{message}")
            
            if operation == "udp":
                await self.write_to_queue(make_udp_message(timestamp, source, target, message))
            elif operation == "tcp":
                await self.write_to_queue(make_tcp_message(timestamp, source, target, message))
            elif operation == "get" or operation == "gets":
                await self.write_to_queue(make_get_message(timestamp, source, target, message))
            elif operation == "post" or operation == "posts":
                await self.write_to_queue(make_post_message(timestamp, source, target, message))
            elif operation == "response" or operation == "responses":
                await self.write_to_queue(make_http_message(timestamp, source, target, message))
            elif operation == "ws":
                await self.write_to_queue(make_ws_message(timestamp, source, target, message))
            else:
                await self.write_to_queue(
                    f"{uuid}={source}->{target}@{timestamp}//{message}")