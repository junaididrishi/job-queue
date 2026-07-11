import sentry_sdk
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.logging import configure_logging, logger
from app.queue.client import close_redis
from app.api.routes import auth, tasks, stats
from app.dashboard import get_dashboard_html

settings = get_settings()
configure_logging()

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.2,
        environment=settings.APP_ENV,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", env=settings.APP_ENV)
    yield
    await close_redis()
    logger.info("shutdown")


app = FastAPI(
    title="Job Queue API",
    description="Distributed background job processing with Redis-backed priority queuing",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    logger.info("request", method=request.method, path=request.url.path, status=response.status_code)
    return response


app.include_router(auth.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


@app.get("/health", tags=["system"])
async def health():
    import time
    return {"status": "ok", "uptime": time.process_time(), "version": "2.0.0"}


@app.get("/dashboard", response_class=HTMLResponse, tags=["system"])
async def dashboard():
    return get_dashboard_html()


@app.get("/", include_in_schema=False)
async def root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse("/dashboard")
