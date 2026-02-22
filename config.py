import os
from dotenv import load_dotenv

load_dotenv()

API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
PHONE_NUMBER = os.getenv('PHONE_NUMBER')

CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
CLOUDFLARE_API_TOKEN = os.getenv('CLOUDFLARE_API_TOKEN')

DATABASE_URL = 'sqlite:///ai.db'  # tidak dipakai tapi untuk kompatibilitas

OWNER_ID = int(os.getenv('OWNER_ID', '0'))

CHECK_INTERVAL = 0.1

# PAKAI GEMMA 3 (SUPPORT BAHASA INDONESIA)
CLOUDFLARE_MODEL = "@cf/google/gemma-3-12b-it"
