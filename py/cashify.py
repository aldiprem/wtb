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

# Mapping package ID ke nama aplikasi
PACKAGE_NAMES = {
    "id.dana": "DANA",
    "id.bmri.livinmerchant": "Livin Mandiri",
    "com.gojek.gopaymerchant": "GoPay",
    "com.bca.msb": "BCA Mobile",
    "id.co.bri.merchant": "BRI Mobile",
    "com.shopeepay.merchant.id": "ShopeePay",
    "id.co.bni.merchant": "BNI Mobile",
    "com.cimbedc": "CIMB Niaga",
    "com.orderkuota.app": "Order Kuota"
}

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
            
            # Pastikan payload adalah dictionary
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except:
                    payload = {}
            
            expected = hmac.new(
                self.webhook_secret.encode('utf-8'),
                json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            result = hmac.compare_digest(signature, expected)
            print(f"🔐 Webhook verification: {result}")
            return result
        except Exception as e:
            print(f"❌ Error verifying webhook: {e}")
            return False
    
    def validate_package_ids(self, package_ids):
        """
        Validasi package IDs, mengembalikan list package IDs yang valid
        """
        if not package_ids or not isinstance(package_ids, list):
            return ["com.gojek.gopaymerchant"]
        
        valid_packages = []
        for pid in package_ids:
            if pid in VALID_PACKAGE_IDS:
                valid_packages.append(pid)
            else:
                print(f"⚠️ Warning: Invalid package ID '{pid}' ignored")
        
        if len(valid_packages) == 0:
            valid_packages = ["com.gojek.gopaymerchant"]
            print("⚠️ No valid package IDs, using default GoPay Merchant")
        
        return valid_packages
    
    def get_package_names(self, package_ids):
        """
        Mendapatkan nama aplikasi dari package IDs
        """
        names = []
        for pid in package_ids:
            if pid in PACKAGE_NAMES:
                names.append(PACKAGE_NAMES[pid])
            else:
                names.append(pid)
        return names
    
    def generate_qris_v2(self, amount, qr_id=None, package_ids=None, expired_minutes=30):
        """
        Generate QRIS menggunakan API v2 Cashify
        Args:
            amount: nominal deposit (dalam rupiah)
            qr_id: QRIS ID yang sudah didaftarkan di Cashify (WAJIB)
            package_ids: list of package IDs (contoh: ["id.dana", "com.gojek.gopaymerchant"])
            expired_minutes: waktu expired dalam menit
        Returns: dict dengan data QRIS
        """
        # VALIDASI: qr_id HARUS ADA
        if not qr_id:
            return {
                "success": False,
                "error": "QRIS ID tidak ditemukan. Daftarkan QRIS statis terlebih dahulu di Cashify",
                "error_code": "MISSING_QRIS_ID"
            }
        
        # Validasi amount
        try:
            amount = int(amount)
            if amount <= 0:
                return {
                    "success": False,
                    "error": "Nominal harus lebih dari 0",
                    "error_code": "INVALID_AMOUNT"
                }
        except (ValueError, TypeError):
            return {
                "success": False,
                "error": "Nominal tidak valid",
                "error_code": "INVALID_AMOUNT"
            }
        
        # Validasi package_ids
        valid_packages = self.validate_package_ids(package_ids)
        
        # Validasi expired_minutes
        try:
            expired_minutes = int(expired_minutes)
            if expired_minutes < 1:
                expired_minutes = 1
            if expired_minutes > 1440:
                expired_minutes = 1440
        except (ValueError, TypeError):
            expired_minutes = 30
        
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
        print(f"📦 Package Names: {self.get_package_names(valid_packages)}")

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
                    "error": f"HTTP {resp.status_code}: {error_text[:200]}",
                    "error_code": "HTTP_ERROR"
                }
            
            try:
                data = resp.json()
                print(f"📊 Cashify response: {json.dumps(data, indent=2)[:500]}")
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
                return {
                    "success": False,
                    "error": f"Invalid JSON response: {resp.text[:200]}",
                    "error_code": "INVALID_JSON"
                }
            
            if data.get("status") == 200 and "data" in data:
                print("✅ QRIS generated successfully")
                return {
                    "success": True, 
                    "data": data["data"],
                    "package_ids": valid_packages,
                    "package_names": self.get_package_names(valid_packages)
                }
            else:
                error_msg = data.get("message", "Unknown error")
                status_code = data.get("status", 400)
                print(f"❌ Cashify API error ({status_code}): {error_msg}")
                return {
                    "success": False, 
                    "error": f"Cashify error: {error_msg}",
                    "error_code": "API_ERROR",
                    "api_status": status_code
                }
                
        except requests.exceptions.ConnectionError as e:
            print(f"❌ Connection error: {e}")
            return {
                "success": False, 
                "error": "Cannot connect to Cashify server",
                "error_code": "CONNECTION_ERROR"
            }
        except requests.exceptions.Timeout as e:
            print(f"❌ Timeout error: {e}")
            return {
                "success": False, 
                "error": "Cashify server timeout",
                "error_code": "TIMEOUT"
            }
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
            return {
                "success": False, 
                "error": str(e),
                "error_code": "REQUEST_ERROR"
            }
    
    def check_status(self, transaction_id):
        """
        Cek status transaksi berdasarkan transaction ID
        """
        if not transaction_id:
            return {
                "success": False,
                "error": "Transaction ID tidak ditemukan",
                "error_code": "MISSING_TRANSACTION_ID"
            }
        
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
                    "error": f"HTTP {resp.status_code}: {error_text[:200]}",
                    "error_code": "HTTP_ERROR"
                }
            
            data = resp.json()
            print(f"📊 Status response: {json.dumps(data, indent=2)}")
            
            if data.get("status") == 200 and "data" in data:
                transaction_data = data["data"]
                return {
                    "success": True, 
                    "data": transaction_data,
                    "status": transaction_data.get("status"),
                    "amount": transaction_data.get("amount"),
                    "paid_at": transaction_data.get("paidAt")
                }
            else:
                error_msg = data.get("message", "Unknown error")
                return {
                    "success": False, 
                    "error": f"Invalid response: {error_msg}",
                    "error_code": "INVALID_RESPONSE"
                }
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Status check error: {e}")
            return {
                "success": False, 
                "error": str(e),
                "error_code": "REQUEST_ERROR"
            }
    
    def build_qr_image_url(self, qr_string, size=500, style=3, color="40A7E3"):
        """
        Build URL untuk generate QR code stylish
        Args:
            qr_string: string QR code
            size: ukuran QR code (harus persegi)
            style: style QR code (1-6)
            color: warna QR code (tanpa #)
        """
        if not qr_string:
            return None
        
        # Hapus tanda # dari color jika ada
        color = color.replace('#', '')
        
        params = {
            "size": f"{size}x{size}",
            "style": str(style),
            "color": color,
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
            package_ids = cashify_data.get("package_ids", [])
            
            # Generate QR image URL
            qr_image_url = self.build_qr_image_url(
                data.get("qr_string", ""),
                color=data.get("qr_color", "40A7E3")
            )
            
            # Parse expired_at
            expired_at = data.get("expiredAt")
            expired_timestamp = None
            if expired_at:
                try:
                    # Coba parse ISO format
                    expired_timestamp = datetime.fromisoformat(expired_at.replace('Z', '+00:00'))
                except:
                    expired_timestamp = expired_at
            
            formatted = {
                "success": True,
                "transaction_id": data.get("transactionId"),
                "reference_id": data.get("referenceId"),
                "original_amount": data.get("originalAmount"),
                "total_amount": data.get("totalAmount"),
                "unique_nominal": data.get("uniqueNominal"),
                "package_ids": package_ids,
                "package_names": cashify_data.get("package_names", []),
                "qr_string": data.get("qr_string"),
                "qr_image_url": qr_image_url,
                "expired_at": expired_at,
                "expired_timestamp": expired_timestamp,
                "raw_data": data
            }
            print(f"✅ Response formatted successfully")
            return formatted
        except Exception as e:
            print(f"❌ Error formatting response: {e}")
            import traceback
            traceback.print_exc()
            return cashify_data

# ==================== FUNGSI UTILITY ====================

def get_available_package_ids():
    """
    Mendapatkan daftar package ID yang tersedia
    """
    return [
        {"id": pid, "name": PACKAGE_NAMES.get(pid, pid)}
        for pid in VALID_PACKAGE_IDS
    ]

def validate_package_id(package_id):
    """
    Validasi apakah package ID valid
    """
    return package_id in VALID_PACKAGE_IDS

def get_package_name(package_id):
    """
    Mendapatkan nama package dari ID
    """
    return PACKAGE_NAMES.get(package_id, package_id)