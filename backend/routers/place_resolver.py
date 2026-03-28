"""
place_resolver.py
추출된 상호명을 네이버 장소 검색 API로 좌표/주소로 변환하는 모듈.

[사전 준비]
  환경변수:
    NAVER_CLIENT_ID     : 네이버 개발자센터 Client ID
    NAVER_CLIENT_SECRET : 네이버 개발자센터 Client Secret
"""

import os
import re
import logging
from dataclasses import dataclass
from dotenv import load_dotenv

import requests

load_dotenv()

from extractor import ExtractedRestaurant, ExtractionResult

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ──────────────────────────────────────────
# 데이터 구조
# ──────────────────────────────────────────

@dataclass
class ResolvedPlace:
    queried_name: str
    address_hint: str | None
    naver_place_id: str
    name: str
    category: str
    address: str
    lat: float
    lng: float
    naver_place_url: str
    source_post_url: str
    source_post_title: str
    source_author_id: str


@dataclass
class ResolveResult:
    post_url: str
    resolved: list[ResolvedPlace]
    failed: list[str]


# ──────────────────────────────────────────
# 메인 리졸버
# ──────────────────────────────────────────

NAVER_LOCAL_SEARCH_API = "https://openapi.naver.com/v1/search/local.json"


class PlaceResolver:

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
    ):
        self.client_id = client_id or os.environ.get("NAVER_CLIENT_ID")
        self.client_secret = client_secret or os.environ.get("NAVER_CLIENT_SECRET")

        if not self.client_id or not self.client_secret:
            raise ValueError(
                "네이버 API 키가 필요합니다.\n"
                "NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수를 설정하세요."
            )

        logger.info(f"PlaceResolver 초기화: client_id={self.client_id[:6]}...")

        self.session = requests.Session()
        self.session.headers.update({
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret,
        })

    # ── 공개 메서드 ─────────────────────────

    def resolve_from_extraction(self, result: ExtractionResult) -> ResolveResult:
        resolved = []
        failed = []

        for restaurant in result.restaurants:
            place = self._search_place(
                name=restaurant.name,
                address_hint=restaurant.address_hint,
                post=result.post,
            )
            if place:
                resolved.append(place)
            else:
                failed.append(restaurant.name)
                logger.warning(f"장소 검색 실패: '{restaurant.name}'")

        logger.info(
            f"장소 변환 완료: 성공 {len(resolved)}개 / 실패 {len(failed)}개"
            + (f" (실패: {failed})" if failed else "")
        )

        return ResolveResult(
            post_url=result.post.post_url,
            resolved=resolved,
            failed=failed,
        )

    def resolve_from_results(
        self, extraction_results: list[ExtractionResult]
    ) -> list[ResolvedPlace]:
        seen_place_ids: set[str] = set()
        all_resolved: list[ResolvedPlace] = []

        for result in extraction_results:
            if not result.is_restaurant_post:
                continue

            resolve_result = self.resolve_from_extraction(result)

            for place in resolve_result.resolved:
                if place.naver_place_id not in seen_place_ids:
                    seen_place_ids.add(place.naver_place_id)
                    all_resolved.append(place)
                else:
                    logger.debug(f"중복 제거: {place.name} ({place.naver_place_id})")

        logger.info(f"전체 고유 맛집: {len(all_resolved)}개")
        return all_resolved

    def _extract_location_from_title(self, title: str) -> str | None:
        """제목에서 지역명 추출. 예) '을지로 맛집 투어' → '을지로'"""
        LOCATION_PATTERN = re.compile(
            r"(강남|홍대|합정|망원|연남|성수|을지로|종로|이태원|한남|"
            r"압구정|청담|신사|가로수길|잠실|건대|혜화|대학로|"
            r"인사동|북촌|서촌|광화문|여의도|마포|용산|연희|"
            r"익선동|망원동|서교동|청주|부산|대구|인천|광주|대전|"
            r"제주|수원|성남|분당|판교|안동|전주|경주|포항|구미|"
            r"[가-힣]+동|[가-힣]+구|[가-힣]+시)"
        )
        match = LOCATION_PATTERN.search(title)
        result = match.group(0) if match else None
        logger.info(f"제목에서 지역 추출: '{title}' → '{result}'")
        return result

    # ── 네이버 장소 검색 ────────────────────

    def _search_place(
        self,
        name: str,
        address_hint: str | None,
        post,
    ) -> ResolvedPlace | None:

        if not address_hint:
            address_hint = self._extract_location_from_title(post.title)

        query = f"{address_hint} {name}" if address_hint else name
        logger.info(f"장소 검색 시도: '{query}'")

        params = {
            "query": query,
            "display": 1,
            "sort": "comment",
        }

        try:
            resp = self.session.get(NAVER_LOCAL_SEARCH_API, params=params, timeout=10)
            logger.info(f"API 응답 코드: {resp.status_code}")
            resp.raise_for_status()

            data = resp.json()
            items = data.get("items", [])
            logger.info(f"검색 결과 수: {len(items)}개 (query='{query}')")

            if not items:
                # 위치 힌트 붙였는데 결과 없으면 힌트 없이 재시도
                if address_hint:
                    logger.info(f"힌트 없이 재시도: '{name}'")
                    resp2 = self.session.get(
                        NAVER_LOCAL_SEARCH_API,
                        params={"query": name, "display": 1, "sort": "comment"},
                        timeout=10,
                    )
                    items = resp2.json().get("items", [])
                    logger.info(f"재시도 결과 수: {len(items)}개")

                if not items:
                    return None

            item = items[0]
            logger.info(f"검색 결과: {item.get('title')} / {item.get('roadAddress')}")

            return self._build_resolved_place(item, name, address_hint, post)

        except Exception as e:
            logger.error(f"장소 검색 에러 ('{query}'): {type(e).__name__}: {e}")
            return None

    @staticmethod
    def _build_resolved_place(
        item: dict,
        queried_name: str,
        address_hint: str | None,
        post,
    ) -> ResolvedPlace:

        name = re.sub(r"<[^>]+>", "", item.get("title", ""))

        mapx = int(item.get("mapx", 0))
        mapy = int(item.get("mapy", 0))
        lng = mapx / 1e7
        lat = mapy / 1e7

        link = item.get("link", "")
        place_id_match = re.search(r"place/(\d+)", link)
        if place_id_match:
            naver_place_id = place_id_match.group(1)
        else:
            address = item.get("roadAddress") or item.get("address", "")
            raw_name = re.sub(r"<[^>]+>", "", item.get("title", ""))
            naver_place_id = f"{raw_name}_{address}"

        category = item.get("category", "").replace(">", " > ")

        return ResolvedPlace(
            queried_name=queried_name,
            address_hint=address_hint,
            naver_place_id=naver_place_id,
            name=name,
            category=category,
            address=item.get("roadAddress") or item.get("address", ""),
            lat=lat,
            lng=lng,
            naver_place_url=f"https://map.naver.com/v5/search/{queried_name}",
            source_post_url=post.post_url,
            source_post_title=post.title,
            source_author_id=post.author_id,
        )


