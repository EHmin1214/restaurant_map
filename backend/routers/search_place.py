"""
routers/search_place.py
가게명으로 네이버 장소 검색해서 좌표를 반환하는 엔드포인트.
광고 분석 검색 시 지도 마커 추가에 사용.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from backend.routers.place_resolver import PlaceResolver
from scrapers.base import PostData, SourceType
from datetime import datetime

router = APIRouter(prefix="/search-place", tags=["search-place"])


class PlaceResponse(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    category: str
    naver_place_url: str


@router.get("/", response_model=PlaceResponse | None)
def search_place(name: str = Query(...)):
    """가게명으로 네이버 장소 검색 후 좌표 반환."""
    resolver = PlaceResolver()

    dummy_post = PostData(
        source=SourceType.NAVER_BLOG,
        post_id="search", post_url="",
        title=name, content="",
        author_id="", author_name="",
        published_at=datetime.now(),
    )

    result = resolver._search_place(name, None, dummy_post)
    if not result:
        return None

    return PlaceResponse(
        name=result.name,
        address=result.address,
        lat=result.lat,
        lng=result.lng,
        category=result.category,
        naver_place_url=result.naver_place_url,
    )
