import io
import sys
import os
from pathlib import Path

# Set up project path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import app
from app.database import engine, get_db
from app.models import Users, Shop, Product
from app.auth.jwt_handler import create_access_token
from app.routes.users import hash_password

client = TestClient(app)

def setup_test_data():
    """Create test users, shops, and products for RBAC testing."""
    with Session(engine) as db:
        # Clean up existing test users, shops, and products cleanly
        test_emails = [
            "customer_test@example.com",
            "owner1_test@example.com",
            "owner2_test@example.com",
            "superadmin_test@example.com",
        ]
        user_ids = [u.id for u in db.query(Users.id).filter(Users.email.in_(test_emails)).all()]
        if user_ids:
            shop_ids = [s.id for s in db.query(Shop.id).filter(Shop.owner_id.in_(user_ids)).all()]
            if shop_ids:
                db.query(Product).filter(Product.shop_id.in_(shop_ids)).delete(synchronize_session=False)
                db.query(Shop).filter(Shop.id.in_(shop_ids)).delete(synchronize_session=False)
            db.query(Users).filter(Users.id.in_(user_ids)).delete(synchronize_session=False)
            db.commit()

        # 1. Customer (Role 0)
        customer = Users(
            username="test_customer",
            email="customer_test@example.com",
            hashed_password=hash_password("password123"),
            role=0,
        )
        # 2. Shop Owner 1 (Role 1)
        owner1 = Users(
            username="test_owner1",
            email="owner1_test@example.com",
            hashed_password=hash_password("password123"),
            role=1,
        )
        # 3. Shop Owner 2 (Role 1)
        owner2 = Users(
            username="test_owner2",
            email="owner2_test@example.com",
            hashed_password=hash_password("password123"),
            role=1,
        )
        # 4. Super Admin (Role 2)
        superadmin = Users(
            username="test_superadmin",
            email="superadmin_test@example.com",
            hashed_password=hash_password("password123"),
            role=2,
        )
        db.add_all([customer, owner1, owner2, superadmin])
        db.commit()
        db.refresh(customer)
        db.refresh(owner1)
        db.refresh(owner2)
        db.refresh(superadmin)

        # 5. Shop A for Owner 1
        shop_a = Shop(
            name="Shop A (Owner 1)",
            description="Owner 1 electronics shop",
            owner_id=owner1.id,
            is_active=True,
        )
        # 6. Shop B for Owner 2
        shop_b = Shop(
            name="Shop B (Owner 2)",
            description="Owner 2 toys shop",
            owner_id=owner2.id,
            is_active=True,
        )
        db.add_all([shop_a, shop_b])
        db.commit()
        db.refresh(shop_a)
        db.refresh(shop_b)

        # 7. Products
        prod_a = Product(
            name="Product A1",
            description="Item in Shop A",
            price=19.99,
            stock=10,
            category="Electronics",
            image_url="/uploads/sample.jpg",
            shop_id=shop_a.id,
            is_deleted=False,
        )
        prod_b = Product(
            name="Product B1",
            description="Item in Shop B",
            price=49.99,
            stock=5,
            category="Toys",
            image_url="/uploads/sample.jpg",
            shop_id=shop_b.id,
            is_deleted=False,
        )
        db.add_all([prod_a, prod_b])
        db.commit()
        db.refresh(prod_a)
        db.refresh(prod_b)

        return {
            "customer": {"id": customer.id, "token": create_access_token(customer.id, role=0, email=customer.email)},
            "owner1": {"id": owner1.id, "shop_id": shop_a.id, "prod_id": prod_a.id, "token": create_access_token(owner1.id, role=1, email=owner1.email)},
            "owner2": {"id": owner2.id, "shop_id": shop_b.id, "prod_id": prod_b.id, "token": create_access_token(owner2.id, role=1, email=owner2.email)},
            "superadmin": {"id": superadmin.id, "token": create_access_token(superadmin.id, role=2, email=superadmin.email)},
        }


