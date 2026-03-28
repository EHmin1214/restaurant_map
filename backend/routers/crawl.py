"""
routers/crawl.py
크롤링 파이프라인 트리거 엔드포인트.

POST /crawl/{account_id}  → 특정 계정 크롤링
POST /crawl/keyword       → 키워드 검색 크롤링

파이프라인: 크롤링 → 상호명 추출 → 좌표 변환 → DB 저장
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import Account, Post, Restaurant, PostRestaurant
from scrapers.naver_blog import NaverBlogScraper
from extractor import RestaurantExtractor
from routers.place_resolver import PlaceResolver
from dotenv import load_dotenv
load_dotenv()
import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crawl", tags=["crawl"])


# ── Pydantic 스키마 ──────────────────────

class CrawlStatus(BaseModel):
    account_id: int | None = None
    keyword: str | None = None
    posts_collected: int = 0
    restaurants_found: int = 0
    restaurants_saved: int = 0
    status: str  # "started" | "completed" | "failed"
    message: str = ""


class KeywordCrawlRequest(BaseModel):
    keyword: str
    max_posts: int = 20


# ── 파이프라인 핵심 함수 ─────────────────
def run_pipeline(posts_data, db: Session, account: Account | None = None):
    extractor = RestaurantExtractor()
    resolver = PlaceResolver()

    saved_posts = 0
    saved_restaurants = 0

    logger.info(f"파이프라인 시작: {len(posts_data)}개 게시물")  # ← 추가

    for post_data in posts_data:
        logger.info(f"처리 중: {post_data.title[:30]}")  # ← 추가

        existing_post = None
        if account:
            existing_post = db.query(Post).filter(
                Post.account_id == account.id,
                Post.post_id == post_data.post_id,
            ).first()

        if not existing_post:
            db_post = Post(
                account_id=account.id if account else None,
                post_id=post_data.post_id,
                post_url=post_data.post_url,
                title=post_data.title,
                content=post_data.content[:5000],
                published_at=post_data.published_at,
            )
            db.add(db_post)
            db.flush()
            saved_posts += 1
        else:
            db_post = existing_post

        try:
            extraction = extractor.extract_from_post(post_data)
            logger.info(f"추출 결과: is_restaurant={extraction.is_restaurant_post}, 상호명={[r.name for r in extraction.restaurants]}")  # ← 추가
        except Exception as e:
            logger.error(f"추출 에러: {e}", exc_info=True)
            continue

        if not extraction.is_restaurant_post or not extraction.restaurants:
            continue

        try:
            resolve_result = resolver.resolve_from_extraction(extraction)
            logger.info(f"장소 변환 결과: 성공={len(resolve_result.resolved)}, 실패={resolve_result.failed}")  # ← 추가
        except Exception as e:
            logger.error(f"장소 변환 에러: {e}", exc_info=True)
            continue

        for place in resolve_result.resolved:
            db_restaurant = db.query(Restaurant).filter(
                Restaurant.naver_place_id == place.naver_place_id
            ).first()

            if not db_restaurant:
                db_restaurant = Restaurant(
                    naver_place_id=place.naver_place_id,
                    name=place.name,
                    category=place.category,
                    address=place.address,
                    lat=place.lat,
                    lng=place.lng,
                    naver_place_url=place.naver_place_url,
                )
                db.add(db_restaurant)
                db.flush()
                saved_restaurants += 1

            existing_link = db.query(PostRestaurant).filter(
                PostRestaurant.post_id == db_post.id,
                PostRestaurant.restaurant_id == db_restaurant.id,
            ).first()

            if not existing_link:
                db.add(PostRestaurant(
                    post_id=db_post.id,
                    restaurant_id=db_restaurant.id,
                    raw_mention=place.queried_name,
                    address_hint=place.address_hint,
                ))

    db.commit()
    logger.info(f"파이프라인 완료: 게시물 {saved_posts}개, 맛집 {saved_restaurants}개")  # ← 추가
    return saved_posts, saved_restaurants

@router.post("/keyword", response_model=CrawlStatus)
def crawl_keyword(
    body: KeywordCrawlRequest,
    db: Session = Depends(get_db),
):
    """
    키워드 검색 기반 크롤링. 계정 연결 없이 맛집만 추출.
    예: {"keyword": "을지로 맛집", "max_posts": 20}
    """
    try:
        scraper = NaverBlogScraper()
        posts_data = scraper.get_posts_by_keyword(body.keyword, max_posts=body.max_posts)

        saved_posts, saved_restaurants = run_pipeline(posts_data, db, account=None)

        return CrawlStatus(
            keyword=body.keyword,
            posts_collected=len(posts_data),
            restaurants_found=saved_restaurants,
            restaurants_saved=saved_restaurants,
            status="completed",
            message=f"'{body.keyword}' 검색: 맛집 {saved_restaurants}개 추가",
        )

    except Exception as e:
        db.rollback()
        return CrawlStatus(
            keyword=body.keyword,
            status="failed",
            message=str(e),
        )

@router.post("/{account_id}", response_model=CrawlStatus)
def crawl_account(
    account_id: int,
    max_posts: int = 30,
    db: Session = Depends(get_db),
):
    """
    특정 계정의 블로그 게시물 크롤링 → 맛집 추출 → DB 저장.
    동기 처리 (완료까지 대기). 게시물이 많으면 시간이 걸릴 수 있음.
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

    try:
        scraper = NaverBlogScraper()
        posts_data = scraper.get_posts_by_author(account.author_id, max_posts=max_posts)
        logger.info(f"수집된 게시물: {len(posts_data)}개")  # ← 추가

        if not posts_data:  # ← 추가
            logger.warning(f"게시물 0개: author_id={account.author_id}")  # ← 추가


        saved_posts, saved_restaurants = run_pipeline(posts_data, db, account)

        # 마지막 크롤링 시각 업데이트
        account.last_crawled_at = datetime.utcnow()
        db.commit()

        return CrawlStatus(
            account_id=account_id,
            posts_collected=len(posts_data),
            restaurants_found=saved_restaurants,
            restaurants_saved=saved_restaurants,
            status="completed",
            message=f"게시물 {saved_posts}개 저장, 맛집 {saved_restaurants}개 추가",
        )

    except Exception as e:
        db.rollback()
        return CrawlStatus(
            account_id=account_id,
            status="failed",
            message=str(e),
        )

