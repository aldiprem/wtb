import requests
import json
import re
from datetime import datetime
from loguru import logger
from database import Session, Conversation, Memory
from config import CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_MODEL

class AIEngine:
    def __init__(self):
        """Inisialisasi Cloudflare AI"""
        self.account_id = CLOUDFLARE_ACCOUNT_ID
        self.api_token = CLOUDFLARE_API_TOKEN
        self.model = CLOUDFLARE_MODEL
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/"
        
        # Headers untuk Cloudflare API
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"✅ Cloudflare AI initialized with model: {self.model}")
    
    def _call_cloudflare(self, prompt, system_prompt=None, max_tokens=500):
        """
        Panggil Cloudflare AI API
        
        Args:
            prompt: Pesan user
            system_prompt: Instruksi sistem (opsional)
            max_tokens: Maksimal token response
        
        Returns:
            String response dari AI atau None jika error
        """
        try:
            # Siapkan messages
            messages = []
            
            # Default system prompt untuk bisnis
            default_system = """Anda adalah asisten untuk bisnis jualan produk digital di Telegram.
Gunakan bahasa Indonesia yang santai, seperti orang biasa ngobrol.
Jangan terlalu formal, boleh pakai emoji.
Fokus pada produk: voucher game, top up, APK premium, Netflix, dll."""
            
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            else:
                messages.append({"role": "system", "content": default_system})
            
            messages.append({"role": "user", "content": prompt})
            
            # Request ke Cloudflare
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
    
    def process_user_message(self, message_text, is_owner=True):
        """
        Proses pesan dari user
        - is_owner=True: Mode MENGAJAR (simpan ke memori)
        - is_owner=False: Untuk buyer (nanti di handle di fungsi lain)
        """
        session = Session()
        
        try:
            # Simpan pesan ke database
            user_msg = Conversation(
                role='user',
                message=message_text,
                created_at=datetime.now()
            )
            session.add(user_msg)
            session.flush()
            
            # HANYA OWNER yang bisa mengajar
            if is_owner:
                # Ambil memori yang sudah ada
                all_memories = session.query(Memory).order_by(Memory.created_at.desc()).limit(50).all()
                
                # CEK: Apakah ini pertanyaan tentang produk yang sudah diajarkan?
                if all_memories:
                    check_prompt = f"""
Pesan dari OWNER: "{message_text}"

Tugas: Apakah ini PERTANYAAN tentang produk/harga yang SUDAH PERNAH diajarkan?
Atau ini adalah informasi BARU yang harus disimpan?

Memori yang sudah diajarkan:
{chr(10).join([f"- {m.content[:200]}" for m in all_memories[:10]])}

Format JSON WAJIB:
{{
    "is_question": true/false,
    "related_product": "nama produk jika pertanyaan, null jika bukan",
    "reason": "alasan singkat"
}}
"""
                    check_response = self._call_cloudflare(check_prompt, max_tokens=300)
                    
                    if check_response:
                        try:
                            json_str = self._extract_json(check_response)
                            check_result = json.loads(json_str)
                            
                            # KALAU INI PERTANYAAN, JAWAB LANGSUNG
                            if check_result.get("is_question") and check_result.get("related_product"):
                                # Cari memori terkait produk ini
                                product_keyword = check_result["related_product"].lower()
                                product_memories = [
                                    m for m in all_memories 
                                    if product_keyword in m.content.lower()
                                ]
                                
                                answer_prompt = f"""
Pertanyaan dari OWNER: "{message_text}"
Produk yang ditanyakan: {check_result['related_product']}

Memori terkait:
{chr(10).join([f"- {m.content}" for m in product_memories[:5]])}

Tugas: Jawab pertanyaan owner dengan INFORMASI dari memori di atas.
Gunakan bahasa santai, seperti ngobrol biasa.
Jika ada pricelist, sertakan.

JAWABAN:
"""
                                answer = self._call_cloudflare(answer_prompt, max_tokens=500)
                                
                                if answer:
                                    # Simpan percakapan
                                    ai_msg = Conversation(
                                        role='assistant',
                                        message=answer,
                                        context=json.dumps({"type": "answer_to_owner"}),
                                        created_at=datetime.now()
                                    )
                                    session.add(ai_msg)
                                    session.commit()
                                    
                                    return answer
                        except:
                            # Gagal parse JSON, lanjut ke mode mengajar
                            pass
                
                # KALAU BUKAN PERTANYAAN, PROSES SEBAGAI PENGAJARAN
                analysis_prompt = f"""
Pemilik berkata: "{message_text}"

Analisis: Apakah ini informasi BARU yang harus disimpan?
Jika iya, apa yang diajarkan? (produk baru / pricelist / gaya promosi / aturan)

Format JSON WAJIB:
{{
    "is_teaching": true/false,
    "teaching_type": "product/pricelist/style/rule/other",
    "summary": "ringkasan singkat jika teaching true",
    "keywords": ["kata1", "kata2"]
}}
"""
                response = self._call_cloudflare(analysis_prompt, max_tokens=300)
                
                if response:
                    try:
                        json_str = self._extract_json(response)
                        analysis = json.loads(json_str)
                        
                        if analysis.get("is_teaching"):
                            # Simpan sebagai memori
                            memory = Memory(
                                memory_type=analysis.get('teaching_type', 'other'),
                                content=f"User: {message_text}\nRingkasan: {analysis.get('summary', message_text[:50])}",
                                source_conversation_id=user_msg.id,
                                created_at=datetime.now()
                            )
                            session.add(memory)
                            
                            confirmation = f"📝 Saya catat: {analysis.get('summary', message_text[:50])}"
                            
                            ai_msg = Conversation(
                                role='assistant',
                                message=confirmation,
                                context=json.dumps({"teaching": analysis.get('teaching_type', 'other')}),
                                created_at=datetime.now()
                            )
                            session.add(ai_msg)
                            session.commit()
                            
                            return confirmation
                        else:
                            return "Maaf, saya tidak mengerti. Coba tanya tentang produk yang sudah diajarkan?"
                    except:
                        # Fallback: simpan sebagai memori sederhana
                        memory = Memory(
                            memory_type='other',
                            content=f"User: {message_text}",
                            source_conversation_id=user_msg.id,
                            created_at=datetime.now()
                        )
                        session.add(memory)
                        session.commit()
                        return f"📝 Saya catat pesan Anda (mode sederhana)"
                else:
                    return "Maaf, gagal memproses. Coba lagi nanti?"
            
            else:
                # Bukan owner - seharusnya tidak masuk sini
                return "Maaf, Anda bukan owner."
                
        except Exception as e:
            logger.error(f"Error di process_user_message: {e}")
            return f"Maaf, error: {str(e)}"
        finally:
            session.close()
    
    def should_respond_to_wtb(self, wtb_message, channel_name):
        """
        Memutuskan apakah perlu respon untuk WTB
        """
        session = Session()
        
        try:
            # Ambil semua memori
            all_memories = session.query(Memory).order_by(Memory.created_at.desc()).limit(50).all()
            
            if not all_memories:
                return {"should_respond": False, "reason": "Belum diajarkan apapun"}
            
            # Buat konteks memori
            memories_text = "\n".join([f"- {m.content[:200]}" for m in all_memories])
            
            prompt = f"""
Pesan WTB dari channel {channel_name}:
"{wtb_message}"

PRODUK YANG DIJUAL (dari memori owner):
{memories_text}

Tugas: Apakah pesan WTB ini mencari produk yang SESUAI dengan yang dijual?
Jika iya, produk APA?
Jika TIDAK, jawab "TIDAK".

Format JSON WAJIB:
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
        finally:
            session.close()
    
    def generate_response(self, wtb_message, product_name, channel_name):
        """
        Generate respons promosi untuk WTB
        """
        session = Session()
        
        try:
            # Ambil memori terkait produk ini
            memories = session.query(Memory).filter(
                Memory.content.contains(product_name)
            ).order_by(Memory.created_at.desc()).limit(20).all()
            
            memories_text = "\n".join([f"- {m.content}" for m in memories]) if memories else "Tidak ada memori spesifik"
            
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
5. Sertakan harga jika ada di memori
6. JANGAN OOT (Out of Topic)
7. Boleh pakai emoji secukupnya

RESPON LANGSUNG (tanpa pengantar):
"""
            response = self._call_cloudflare(prompt, max_tokens=300)
            
            if response:
                return response.strip()
            else:
                return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
                
        except Exception as e:
            logger.error(f"Error di generate_response: {e}")
            return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
        finally:
            session.close()
