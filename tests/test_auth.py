# tests/test_auth.py

import pytest
from fastapi.testclient import TestClient
import sys
import os
# 将项目根目录添加到 sys.path 中
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from api.main import app  # 导入 FastAPI 实例
from admin.models import User
from admin.database import SessionLocal
from admin.utils.security import hash_password

# 创建一个 TestClient 实例
client = TestClient(app)

# 模拟数据库会话
@pytest.fixture(scope="function")
def db_session():
    # 在每个测试之前创建一个新的 DB 会话
    db = SessionLocal()
    yield db
    db.close()  # 测试后关闭数据库会话

# 测试注册功能
# def test_register(db_session):
#     # 注册数据
#     data = {
#         "username": "admin",
#         "email": "admin@example.com",
#         "password": "admin123",
#     }

#     response = client.post("/auth/register", json=data)
#     print(response.json())
#     assert response.status_code == 201
#     assert response.json()["username"] == data["username"]

#     # 验证数据库中是否插入了用户
#     user = db_session.query(User).filter(User.username == data["username"]).first()
#     assert user is not None
#     assert user.username == data["username"]

# 测试登录功能
def test_login(db_session):
    # 先注册一个用户
    data = {
        "username": "admin",
        "email": "admin@example.com",
        "password": "admin123",
    }
    client.post("/auth/register", json=data)

    # 登录请求数据
    login_data = {
        "username": "admin",
        "password": "admin123",
    }

    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()

    # 获取返回的 JWT 令牌
    token = response.json()["access_token"]
    assert token is not None

# 测试 JWT 鉴权
def test_jwt_auth(db_session):
    # 先注册并登录
    data = {
        "username": "admin",
        "email": "admin@example.com",
        "password": "admin123",
    }
    client.post("/auth/register", json=data)

    login_data = {
        "username": "admin",
        "password": "admin123",
    }
    response = client.post("/auth/login", data=login_data)
    token = response.json()["access_token"]

    # 使用 JWT 令牌进行受保护的请求
    response = client.get("/auth/protected", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {
        "message": "Protected data access granted"
    }
    print(response)

