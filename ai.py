import requests
import json
import re
from datetime import datetime
from loguru import logger
from database import Memory, Conversation
from config import CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_MODEL

class AIEngine:
    def __init__(self):
        """Inisialisasi Cloudflare AI"""
        self.account_id = CLOUDFLARE_ACCOUNT_ID
        self.api_token = CLOUDFLARE_API_TOKEN
        self.model = CLOUDFLARE_MODEL
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/"
        
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"✅ Cloudflare AI initialized with model: {self.model}")
    
    def _call_cloudflare(self, prompt, system_prompt=None, max_tokens=500):
        """Panggil Cloudflare AI API"""
        try:
            messages = []
            
            default_system = """Anda adalah asisten untuk bisnis jualan produk digital di Telegram.
Gunakan bahasa Indonesia yang santai, seperti orang biasa ngobrol.
Jangan terlalu formal, boleh pakai emoji.
Fokus pada membantu pelanggan dengan informasi yang sudah diajarkan owner."""
            
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            else:
                messages.append({"role": "system", "content": default_system})
            
            messages.append({"role": "user", "content": prompt})
            
            response = requests.post(
                f"{self.base_url}{self.model}",
                headers=self.headers,
                json={
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.7
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success') and result.get('result'):
                    return result['result']['response']
                else:
                    logger.error(f"Cloudflare API error: {result.get('errors')}")
                    return None
            else:
                logger.error(f"HTTP Error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error calling Cloudflare AI: {e}")
            return None
    
    def _extract_json(self, text):
        """Ekstrak JSON dari teks"""
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json_match.group()
        return text
    
    def process_owner_message(self, message_text):
        """
        Proses pesan dari OWNER - SEMUA DISIMPAN sebagai memori
        """
        try:
            # Simpan pesan owner
            user_msg_id = Conversation.create('user', message_text)
            
            # Analisis untuk kategorisasi memori
            analysis_prompt = f"""
Pesan dari OWNER: "{message_text}"

Analisis pesan ini dan kategorikan:
1. Apa jenis informasinya? (product/price/payment/schedule/rule/general)
2. Buat ringkasan singkat
3. Kata kunci penting

Format JSON:
{{
    "category": "product/price/payment/schedule/rule/general",
    "summary": "ringkasan singkat",
    "keywords": ["kata1", "kata2"]
}}
"""
            analysis_response = self._call_cloudflare(analysis_prompt, max_tokens=200)
            
            if analysis_response:
                try:
                    json_str = self._extract_json(analysis_response)
                    analysis = json.loads(json_str)
                    category = analysis.get('category', 'general')
                    summary = analysis.get('summary', message_text[:50])
                except:
                    category = 'general'
                    summary = message_text[:50]
            else:
                category = 'general'
                summary = message_text[:50]
            
            # Simpan ke memori
            Memory.create(
                memory_type='owner_info',
                content=f"Owner: {message_text}",
                category=category,
                source_conversation_id=user_msg_id
            )
            
            confirmation = f"📝 Saya simpan sebagai: {category} - {summary}"
            Conversation.create('assistant', confirmation)
            
            return confirmation
            
        except Exception as e:
            logger.error(f"Error di process_owner_message: {e}")
            return f"Maaf, error: {str(e)}"
    
    def process_buyer_message(self, message_text, sender_id, chat_info):
        """
        Proses pesan dari BUYER - Jawab berdasarkan memori owner
        """
        try:
            # Simpan pesan buyer
            Conversation.create('user', message_text, {"sender": sender_id, "type": "buyer"})
            
            # Ambil semua memori owner
            all_memories = Memory.get_all(100)
            
            if not all_memories:
                return "Maaf, saya masih baru. Owner belum mengajari saya apa-apa."
            
            # Konteks memori
            memories_context = "\n".join([
                f"[{m['category']}] {m['content']}" 
                for m in all_memories
            ])
            
            # Prompt untuk menjawab pertanyaan buyer
            answer_prompt = f"""
Pertanyaan dari pelanggan: "{message_text}"

INILAH SEMUA INFORMASI YANG DIAJARKAN OWNER:
{memories_context}

Tugas:
1. Jawab pertanyaan pelanggan HANYA dengan informasi dari memori di atas
2. Jika tidak ada informasi yang relevan, katakan "Maaf, saya belum tahu. Silakan tanya hal lain."
3. Gunakan bahasa santai, ramah, seperti orang biasa
4. Jika ada informasi harga/jam/metode pembayaran, sertakan
5. JANGAN mengada-ada atau menambahkan informasi baru

JAWABAN:
"""
            response = self._call_cloudflare(answer_prompt, max_tokens=500)
            
            if response:
                # Simpan respons AI
                Conversation.create('assistant', response, {"to": sender_id})
                return response.strip()
            else:
                return "Maaf, saya sedang sibuk. Coba lagi nanti ya."
                
        except Exception as e:
            logger.error(f"Error di process_buyer_message: {e}")
            return "Maaf, terjadi error. Tim kami akan segera memperbaiki."
    
    def should_respond_to_wtb(self, wtb_message, channel_name):
        """Memutuskan apakah perlu respon untuk WTB"""
        try:
            all_memories = Memory.get_all(50)
            
            if not all_memories:
                return {"should_respond": False, "reason": "Belum diajarkan apapun"}
            
            memories_text = "\n".join([f"- {m['content'][:200]}" for m in all_memories])
            
            prompt = f"""
Pesan WTB dari channel {channel_name}:
"{wtb_message}"

PRODUK YANG DIJUAL (dari memori owner):
{memories_text}

Tugas: Apakah pesan WTB ini mencari produk yang SESUAI dengan yang dijual?
Jika iya, produk APA?
Jika TIDAK, jawab "TIDAK".

Format JSON:
{{
    "should_respond": true/false,
    "product": "nama produk jika cocok, null jika tidak",
    "reason": "penjelasan singkat"
}}
"""
            response = self._call_cloudflare(prompt, max_tokens=300)
            
            if response:
                try:
                    json_str = self._extract_json(response)
                    result = json.loads(json_str)
                    return result
                except:
                    return {"should_respond": False, "reason": "Gagal parse response"}
            else:
                return {"should_respond": False, "reason": "Tidak ada response dari AI"}
                
        except Exception as e:
            logger.error(f"Error di should_respond: {e}")
            return {"should_respond": False, "reason": f"Error: {str(e)}"}
    
    def generate_response(self, wtb_message, product_name, channel_name):
        """Generate respons promosi untuk WTB"""
        try:
            memories = Memory.search(product_name, 20)
            
            memories_text = "\n".join([f"- {m['content']}" for m in memories]) if memories else "Tidak ada memori spesifik"
            
            prompt = f"""
Pesan WTB: "{wtb_message}"
Channel: {channel_name}
Produk yang cocok: {product_name}

INFORMASI PRODUK DARI MEMORI:
{memories_text}

TUGAS:
Buat RESPON PROMOSI dengan aturan:
1. HANYA gunakan informasi dari memori di atas
2. JANGAN menambahkan informasi baru
3. Bahasa santai, seperti orang biasa ngobrol
4. Singkat dan to the point (max 200 karakter)
5. Sertakan harga/jam/metode pembayaran jika ada
6. JANGAN OOT

RESPON LANGSUNG:
"""
            response = self._call_cloudflare(prompt, max_tokens=300)
            
            if response:
                return response.strip()
            else:
                return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
                
        except Exception as e:
            logger.error(f"Error di generate_response: {e}")
            return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
