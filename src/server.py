import redis.asyncio as aioredis
from src.utils import *

class Server:
    def __init__(self) -> None:
        self.redis_client = aioredis.Redis(decode_responses=True)

    async def write_to_queue(self, message: str):
        await self.redis_client.rpush("messages", message)

    async def add_client(self, client_name: str):
        await self.redis_client.sadd("clients", client_name)
    
    async def rem_client(self, client_name: str):
        await self.redis_client.srem("clients", client_name)

    async def client_connected(self, client_name: str):
        return await self.redis_client.sismember("clients", client_name)

    async def send_message(self, operation: str, uuid: str, source: str, target: str, message: str):
        if await self.client_connected(source) and await self.client_connected(target):
            timestamp = str(datetime.now())
            await self.redis_client.publish(
                f"{target}:message_channel", 
                f"{operation}~{uuid}={source}@{timestamp}//{message}")
            await self.write_to_queue(
                f"{uuid}={source}->{target}@{timestamp}//{message}")