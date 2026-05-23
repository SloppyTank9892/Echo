import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes.api import router as api_router
from routes.websocket import router as ws_router
from simulator.events import event_simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def baseline_loop():
        while True:
            try:
                await event_simulator.tick_baseline()
            except Exception:
                pass
            await asyncio.sleep(3)

    task = asyncio.create_task(baseline_loop())
    yield
    task.cancel()


app = FastAPI(
    title="ECHO API",
    description="Autonomous API failure detection & root cause analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)
