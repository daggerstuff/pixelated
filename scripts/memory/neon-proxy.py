#!/usr/bin/env python3
"""Local TCP proxy: localhost:15432 → WebSocket → Cloudflare Worker → Neon:5432

Bridges PostgreSQL wire protocol through a Cloudflare Worker WebSocket tunnel
to bypass a blocked port 5432.
"""

import asyncio
import logging
import os
import signal
import sys

import websockets

WORKER_URL = os.environ.get(
    "NEON_PROXY_WORKER_URL",
    "wss://neon.pixelthis.app",
)
LISTEN_HOST = os.environ.get("NEON_PROXY_LISTEN_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("NEON_PROXY_LISTEN_PORT", "15432"))
CHUNK = 65536

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("neon-proxy")


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    peer = writer.get_extra_info("peername")
    log.info("connection from %s", peer)
    try:
        async with websockets.connect(
            WORKER_URL,
            max_size=2**24,
            ping_interval=30,
            ping_timeout=120,
        ) as ws:

            async def tcp_to_ws():
                while True:
                    data = await reader.read(CHUNK)
                    if not data:
                        break
                    await ws.send(data)

            async def ws_to_tcp():
                while True:
                    try:
                        msg = await ws.recv()
                    except websockets.ConnectionClosed:
                        break
                    if isinstance(msg, str):
                        msg = msg.encode()
                    writer.write(msg)
                    await writer.drain()

            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(tcp_to_ws()),
                    asyncio.create_task(ws_to_tcp()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()
    except Exception as e:
        log.error("proxy error for %s: %s", peer, e)
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass
        log.info("connection closed %s", peer)


async def main():
    server = await asyncio.start_server(handle_client, LISTEN_HOST, LISTEN_PORT)
    addrs = ", ".join(str(s.getsockname()) for s in server.sockets)
    log.info("neon-pg-proxy listening on %s → %s", addrs, WORKER_URL)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    async with server:
        await stop.wait()
        log.info("shutting down")

    server.close()
    await server.wait_closed()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
