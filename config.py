import os
from dotenv import load_dotenv

load_dotenv()

# Telegram API
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
PHONE_NUMBER = os.getenv('PHONE_NUMBER')

# Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Database
DATABASE_URL = 'sqlite:///ai.db'

OWNER_ID = int(os.getenv('OWNER_ID', '0'))

CHECK_INTERVAL = 0.1
