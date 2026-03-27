"""
routers/ad_check.py
광고 분석 결과를 DB에 캐싱해서 재사용.
7일 이내 분석 결과는 DB에서 바로 반환.
"""

import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import get_db
from models import AdCheckCache
from scrapers.naver_blog import NaverBlogScraper
from ad_checker import AdChecker

router = APIRouter(prefix="/ad-check", tags=["ad-check"])

CACHE_DAYS = 7  # 7일간 캐시 유지


class AdCheckRequest(BaseModel):
    restaurant_name: str
    address_hint: str | None = None


class PostAdResponse(BaseModel):
    post_url: str
    post_title: str
    author_name: str
    is_ad: bool
    is_suspicious: bool
    matched_keywords: list[str]


class AdCheckResponse(BaseModel):
    restaurant_name: str
    total_posts: int
    ad_count: int
    suspicious_count: int
    genuine_count: int
    ad_ratio: float
    verdict: str
    posts: list[PostAdResponse]
    cached: bool = False        # 캐시에서 불러왔는지 여부
    checked_at: str | None = None  # 분석 일시


@router.post("/", response_model=AdCheckResponse)
def check_ads(body: AdCheckRequest, db: Session = Depends(get_db)):

    # 1. 캐시 확인
    cache = db.query(AdCheckCache).filter(
        AdCheckCache.restaurant_name == body.restaurant_name
    ).first()

    if cache:
        cache_age = datetime.utcnow() - cache.checked_at
        if cache_age < timedelta(days=CACHE_DAYS):
            # 7일 이내 캐시 → 바로 반환
            posts = json.loads(cache.posts_json) if cache.posts_json else []
            return AdCheckResponse(
                restaurant_name=cache.restaurant_name,
                total_posts=cache.total_posts,
                ad_count=cache.ad_count,
                suspicious_count=cache.suspicious_count,
                genuine_count=cache.genuine_count,
                ad_ratio=cache.ad_ratio,
                verdict=cache.verdict,
                posts=[PostAdResponse(**p) for p in posts],
                cached=True,
                checked_at=cache.checked_at.strftime("%Y-%m-%d %H:%M"),
            )

    # 2. 캐시 없거나 만료 → 크롤링 + 분석
    query = f"{body.address_hint} {body.restaurant_name}" \
        if body.address_hint else body.restaurant_name

    scraper = NaverBlogScraper()
    posts_data = scraper.get_posts_by_keyword(query, max_posts=10)

    checker = AdChecker()
    result = checker.analyze(
        body.restaurant_name,
        [{"content": p.content, "url": p.post_url, "title": p.title,
          "author_id": p.author_id, "author_name": p.author_name}
         for p in posts_data]
    )

    # 3. 결과 DB에 저장
    posts_serialized = [
        {
            "post_url": p.post_url,
            "post_title": p.post_title,
            "author_name": p.author_name,
            "is_ad": p.is_ad,
            "is_suspicious": p.is_suspicious,
            "matched_keywords": p.matched_keywords,
        }
        for p in result.posts
    ]

    if cache:
        # 기존 캐시 업데이트
        cache.total_posts = result.total_posts
        cache.ad_count = result.ad_count
        cache.suspicious_count = result.suspicious_count
        cache.genuine_count = result.genuine_count
        cache.ad_ratio = result.ad_ratio
        cache.verdict = result.verdict
        cache.posts_json = json.dumps(posts_serialized, ensure_ascii=False)
        cache.checked_at = datetime.utcnow()
    else:
        # 새로 저장
        db.add(AdCheckCache(
            restaurant_name=body.restaurant_name,
            address_hint=body.address_hint,
            total_posts=result.total_posts,
            ad_count=result.ad_count,
            suspicious_count=result.suspicious_count,
            genuine_count=result.genuine_count,
            ad_ratio=result.ad_ratio,
            verdict=result.verdict,
            posts_json=json.dumps(posts_serialized, ensure_ascii=False),
        ))

    db.commit()
    now = datetime.utcnow()

    return AdCheckResponse(
        restaurant_name=result.restaurant_name,
        total_posts=result.total_posts,
        ad_count=result.ad_count,
        suspicious_count=result.suspicious_count,
        genuine_count=result.genuine_count,
        ad_ratio=result.ad_ratio,
        verdict=result.verdict,
        posts=[PostAdResponse(**p) for p in posts_serialized],
        cached=False,
        checked_at=now.strftime("%Y-%m-%d %H:%M"),
    )
