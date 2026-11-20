from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Users
from .jwt_handler import verify_access_token

optional_security = HTTPBearer(auto_error=False)


def _extract_token(
    access_token: str | None = Cookie(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
) -> str | None:
    if access_token:
        return access_token
    if credentials and credentials.credentials:
        return credentials.credentials
    return None


def get_current_user(
    token: str | None = Depends(_extract_token),
    db: Session = Depends(get_db),
) -> Users:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_access_token(token)
    user_id = payload.get("sub") or payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user identification",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(Users).filter(Users.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


ROLE_CUSTOMER = 0
ROLE_SHOP_OWNER = 1
ROLE_SUPER_ADMIN = 2


def require_role(*roles: int):
    """Factory dependency that requires the user to have one of the specified roles."""
    def _role_checker(current_user: Users = Depends(get_current_user)) -> Users:
        user_role = getattr(current_user, "role", 0)
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires role in {roles}, but your role is {user_role}",
            )
        return current_user
    return _role_checker


def require_shop_owner(
    current_user: Users = Depends(get_current_user),
) -> Users:
    """Requires authenticated user with Role 1 (Shop Owner) or Role 2 (Super Admin)."""
    user_role = getattr(current_user, "role", 0)
    if user_role not in (ROLE_SHOP_OWNER, ROLE_SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shop Owner or Super Admin privileges required to perform this action",
        )
    return current_user


def require_super_admin(
    current_user: Users = Depends(get_current_user),
) -> Users:
    """Requires authenticated user with Role 2 (Super Admin)."""
    user_role = getattr(current_user, "role", 0)
    if user_role != ROLE_SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required to perform this action",
        )
    return current_user


def get_current_admin(
    current_user: Users = Depends(get_current_user),
) -> Users:
    """Backwards-compatible admin dependency (accepts Role 1 Shop Owner & Role 2 Super Admin)."""
    user_role = getattr(current_user, "role", 0)
    if user_role not in (ROLE_SHOP_OWNER, ROLE_SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to perform this action",
        )
    return current_user


def verify_shop_ownership(
    shop_id: int,
    current_user: Users,
    db: Session,
):
    """
    Verifies that the shop exists and that the current user has rights to manage it:
    - Super Admin (role == 2) can manage ANY shop.
    - Shop Owner (role == 1) can ONLY manage their own shop (shop.owner_id == current_user.id).
    - Customer (role == 0) or another owner gets HTTP 403 Forbidden.
    """
    from ..models import Shop

    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shop with id {shop_id} not found",
        )

    # Super Admin has access to all shops
    if getattr(current_user, "role", 0) == ROLE_SUPER_ADMIN:
        return shop

    # Shop Owner can only access their own shop
    if getattr(current_user, "role", 0) == ROLE_SHOP_OWNER:
        if shop.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this shop.",
            )
        return shop

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to access this shop.",
    )


def verify_product_ownership(
    product_id: int,
    current_user: Users,
    db: Session,
):
    """
    Verifies that the product exists and the current user has rights to modify it:
    - Super Admin (role == 2) can modify ANY product.
    - Shop Owner (role == 1) can ONLY modify products belonging to their own shop.
    - If the product belongs to another shop owner -> HTTP 403 Forbidden.
    """
    from ..models import Product, Shop

    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.is_deleted == False)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found",
        )

    # Super Admin can manage all products
    if getattr(current_user, "role", 0) == ROLE_SUPER_ADMIN:
        return product

    # Shop Owner check
    if getattr(current_user, "role", 0) == ROLE_SHOP_OWNER:
        if not product.shop_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Product does not belong to your shop.",
            )

        shop = db.query(Shop).filter(Shop.id == product.shop_id).first()
        if not shop or shop.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only modify products belonging to your own shop.",
            )
        return product

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to modify this product.",
    )


def get_or_create_user_shop(
    user: Users,
    db: Session,
):
    """
    Helper to get the active shop owned by a Shop Owner,
    or auto-creates a default shop if the Shop Owner does not have one yet.
    """
    from ..models import Shop

    shop = (
        db.query(Shop)
        .filter(Shop.owner_id == user.id, Shop.is_active == True)
        .order_by(Shop.id.asc())
        .first()
    )
    if not shop:
        shop = Shop(
            name=f"{user.username}'s Shop",
            description=f"Store managed by {user.username}",
            owner_id=user.id,
            is_active=True,
        )
        db.add(shop)
        db.commit()
        db.refresh(shop)
    return shop


def get_optional_current_user(
    token: str | None = Depends(_extract_token),
    db: Session = Depends(get_db),
) -> Users | None:
    if not token:
        return None
    try:
        payload = verify_access_token(token)
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            return None
        return db.query(Users).filter(Users.id == int(user_id)).first()
    except Exception:
        return None