def run_tests():
    data = setup_test_data()
    c_auth = {"Authorization": f"Bearer {data['customer']['token']}"}
    o1_auth = {"Authorization": f"Bearer {data['owner1']['token']}"}
    o2_auth = {"Authorization": f"Bearer {data['owner2']['token']}"}
    sa_auth = {"Authorization": f"Bearer {data['superadmin']['token']}"}

    print("================================================================")
    print("RUNNING RBAC & SHOP-LEVEL OWNERSHIP AUTHORIZATION TEST SUITE")
    print("================================================================")

    # -------------------------------------------------------------
    # Scenario 1: Owner 1 can add a product to Shop A
    # -------------------------------------------------------------
    dummy_img = ("test.png", io.BytesIO(b"fake image data"), "image/png")
    r1 = client.post(
        "/products",
        headers=o1_auth,
        data={
            "name": "Owner 1 New Product",
            "price": "25.00",
            "stock": "15",
            "category": "Gear",
            "description": "Added by Owner 1 to Shop A",
            "shop_id": str(data["owner1"]["shop_id"]),
        },
        files={"image": dummy_img},
    )
    assert r1.status_code == 201, f"Expected 201, got {r1.status_code}: {r1.text}"
    o1_new_prod_id = r1.json()["id"]
    assert r1.json()["shop_id"] == data["owner1"]["shop_id"]
    print("✅ Scenario 1 PASSED: Owner 1 successfully added product to their own Shop A.")

    # -------------------------------------------------------------
    # Scenario 2: Owner 1 cannot add a product to Shop B (403 Forbidden)
    # -------------------------------------------------------------
    dummy_img = ("test.png", io.BytesIO(b"fake image data"), "image/png")
    r2 = client.post(
        "/products",
        headers=o1_auth,
        data={
            "name": "Owner 1 Unauthorized Product",
            "price": "30.00",
            "stock": "5",
            "category": "Gear",
            "description": "Attempt to add to Owner 2's Shop B",
            "shop_id": str(data["owner2"]["shop_id"]),
        },
        files={"image": dummy_img},
    )
    assert r2.status_code == 403, f"Expected 403, got {r2.status_code}: {r2.text}"
    print("✅ Scenario 2 PASSED: Owner 1 blocked with 403 Forbidden when adding to Shop B.")

    # -------------------------------------------------------------
    # Scenario 3: Owner 1 can update their own product
    # -------------------------------------------------------------
    r3 = client.put(
        f"/products/{data['owner1']['prod_id']}",
        headers=o1_auth,
        data={"name": "Product A1 - Updated by Owner 1", "price": "22.50"},
    )
    assert r3.status_code == 200, f"Expected 200, got {r3.status_code}: {r3.text}"
    assert r3.json()["name"] == "Product A1 - Updated by Owner 1"
    print("✅ Scenario 3 PASSED: Owner 1 successfully updated their own product.")

    # -------------------------------------------------------------
    # Scenario 4: Owner 1 cannot update Owner 2's product (403 Forbidden)
    # -------------------------------------------------------------
    r4 = client.put(
        f"/products/{data['owner2']['prod_id']}",
        headers=o1_auth,
        data={"name": "Tampered Name by Owner 1"},
    )
    assert r4.status_code == 403, f"Expected 403, got {r4.status_code}: {r4.text}"
    print("✅ Scenario 4 PASSED: Owner 1 blocked with 403 Forbidden when updating Owner 2's product.")

    # -------------------------------------------------------------
    # Scenario 5: Owner 1 can delete their own product
    # -------------------------------------------------------------
    r5 = client.delete(
        f"/products/{o1_new_prod_id}",
        headers=o1_auth,
    )
    assert r5.status_code == 204, f"Expected 204, got {r5.status_code}: {r5.text}"
    print("✅ Scenario 5 PASSED: Owner 1 successfully deleted their own product.")

    # -------------------------------------------------------------
    # Scenario 6: Owner 1 cannot delete Owner 2's product (403 Forbidden)
    # -------------------------------------------------------------
    r6 = client.delete(
        f"/products/{data['owner2']['prod_id']}",
        headers=o1_auth,
    )
    assert r6.status_code == 403, f"Expected 403, got {r6.status_code}: {r6.text}"
    print("✅ Scenario 6 PASSED: Owner 1 blocked with 403 Forbidden when deleting Owner 2's product.")

    # -------------------------------------------------------------
    # Scenario 7: Owner 2 cannot access Owner 1's private shop management (403 Forbidden)
    # -------------------------------------------------------------
    r7 = client.put(
        f"/shops/{data['owner1']['shop_id']}",
        headers=o2_auth,
        json={"name": "Hacked Shop A"},
    )
    assert r7.status_code == 403, f"Expected 403, got {r7.status_code}: {r7.text}"
    print("✅ Scenario 7 PASSED: Owner 2 blocked with 403 Forbidden from modifying Owner 1's shop.")

    # -------------------------------------------------------------
    # Scenario 8: Customer (Role 0) cannot perform product management operations
    # -------------------------------------------------------------
    dummy_img = ("test.png", io.BytesIO(b"fake image data"), "image/png")
    r8_create = client.post(
        "/products",
        headers=c_auth,
        data={"name": "Customer Product", "price": "10.00", "stock": "1", "category": "Test"},
        files={"image": dummy_img},
    )
    assert r8_create.status_code == 403, f"Expected 403, got {r8_create.status_code}"

    r8_update = client.put(
        f"/products/{data['owner1']['prod_id']}",
        headers=c_auth,
        data={"name": "Customer Tamper"},
    )
    assert r8_update.status_code == 403, f"Expected 403, got {r8_update.status_code}"

    r8_delete = client.delete(
        f"/products/{data['owner1']['prod_id']}",
        headers=c_auth,
    )
    assert r8_delete.status_code == 403, f"Expected 403, got {r8_delete.status_code}"
    print("✅ Scenario 8 PASSED: Customer (Role 0) blocked with 403 on create, update, and delete.")

    # -------------------------------------------------------------
    # Scenario 9: Super Admin (Role 2) has full management access across all shops
    # -------------------------------------------------------------
    # 9a. Super Admin can update Owner 2's product
    r9_up = client.put(
        f"/products/{data['owner2']['prod_id']}",
        headers=sa_auth,
        data={"name": "Product B1 - SuperAdmin Verified", "price": "55.00"},
    )
    assert r9_up.status_code == 200, f"Expected 200, got {r9_up.status_code}: {r9_up.text}"
    assert r9_up.json()["name"] == "Product B1 - SuperAdmin Verified"

    # 9b. Super Admin can view all users
    r9_users = client.get("/users", headers=sa_auth)
    assert r9_users.status_code == 200
    assert len(r9_users.json()) >= 4

    # Non-superadmin cannot view all users (403)
    r9_users_blocked = client.get("/users", headers=o1_auth)
    assert r9_users_blocked.status_code == 403

    # 9c. Super Admin can update any shop
    r9_shop = client.put(
        f"/shops/{data['owner1']['shop_id']}",
        headers=sa_auth,
        json={"description": "Super Admin verified description"},
    )
    assert r9_shop.status_code == 200
    assert r9_shop.json()["description"] == "Super Admin verified description"

    # 9d. Super Admin can delete any product
    r9_del = client.delete(
        f"/products/{data['owner2']['prod_id']}",
        headers=sa_auth,
    )
    assert r9_del.status_code == 204
    print("✅ Scenario 9 PASSED: Super Admin (Role 2) can manage all shops, products, and users.")

    print("\n================================================================")
    print("🎉 ALL 9 RBAC & SHOP-LEVEL OWNERSHIP SCENARIOS PASSED 100%!")
    print("================================================================")


if __name__ == "__main__":
    run_tests()
