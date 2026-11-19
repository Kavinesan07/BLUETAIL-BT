from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Shop, Product, Users
from app.auth.dependencies import (
    require_shop_owner,
    require_super_admin,
    verify_shop_ownership,
    get_or_create_user_shop,
    ROLE_SUPER_ADMIN,
    ROLE_SHOP_OWNER,
)

router = APIRouter(prefix="/shops", tags=["shops"])


class ShopOut(BaseModel):
    id: int
    name: str
    description: str | None = ""
    owner_id: int
    is_active: bool
    created_at: str | None = None
    products_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ShopCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = ""
    owner_id: Optional[int] = None


class ShopUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


def shop_to_dict(shop: Shop, db: Session) -> dict:
    count = db.query(Product).filter(Product.shop_id == shop.id, Product.is_deleted == False).count()
    return {
        "id": shop.id,
        "name": shop.name,
        "description": shop.description or "",
        "owner_id": shop.owner_id,
        "is_active": shop.is_active,
        "created_at": shop.created_at.isoformat() if shop.created_at else None,
        "products_count": count,
    }


@router.get("", response_model=list[ShopOut])
def list_shops(
    owner_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Public endpoint: Browse all active shops in the marketplace.
    Allows customers to view shop directories and filter by owner.
    """
    query = db.query(Shop).filter(Shop.is_active == True)
    if owner_id is not None:
        query = query.filter(Shop.owner_id == owner_id)
    shops = query.order_by(Shop.id.asc()).all()
    return [shop_to_dict(s, db) for s in shops]


@router.get("/my-shop", response_model=ShopOut)
def get_my_shop(
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Protected endpoint: returns the authenticated Shop Owner's personal shop.
    Auto-creates the shop if not already initialized.
    """
    shop = get_or_create_user_shop(current_user, db)
    return shop_to_dict(shop, db)


@router.get("/{shop_id}", response_model=ShopOut)
def get_shop(
    shop_id: int,
    db: Session = Depends(get_db),
):
    """Public single shop profile."""
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop_to_dict(shop, db)


@router.get("/{shop_id}/products")
def list_shop_products(
    shop_id: int,
    db: Session = Depends(get_db),
):
    """Public endpoint to view all active products belonging to a specific shop."""
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    products = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.is_deleted == False)
        .order_by(Product.id.desc())
        .all()
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "stock": p.stock,
            "category": p.category,
            "image_url": p.image_url,
            "shop_id": p.shop_id,
        }
        for p in products
    ]


@router.post("", response_model=ShopOut, status_code=201)
def create_shop(
    data: ShopCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Create a new shop:
    - Shop Owner (role=1): Can create their own shop (owner_id is enforced to be current_user.id).
    - Super Admin (role=2): Can create a shop and assign it to any owner_id.
    """
    if current_user.role == ROLE_SUPER_ADMIN:
        owner_id = data.owner_id if data.owner_id else current_user.id
        owner_user = db.query(Users).filter(Users.id == owner_id).first()
        if not owner_user:
            raise HTTPException(status_code=404, detail=f"Owner user with id {owner_id} not found")
    else:
        # Shop Owner can only create a shop for themselves
        owner_id = current_user.id

    shop = Shop(
        name=data.name.strip(),
        description=data.description.strip() if data.description else "",
        owner_id=owner_id,
        is_active=True,
    )
    db.add(shop)
    db.commit()
    db.refresh(shop)
    return shop_to_dict(shop, db)


@router.put("/{shop_id}", response_model=ShopOut)
def update_shop(
    shop_id: int,
    data: ShopUpdate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Update shop details:
    - Shop Owner (role=1): Can update ONLY their own shop (403 for others).
    - Super Admin (role=2): Can update any shop.
    """
    shop = verify_shop_ownership(shop_id, current_user, db)

    if data.name is not None:
        shop.name = data.name.strip()
    if data.description is not None:
        shop.description = data.description.strip()
    if data.is_active is not None:
        shop.is_active = data.is_active

    shop.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(shop)
    return shop_to_dict(shop, db)


@router.delete("/{shop_id}", status_code=204)
def delete_shop(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Deactivate / delete a shop:
    - Shop Owner (role=1): Can delete ONLY their own shop (403 for others).
    - Super Admin (role=2): Can delete any shop.
    """
    shop = verify_shop_ownership(shop_id, current_user, db)
    shop.is_active = False

    # Also soft-delete all products belonging to this shop
    db.query(Product).filter(Product.shop_id == shop.id).update(
        {Product.is_deleted: True},
        synchronize_session=False
    )

    db.commit()
