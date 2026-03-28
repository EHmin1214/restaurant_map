"""
main.py
FastAPI 진입점.

[실행 방법]
  pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv anthropic requests beautifulsoup4

  .env 파일 설정:
    DATABASE_URL=postgresql://postgres:password@localhost:5432/matzip
    NAVER_CLIENT_ID=...
    NAVER_CLIENT_SECRET=...
    ANTHROPIC_API_KEY=...

  DB 테이블 생성 (최초 1회):
    python -c "from database import engine; from models import Base; Base.metadata.create_all(engine)"

  서버 실행:
    uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base
from routers import accounts, crawl, restaurants, ad_check, search_place
from routers import accounts, crawl, restaurants, ad_check, search_place, personal_places


# 테이블 자동 생성 (개발 편의용, 프로덕션에선 Alembic 마이그레이션 사용)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="맛집 지도 API",
    description="블로그 크롤링 기반 맛집 지도 서비스",
    version="0.1.0",
)

# CORS 설정 (React 개발 서버 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://restaurant-map-rosy.vercel.app",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(crawl.router)
app.include_router(restaurants.router)
app.include_router(ad_check.router)
app.include_router(search_place.router)
app.include_router(personal_places.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "맛집 지도 API"}

