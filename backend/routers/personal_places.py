"""
routers/personal_places.py
사용자가 직접 검색해서 저장한 개인 맛집 관리.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import get_db
from models import PersonalPlace

router = APIRouter(prefix="/personal-places", tags=["personal-places"])


class PersonalPlaceCreate(BaseModel):
    name: str
    address: str | None = None
    lat: float
    lng: float
    category: str | None = None
    naver_place_url: str | None = None


class PersonalPlaceResponse(BaseModel):
    id: int
    name: str
    address: str | None
    lat: float
    lng: float
    category: str | None
    naver_place_url: str | None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[PersonalPlaceResponse])
def list_personal_places(db: Session = Depends(get_db)):
    """저장된 개인 맛집 전체 조회."""
    return db.query(PersonalPlace).all()


@router.post("/", response_model=PersonalPlaceResponse, status_code=201)
def add_personal_place(body: PersonalPlaceCreate, db: Session = Depends(get_db)):
    """개인 맛집 추가. 같은 이름+주소면 중복 저장 안 함."""
    existing = db.query(PersonalPlace).filter(
        PersonalPlace.name == body.name,
        PersonalPlace.address == body.address,
    ).first()

    if existing:
        return existing

    place = PersonalPlace(
        name=body.name,
        address=body.address,
        lat=body.lat,
        lng=body.lng,
        category=body.category,
        naver_place_url=body.naver_place_url,
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return place


@router.delete("/{place_id}", status_code=204)
def delete_personal_place(place_id: int, db: Session = Depends(get_db)):
    """개인 맛집 삭제."""
    place = db.query(PersonalPlace).filter(PersonalPlace.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다.")
    db.delete(place)
    db.commit()
