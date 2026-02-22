from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
from config import DATABASE_URL

Base = declarative_base()
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

class Conversation(Base):
    """SEMUA PERCAKAPAN ANDA DENGAN AI - INI OTAKNYA"""
    __tablename__ = 'conversations'

    id = Column(Integer, primary_key=True)
    role = Column(String(10))  # 'user' atau 'assistant'
    message = Column(Text)
    context = Column(Text)  # JSON untuk metadata
    created_at = Column(DateTime, default=datetime.now)

class Memory(Base):
    """MEMORI TENTANG PRODUK DAN CARA PROMOSI"""
    __tablename__ = 'memories'

    id = Column(Integer, primary_key=True)
    memory_type = Column(String(50))  # 'product_intro', 'pricelist', 'promo_style', 'rule'
    content = Column(Text)
    source_conversation_id = Column(Integer)  # Link ke percakapan asli
    created_at = Column(DateTime, default=datetime.now)

def init_db():
    """Buat tabel KOSONG"""
    Base.metadata.create_all(engine)
    print("✅ Database kosong siap diisi")
