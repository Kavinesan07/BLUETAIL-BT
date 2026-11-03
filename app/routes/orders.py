import traceback
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Address, Order, OrderItem, Product, Users

router = APIRouter(prefix="/orders", tags=["orders"])

class OrderLine(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=100)


class OrderCreate(BaseModel):
    user_id: int
    address_id: int
    items: list[OrderLine] = Field(min_length=1)


def address_to_dict(address) -> dict | None:
    if not address:
        return None
    return {
        "id": address.id,
        "street": address.street,
        "city": address.city,
        "state": address.state,
        "pin_code": address.pin_code,
        "phone_number": address.phone_number,
    }


def user_to_dict_simple(user) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
    }


def order_to_dict(order: Order, address=None, user=None) -> dict:
    return {
        "id": order.id,
        "user_id": order.user_id,
        "address_id": order.address_id,
        "status": order.status,
        "total_amount": float(order.total_amount),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "address": address_to_dict(address),
        "user": user_to_dict_simple(user),
        "items": [
            {
                "product_id": i.product_id,
                "product_name": i.product_name,
                "unit_price": float(i.product_price),
                "quantity": i.quantity,
            }
            for i in order.items
        ],
    }


@router.post("/create", status_code=201)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
   
    address = (
        db.query(Address)
        .filter(Address.id == data.address_id, Address.user_id == data.user_id)
        .first()
    )
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    user = db.query(Users).filter(Users.id == data.user_id).first()

  
    wanted: dict[int, int] = {}
    for line in data.items:
        wanted[line.product_id] = wanted.get(line.product_id, 0) + line.quantity

    products = (
        db.query(Product)
        .filter(Product.id.in_(list(wanted)), Product.is_deleted == False)
        .all()
    )
    by_id = {p.id: p for p in products}

    order = Order(
        user_id=data.user_id,
        address_id=data.address_id,
        status="pending",
        total_amount=Decimal("0"),
    )
    total = Decimal("0")

    try:
        for product_id, qty in wanted.items():
            product = by_id.get(product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

            # 3. take the stock in one safe step. It only works if enough stock is left.
            changed = (
                db.query(Product)
                .filter(Product.id == product_id, Product.is_deleted == False, Product.stock >= qty)
                .update({Product.stock: Product.stock - qty}, synchronize_session=False)
            )
            if changed == 0:
                raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")

            # 4. the price comes from the database, never from the browser
            unit_price = Decimal(str(product.price)).quantize(Decimal("0.01"))
            total += unit_price * qty
            order.items.append(
                OrderItem(
                    product_id=product_id,
                    product_name=product.name,
                    product_price=float(unit_price),
                    quantity=qty,
                )
            )

        order.total_amount = total
        db.add(order)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        traceback.print_exc()  
        raise HTTPException(status_code=500, detail="Could not create the order")

    db.refresh(order)
    return order_to_dict(order, address, user)


@router.get("")
@router.get("/all")
def list_orders(user_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Order)
    if user_id is not None:
        query = query.filter(Order.user_id == user_id)
    orders = query.order_by(Order.id.desc()).all()

    address_ids = [o.address_id for o in orders if o.address_id]
    user_ids = [o.user_id for o in orders if o.user_id]

    addresses = {a.id: a for a in db.query(Address).filter(Address.id.in_(address_ids)).all()} if address_ids else {}
    users = {u.id: u for u in db.query(Users).filter(Users.id.in_(user_ids)).all()} if user_ids else {}

    return [order_to_dict(o, addresses.get(o.address_id), users.get(o.user_id)) for o in orders]


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    address = db.query(Address).filter(Address.id == order.address_id).first()
    user = db.query(Users).filter(Users.id == order.user_id).first()
    return order_to_dict(order, address, user)
