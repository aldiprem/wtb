import os
from dotenv import load_dotenv

load_dotenv()

# Telegram API (teknis, bukan konten)
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
PHONE_NUMBER = os.getenv('PHONE_NUMBER')

# Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Database
DATABASE_URL = 'sqlite:///ai.db'

# Interval cek pesan
CHECK_INTERVAL = 15  # detik
