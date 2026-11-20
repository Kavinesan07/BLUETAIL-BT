import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, Users, Shop
from app.auth.dependencies import (
    require_shop_owner,
    require_super_admin,
    verify_product_ownership,
    verify_shop_ownership,
    get_or_create_user_shop,
    ROLE_SUPER_ADMIN,
    ROLE_SHOP_OWNER,
)

router = APIRouter(prefix="/products", tags=["products"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB


class ProductOut(BaseModel):
    id: int
    name: str
    description: str | None = ""
    price: float
    stock: int
    category: str
    image_url: str | None = None
    shop_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[ProductOut])
def list_products(
    shop_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Public catalog: lists all available, non-deleted products.
    Allows optional filtering by shop_id for browsing individual shops.
    """
    query = db.query(Product).filter(Product.is_deleted == False)
    if shop_id is not None:
        query = query.filter(Product.shop_id == shop_id)
    return query.order_by(Product.id.desc()).all()


@router.get("/manage", response_model=list[ProductOut])
def list_manage_products(
    shop_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Owner/Admin management view:
    - Shop Owner (role=1): Can view ONLY products belonging to their own shop.
    - Super Admin (role=2): Can view products across all shops (or filter by specific shop_id).
    """
    query = db.query(Product).filter(Product.is_deleted == False)

    if current_user.role == ROLE_SUPER_ADMIN:
        if shop_id is not None:
            query = query.filter(Product.shop_id == shop_id)
    else:
        # Shop Owner: retrieve user's owned shop
        user_shop = get_or_create_user_shop(current_user, db)
        query = query.filter(Product.shop_id == user_shop.id)

    return query.order_by(Product.id.desc()).all()


@router.get("/my-products", response_model=list[ProductOut])
def list_my_products(
    shop_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Dedicated endpoint for Shop Owners to retrieve their own shop's products.
    """
    return list_manage_products(shop_id=shop_id, db=db, current_user=current_user)


class StockUpdate(BaseModel):
    stock: int


@router.patch("/{product_id}/stock", response_model=ProductOut)
def update_product_stock(
    product_id: int,
    payload: StockUpdate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Quick stock update:
    - Shop Owner (role=1): verified via verify_product_ownership (own shop only).
    - Super Admin (role=2): verified via verify_product_ownership (any shop).
    """
    product = verify_product_ownership(product_id, current_user, db)
    if payload.stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    product.stock = payload.stock
    try:
        db.commit()
        db.refresh(product)
        return product
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update product stock")


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Public single product details."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.is_deleted == False)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(
    name: str = Form(...),
    price: float = Form(...),
    stock: int = Form(...),
    category: str = Form(...),
    description: str = Form(""),
    shop_id: Optional[int] = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Add a product:
    - Shop Owner (role=1): Can add products ONLY to their own shop.
    - Super Admin (role=2): Can add products to any specified shop.
    """
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG or WEBP images are allowed")
    content = await image.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 2 MB")

    # Determine and verify target shop ownership
    if current_user.role == ROLE_SUPER_ADMIN:
        if shop_id is not None:
            target_shop = db.query(Shop).filter(Shop.id == shop_id).first()
            if not target_shop:
                raise HTTPException(status_code=404, detail=f"Shop {shop_id} not found")
            target_shop_id = target_shop.id
        else:
            target_shop = get_or_create_user_shop(current_user, db)
            target_shop_id = target_shop.id
    else:
        # Shop Owner (role=1)
        if shop_id is not None:
            # Enforce that the shop_id actually belongs to this owner
            target_shop = verify_shop_ownership(shop_id, current_user, db)
            target_shop_id = target_shop.id
        else:
            # Auto-assign to owner's personal shop
            target_shop = get_or_create_user_shop(current_user, db)
            target_shop_id = target_shop.id

    filename = f"{uuid.uuid4().hex}{ALLOWED_TYPES[image.content_type]}"
    (UPLOAD_DIR / filename).write_bytes(content)

    product = Product(
        name=name,
        price=price,
        stock=stock,
        category=category,
        description=description,
        image_url=f"/uploads/{filename}",
        shop_id=target_shop_id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    name: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    stock: Optional[int] = Form(None),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Update a product:
    - Shop Owner (role=1): Can update ONLY their own shop's products (403 for others).
    - Super Admin (role=2): Can update any product across all shops.
    """
    product = verify_product_ownership(product_id, current_user, db)

    if name is not None:
        product.name = name.strip()
    if price is not None:
        product.price = price
    if stock is not None:
        product.stock = stock
    if category is not None:
        product.category = category.strip()
    if description is not None:
        product.description = description.strip()

    if image is not None and image.filename:
        if image.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Only JPG, PNG or WEBP images are allowed")
        content = await image.read()
        if len(content) > MAX_SIZE:
            raise HTTPException(status_code=400, detail="Image must be smaller than 2 MB")
        filename = f"{uuid.uuid4().hex}{ALLOWED_TYPES[image.content_type]}"
        (UPLOAD_DIR / filename).write_bytes(content)
        product.image_url = f"/uploads/{filename}"

    try:
        db.commit()
        db.refresh(product)
        return product
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update product")


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(require_shop_owner),
):
    """
    Delete (soft-delete) a product:
    - Shop Owner (role=1): Can delete ONLY their own shop's products (403 for others).
    - Super Admin (role=2): Can delete any product across all shops.
    """
    product = verify_product_ownership(product_id, current_user, db)
    product.is_deleted = True 

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete product")
