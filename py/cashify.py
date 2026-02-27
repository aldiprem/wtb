# cashify_handler.py - Handler untuk integrasi Cashify API (VERSI DENGAN PACKAGE ID)
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

# Daftar package ID yang tersedia (untuk validasi)
VALID_PACKAGE_IDS = [
    "id.dana",
    "id.bmri.livinmerchant", 
    "com.gojek.gopaymerchant",
    "com.bca.msb",
    "id.co.bri.merchant",
    "com.shopeepay.merchant.id",
    "id.co.bni.merchant",
    "com.cimbedc",
    "com.orderkuota.app"
]

class CashifyHandler:
    """Handler untuk integrasi dengan Cashify Payment Gateway"""
    
    def __init__(self, license_key=None, webhook_secret=None):
        self.license_key = license_key or DEFAULT_LICENSE_KEY
        self.webhook_secret = webhook_secret
        self.headers = {
            "Content-Type": "application/json",
            "x-license-key": self.license_key,
        }
        print(f"🔧 CashifyHandler initialized with license key: {self.license_key[:10]}...")
    
    def verify_webhook(self, payload, signature):
        """Verifikasi webhook signature dari Cashify"""
        if not self.webhook_secret:
            print("⚠️ No webhook secret configured")
            return False
        try:
            import hmac
            import hashlib
            
            expected = hmac.new(
                self.webhook_secret.encode(),
                json.dumps(payload, sort_keys=True).encode(),
                hashlib.sha256
            ).hexdigest()
            
            result = hmac.compare_digest(signature, expected)
            print(f"🔐 Webhook verification: {result}")
            return result
        except Exception as e:
            print(f"❌ Error verifying webhook: {e}")
            return False
    
    def generate_qris_v2(self, amount, qr_id=None, package_ids=None, expired_minutes=30):
        """
        Generate QRIS menggunakan API v2 Cashify
        Args:
            amount: nominal deposit
            qr_id: QRIS ID yang sudah didaftarkan di Cashify (WAJIB)
            package_ids: list of package IDs (contoh: ["id.dana", "com.gojek.gopaymerchant"])
            expired_minutes: waktu expired dalam menit
        Returns: dict dengan data QRIS
        """
        # VALIDASI: qr_id HARUS ADA
        if not qr_id:
            return {
                "success": False,
                "error": "QRIS ID tidak ditemukan. Daftarkan QRIS statis terlebih dahulu di Cashify"
            }
        
        # Gunakan package_ids default jika tidak disediakan
        if not package_ids or not isinstance(package_ids, list) or len(package_ids) == 0:
            package_ids = ["com.gojek.gopaymerchant"]
        
        # Validasi package_ids
        valid_packages = []
        for pid in package_ids:
            if pid in VALID_PACKAGE_IDS:
                valid_packages.append(pid)
            else:
                print(f"⚠️ Warning: Invalid package ID '{pid}' ignored")
        
        if len(valid_packages) == 0:
            valid_packages = ["com.gojek.gopaymerchant"]
            print("⚠️ No valid package IDs, using default GoPay Merchant")
        
        payload = {
            "qr_id": qr_id,
            "amount": amount,
            "useUniqueCode": True,
            "packageIds": valid_packages,
            "expiredInMinutes": expired_minutes,
            "qrType": "dynamic",
            "paymentMethod": "qris",
            "useQris": True
        }

        print(f"📤 Sending request to Cashify: {CASHIFY_QRIS_V2_URL}")
        print(f"📦 Payload: {json.dumps(payload, indent=2)}")
        print(f"🔑 Using QRIS ID: {qr_id}")
        print(f"📦 Package IDs: {valid_packages}")

        try:
            resp = requests.post(
                CASHIFY_QRIS_V2_URL,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            
            print(f"📥 Cashify response status: {resp.status_code}")
            
            if resp.status_code != 200:
                error_text = resp.text
                print(f"❌ Cashify HTTP error: {error_text}")
                return {
                    "success": False, 
                    "error": f"HTTP {resp.status_code}: {error_text[:200]}"
                }
            
            try:
                data = resp.json()
                print(f"📊 Cashify response: {json.dumps(data, indent=2)[:500]}")
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
                return {
                    "success": False,
                    "error": f"Invalid JSON response: {resp.text[:200]}"
                }
            
            if data.get("status") == 200 and "data" in data:
                print("✅ QRIS generated successfully")
                return {
                    "success": True, 
                    "data": data["data"]
                }
            else:
                error_msg = data.get("message", "Unknown error")
                status_code = data.get("status", 400)
                print(f"❌ Cashify API error ({status_code}): {error_msg}")
                return {
                    "success": False, 
                    "error": f"Cashify error: {error_msg}"
                }
                
        except requests.exceptions.ConnectionError as e:
            print(f"❌ Connection error: {e}")
            return {
                "success": False, 
                "error": "Cannot connect to Cashify server"
            }
        except requests.exceptions.Timeout as e:
            print(f"❌ Timeout error: {e}")
            return {
                "success": False, 
                "error": "Cashify server timeout"
            }
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
            return {
                "success": False, 
                "error": str(e)
            }
    
    def check_status(self, transaction_id):
        """
        Cek status transaksi berdasarkan transaction ID
        """
        payload = {"transactionId": transaction_id}

        print(f"📤 Checking status for transaction: {transaction_id}")

        try:
            resp = requests.post(
                CASHIFY_CHECK_STATUS_URL,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            
            if resp.status_code != 200:
                error_text = resp.text
                print(f"❌ Status check HTTP error: {error_text}")
                return {
                    "success": False, 
                    "error": f"HTTP {resp.status_code}: {error_text[:200]}"
                }
            
            data = resp.json()
            print(f"📊 Status response: {json.dumps(data, indent=2)}")
            
            if data.get("status") == 200 and "data" in data:
                return {
                    "success": True, 
                    "data": data["data"]
                }
            else:
                return {
                    "success": False, 
                    "error": f"Invalid response: {data.get('message', 'Unknown')}"
                }
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Status check error: {e}")
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
        url = f"{QR_STYLISH_URL}?{urllib.parse.urlencode(params)}"
        print(f"🔗 QR image URL built: {url[:100]}...")
        return url
    
    def format_response(self, cashify_data):
        """
        Format response dari Cashify ke format yang konsisten
        """
        if not cashify_data or not cashify_data.get("success"):
            print("⚠️ Cannot format unsuccessful response")
            return cashify_data
        
        try:
            data = cashify_data["data"]
            
            # Generate QR image URL
            qr_image_url = self.build_qr_image_url(data.get("qr_string", ""))
            
            formatted = {
                "success": True,
                "transaction_id": data.get("transactionId"),
                "reference_id": data.get("referenceId"),
                "original_amount": data.get("originalAmount"),
                "total_amount": data.get("totalAmount"),
                "unique_nominal": data.get("uniqueNominal"),
                "package_ids": data.get("packageIds", []),
                "qr_string": data.get("qr_string"),
                "qr_image_url": qr_image_url,
                "expired_at": data.get("expiredAt"),
                "raw_data": data
            }
            print(f"✅ Response formatted successfully")
            return formatted
        except Exception as e:
            print(f"❌ Error formatting response: {e}")
            raise