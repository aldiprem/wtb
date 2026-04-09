# fragment/api/pakasir.py
import os
import logging
import requests
import secrets
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Konfigurasi Pakasir dari environment
PAKASIR_SLUG = os.environ.get('PAKASIR_SLUG', 'payment-aldi')
PAKASIR_API_KEY = os.environ.get('PAKASIR_API_KEY', '')
PAKASIR_BASE_URL = "https://app.pakasir.com/api"


def generate_order_id() -> str:
    """Generate unique order ID with 35 characters"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = secrets.token_hex(12)[:20]
    order_id = f"FRAG_{timestamp}_{random_part}"[:35]
    return order_id


def create_pakasir_payment(amount: int, order_id: str, customer_name: str = None, customer_email: str = None) -> dict:
    """
    Create payment via Pakasir API
    Berdasarkan dokumentasi: POST https://app.pakasir.com/api/transactioncreate/{method}
    """
    if not PAKASIR_API_KEY:
        logger.error("PAKASIR_API_KEY not configured")
        return None
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    payload = {
        "project": PAKASIR_SLUG,
        "order_id": order_id,
        "amount": amount,
        "api_key": PAKASIR_API_KEY
    }
    
    # Coba dengan metode QRIS
    methods = ["qris", "bri_va", "bni_va", "permata_va"]
    
    for method in methods:
        try:
            url = f"{PAKASIR_BASE_URL}/transactioncreate/{method}"
            logger.info(f"Creating payment with method {method}: {url}")
            
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Pakasir payment created: {order_id} with method {method}")
                
                # Extract payment data
                payment_data = result.get('payment', {})
                
                return {
                    "success": True,
                    "data": {
                        "id": payment_data.get('order_id', order_id),
                        "amount": payment_data.get('amount', amount),
                        "total_payment": payment_data.get('total_payment', amount),
                        "reference_id": payment_data.get('order_id', order_id),
                        "payment_method": payment_data.get('payment_method', method),
                        "payment_number": payment_data.get('payment_number', ''),
                        "qr_string": payment_data.get('payment_number', ''),  # QR string untuk QRIS
                        "qris_string": payment_data.get('payment_number', ''),
                        "expired_at": payment_data.get('expired_at', (datetime.now() + timedelta(hours=24)).isoformat()),
                        "status": "PENDING"
                    }
                }
            else:
                logger.warning(f"Method {method} failed: {response.status_code} - {response.text}")
        except Exception as e:
            logger.warning(f"Error with method {method}: {e}")
    
    logger.error("All Pakasir payment methods failed")
    return None


def check_pakasir_payment(order_id: str) -> dict:
    """
    Check payment status via Pakasir API
    Berdasarkan dokumentasi: GET https://app.pakasir.com/api/transactiondetail
    """
    if not PAKASIR_API_KEY:
        logger.error("PAKASIR_API_KEY not configured")
        return None
    
    try:
        url = f"{PAKASIR_BASE_URL}/transactiondetail"
        params = {
            "project": PAKASIR_SLUG,
            "order_id": order_id,
            "api_key": PAKASIR_API_KEY
        }
        
        logger.info(f"Checking payment status: {url}?project={PAKASIR_SLUG}&order_id={order_id}")
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            transaction = result.get('transaction', {})
            status = transaction.get('status', 'pending')
            
            logger.info(f"Payment status for {order_id}: {status}")
            
            return {
                "success": True,
                "data": {
                    "reference_id": transaction.get('order_id', order_id),
                    "status": status.upper(),
                    "amount": transaction.get('amount', 0),
                    "payment_method": transaction.get('payment_method', ''),
                    "completed_at": transaction.get('completed_at', '')
                }
            }
        else:
            logger.error(f"Failed to check payment: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Error checking Pakasir payment: {e}")
        return None


def create_pakasir_payment_url(amount: int, order_id: str, redirect_url: str = None, qris_only: bool = False) -> str:
    """
    Generate payment URL (metode URL redirect)
    Berdasarkan dokumentasi: https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}
    """
    base_url = f"https://app.pakasir.com/pay/{PAKASIR_SLUG}/{amount}"
    params = f"?order_id={order_id}"
    
    if redirect_url:
        params += f"&redirect={redirect_url}"
    
    if qris_only:
        params += "&qris_only=1"
    
    return base_url + params