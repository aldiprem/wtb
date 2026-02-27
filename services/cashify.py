# cashify_handler.py - Handler untuk integrasi Cashify API
import requests
import json
import uuid
import urllib.parse
from datetime import datetime, timedelta

# Konfigurasi Cashify
CASHIFY_QRIS_V2_URL = "https://cashify.my.id/api/generate/v2/qris"
CASHIFY_CHECK_STATUS_URL = "https://cashify.my.id/api/generate/check-status"
QR_STYLISH_URL = "https://larabert-qrgen.hf.space/v1/create-qr-code"

# Default license key (bisa di-override per website)
DEFAULT_LICENSE_KEY = "cashify_2861a98069d596a1bf38a5aa794660a3a2bc0a4ff92478248dfacf488829a1d5"

class CashifyHandler:
    """Handler untuk integrasi dengan Cashify Payment Gateway"""
    
    def __init__(self, license_key=None, webhook_secret=None):
        self.license_key = license_key or DEFAULT_LICENSE_KEY
        self.webhook_secret = webhook_secret
        self.headers = {
            "Content-Type": "application/json",
            "x-license-key": self.license_key,
        }
    
    def verify_webhook(self, payload, signature):
        """Verifikasi webhook signature dari Cashify"""
        if not self.webhook_secret:
            return False
        import hmac
        import hashlib
        import json
        
        expected = hmac.new(
            self.webhook_secret.encode(),
            json.dumps(payload).encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected)
    
    def generate_qris_v2(self, amount, qr_id=None, expired_minutes=30):
        """
        Generate QRIS menggunakan API v2 Cashify
        Returns: dict dengan data QRIS
        """
        if qr_id is None:
            qr_id = str(uuid.uuid4())
        
        payload = {
            "qr_id": qr_id,
            "amount": amount,
            "useUniqueCode": True,
            "packageIds": ["com.gojek.gopaymerchant"],
            "expiredInMinutes": expired_minutes,
            "qrType": "dynamic",
            "paymentMethod": "qris",
            "useQris": True
        }

        try:
            resp = requests.post(
                CASHIFY_QRIS_V2_URL,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            
            if resp.status_code != 200:
                return {
                    "success": False, 
                    "error": f"HTTP {resp.status_code}: {resp.text}"
                }
            
            data = resp.json()
            
            if data.get("status") == 200 and "data" in data:
                return {
                    "success": True, 
                    "data": data["data"]
                }
            else:
                return {
                    "success": False, 
                    "error": f"Respon tidak valid: {data}"
                }
                
        except requests.exceptions.RequestException as e:
            return {
                "success": False, 
                "error": str(e)
            }
    
    def check_status(self, transaction_id):
        """
        Cek status transaksi berdasarkan transaction ID
        """
        payload = {"transactionId": transaction_id}

        try:
            resp = requests.post(
                CASHIFY_CHECK_STATUS_URL,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            
            if resp.status_code != 200:
                return {
                    "success": False, 
                    "error": f"HTTP {resp.status_code}: {resp.text}"
                }
            
            data = resp.json()
            
            if data.get("status") == 200 and "data" in data:
                return {
                    "success": True, 
                    "data": data["data"]
                }
            else:
                return {
                    "success": False, 
                    "error": f"Respon tidak valid: {data}"
                }
                
        except requests.exceptions.RequestException as e:
            return {
                "success": False, 
                "error": str(e)
            }
    
    def build_qr_image_url(self, qr_string, size=500, style=3, color="40A7E3"):
        """
        Build URL untuk generate QR code stylish
        """
        params = {
            "size": f"{size}x{size}",
            "style": str(style),
            "color": color.replace('#', ''),
            "data": qr_string
        }
        return f"{QR_STYLISH_URL}?{urllib.parse.urlencode(params)}"
    
    def format_response(self, cashify_data):
        """
        Format response dari Cashify ke format yang konsisten
        """
        if not cashify_data or not cashify_data.get("success"):
            return cashify_data
        
        data = cashify_data["data"]
        
        # Generate QR image URL
        qr_image_url = self.build_qr_image_url(data.get("qr_string", ""))
        
        return {
            "success": True,
            "transaction_id": data.get("transactionId"),
            "reference_id": data.get("referenceId"),
            "original_amount": data.get("originalAmount"),
            "total_amount": data.get("totalAmount"),
            "unique_nominal": data.get("uniqueNominal"),
            "qr_string": data.get("qr_string"),
            "qr_image_url": qr_image_url,
            "expired_at": data.get("expiredAt"),
            "raw_data": data
        }
