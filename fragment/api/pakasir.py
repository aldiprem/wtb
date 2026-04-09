# fragment/api/pakasir.py
import os
import logging
import requests
import secrets
from datetime import datetime

logger = logging.getLogger(__name__)

# Konfigurasi Pakasir dari environment
PAKASIR_SLUG = os.environ.get('PAKASIR_SLUG', 'payment-aldi')
PAKASIR_API_KEY = os.environ.get('PAKASIR_API_KEY', '')
PAKASIR_BASE_URL = "https://pakasir.com/api/v1"


def generate_order_id() -> str:
    """Generate unique order ID with 35 characters"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = secrets.token_hex(12)[:20]
    order_id = f"FRAG_{timestamp}_{random_part}"[:35]
    return order_id


def create_pakasir_payment(amount: int, order_id: str, customer_name: str = None, customer_email: str = None) -> dict:
    """Create payment via Pakasir API"""
    if not PAKASIR_API_KEY:
        logger.error("PAKASIR_API_KEY not configured")
        return None
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": PAKASIR_API_KEY
    }
    
    payload = {
        "amount": amount,
        "reference_id": order_id,
        "customer_name": customer_name or "Fragment Bot Customer",
        "customer_email": customer_email or "customer@fragmentbot.com",
        "expired_duration": 86400,
        "payment_methods": ["QRIS"]
    }
    
    try:
        url = f"{PAKASIR_BASE_URL}/payment/{PAKASIR_SLUG}/create"
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Pakasir payment created: {order_id}")
            return result
        else:
            logger.error(f"Pakasir API error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Error creating Pakasir payment: {e}")
        return None


def check_pakasir_payment(order_id: str) -> dict:
    """Check payment status via Pakasir API"""
    if not PAKASIR_API_KEY:
        logger.error("PAKASIR_API_KEY not configured")
        return None
    
    headers = {
        "Accept": "application/json",
        "X-Api-Key": PAKASIR_API_KEY
    }
    
    try:
        url = f"{PAKASIR_BASE_URL}/payment/{PAKASIR_SLUG}/status"
        response = requests.get(url, params={"reference_id": order_id}, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Pakasir payment status for {order_id}: {result.get('data', {}).get('status')}")
            return result
        else:
            logger.error(f"Pakasir API error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Error checking Pakasir payment: {e}")
        return None