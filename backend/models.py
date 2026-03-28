"""
models.py
DB 테이블 정의 (SQLAlchemy ORM).

테이블 구조:
  accounts          : 등록된 블로거 계정
  posts             : 크롤링한 게시물
  restaurants       : 맛집 정보 + 좌표
  post_restaurants  : 게시물 ↔ 맛집 M:N 연결
"""

from datetime import datetime
from sqlalchemy import (
    String, Text, Float, Integer, Boolean,
    DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False)       # "naver_blog" | "instagram"
    author_id: Mapped[str] = mapped_column(String(100), nullable=False)   # 블로거 ID
    author_name: Mapped[str] = mapped_column(String(100), nullable=True)  # 블로거 닉네임
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)        # 크롤링 활성 여부
    last_crawled_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    posts: Mapped[list["Post"]] = relationship("Post", back_populates="account")

    __table_args__ = (
        UniqueConstraint("source", "author_id", name="uq_account_source_author"),
    )


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=True)
    post_id: Mapped[str] = mapped_column(String(200), nullable=False)     # 원본 게시물 ID
    post_url: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=True)             # 본문 (추출 후 보관)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    crawled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    account: Mapped["Account"] = relationship("Account", back_populates="posts")
    post_restaurants: Mapped[list["PostRestaurant"]] = relationship(
        "PostRestaurant", back_populates="post"
    )

    __table_args__ = (
        UniqueConstraint("account_id", "post_id", name="uq_post_account_postid"),
    )


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    naver_place_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(200), nullable=True)
    address: Mapped[str] = mapped_column(String(300), nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    naver_place_url: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    post_restaurants: Mapped[list["PostRestaurant"]] = relationship(
        "PostRestaurant", back_populates="restaurant"
    )


class PostRestaurant(Base):
    """게시물 ↔ 맛집 M:N 연결 테이블."""
    __tablename__ = "post_restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("posts.id"), nullable=False)
    restaurant_id: Mapped[int] = mapped_column(Integer, ForeignKey("restaurants.id"), nullable=False)
    raw_mention: Mapped[str] = mapped_column(String(200), nullable=True)  # 본문에서 언급된 원본 상호명
    address_hint: Mapped[str] = mapped_column(String(200), nullable=True)

    post: Mapped["Post"] = relationship("Post", back_populates="post_restaurants")
    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="post_restaurants")

    __table_args__ = (
        UniqueConstraint("post_id", "restaurant_id", name="uq_post_restaurant"),
    )

class AdCheckCache(Base):
    __tablename__ = "ad_check_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_name: Mapped[str] = mapped_column(String(200), nullable=False)
    address_hint: Mapped[str] = mapped_column(String(200), nullable=True)
    total_posts: Mapped[int] = mapped_column(Integer, default=0)
    ad_count: Mapped[int] = mapped_column(Integer, default=0)
    suspicious_count: Mapped[int] = mapped_column(Integer, default=0)
    genuine_count: Mapped[int] = mapped_column(Integer, default=0)
    ad_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    verdict: Mapped[str] = mapped_column(String(20), nullable=False)
    posts_json: Mapped[str] = mapped_column(Text, nullable=True)  # JSON 직렬화
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("restaurant_name", name="uq_ad_cache_name"),
    )

class PersonalPlace(Base):
    __tablename__ = "personal_places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(300), nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(200), nullable=True)
    naver_place_url: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)