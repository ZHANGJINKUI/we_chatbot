from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker,declarative_base

# 替换为你的 MySQL 配置
DATABASE_URL = "mysql+pymysql://root:oneapimmysql@172.18.0.1:3306/user_management?charset=utf8mb4"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# FastAPI 用
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()