# ──────────────────────────────────────────
# 간단 테스트 (직접 실행 시)
# ──────────────────────────────────────────

if __name__ == "__main__":
    from scrapers.base import PostData, SourceType
    from extractor import ExtractedRestaurant, ExtractionResult
    from datetime import datetime

    dummy_post = PostData(
        source=SourceType.NAVER_BLOG,
        post_id="test_001",
        post_url="https://blog.naver.com/test/001",
        title="을지로 맛집 투어",
        content="",
        author_id="foodie_seoul",
        author_name="서울맛집탐방",
        published_at=datetime.now(),
    )

    dummy_extraction = ExtractionResult(
        post=dummy_post,
        is_restaurant_post=True,
        restaurants=[
            ExtractedRestaurant(
                name="을지면옥",
                category="냉면",
                address_hint="을지로",
                mention_context="첫 번째로 간 곳은 을지면옥.",
            ),
            ExtractedRestaurant(
                name="하이드미플리즈",
                category="카페",
                address_hint=None,
                mention_context="하이드미플리즈에서 디저트로 마무리했습니다.",
            ),
        ],
    )

    resolver = PlaceResolver()
    result = resolver.resolve_from_extraction(dummy_extraction)

    print("\n=== 장소 변환 결과 ===")
    for place in result.resolved:
        print(f"\n✅ {place.name}")
        print(f"   주소    : {place.address}")
        print(f"   좌표    : ({place.lat}, {place.lng})")
        print(f"   카테고리: {place.category}")

    if result.failed:
        print(f"\n❌ 실패: {result.failed}")