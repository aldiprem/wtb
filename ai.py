import google.generativeai as genai
from database import Session, Conversation, Memory
from datetime import datetime
import json
from loguru import logger

class AIEngine:
    def __init__(self, api_key):
        genai.configure(api_key=api_key)
        
        # GANTI DENGAN MODEL YANG VALID
        # Pilih salah satu yang tersedia:
        # - 'gemini-1.5-pro' (paling stabil)
        # - 'gemini-1.0-pro' (ringan)
        # - 'gemini-2.0-flash-exp' (terbaru, tapi experimental)
        self.model = genai.GenerativeModel('models/gemini-2.5-flash')
        
        # System prompt: AI TIDAK TAHU APA-APA
        self.system_prompt = """Anda adalah AI baru lahir yang TIDAK TAHU APA-AP tentang bisnis.

Yang Anda tahu:
- Saya akan mengajari Anda SEMUANYA melalui percakapan
- Setiap percakapan dengan saya akan disimpan sebagai MEMORI
- Saat merespon WTB, Anda HARUS menggunakan memori yang sudah saya ajarkan
- JANGAN PERNAH mengada-ada di luar yang saya ajarkan
- Jika tidak yakin, lebih baik DIAM daripada salah

Mulai dengan ingatan kosong."""
        
        # Inisialisasi chat (opsional, bisa di-comment dulu)
        # self.chat = self.model.start_chat(history=[])
    
    def process_user_message(self, message_text):
        """Proses semua pesan dari Anda (pemilik)"""
        session = Session()
        
        try:
            # Simpan pesan Anda ke database
            user_msg = Conversation(
                role='user',
                message=message_text,
                created_at=datetime.now()
            )
            session.add(user_msg)
            session.flush()
            
            # AI menganalisis: ini lagi ngajarin apa?
            analysis_prompt = f"""
    Pemilik berkata: "{message_text}"
    
    Analisis pesan ini:
    1. Apa yang sedang diajarkan? (produk baru / pricelist / gaya promosi / aturan)
    2. Ringkas inti ajarannya
    3. Kata kunci penting
    
    Format JSON:
    {{
        "teaching_type": "product/pricelist/style/rule/other",
        "summary": "ringkasan singkat",
        "keywords": ["kata1", "kata2"]
    }}
    """
            # Generate response
            response = self.model.generate_content(analysis_prompt)
            
            # CEK APAKAH RESPON VALID
            if not response or not response.text:
                raise Exception("Respons kosong dari Gemini API")
            
            # AMBIL TEKS JSON - kadang ada teks lain sebelum/sesudah JSON
            response_text = response.text.strip()
            
            # Cari JSON dalam teks (kalau ada teks tambahan)
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
            else:
                json_str = response_text
            
            # Parse JSON
            try:
                analysis = json.loads(json_str)
            except json.JSONDecodeError:
                # Kalau gagal parse, buat default
                logger.warning(f"Gagal parse JSON: {response_text[:200]}")
                analysis = {
                    "teaching_type": "other",
                    "summary": message_text[:50],
                    "keywords": []
                }
            
            # Validasi field yang diperlukan
            if 'teaching_type' not in analysis:
                analysis['teaching_type'] = 'other'
            if 'summary' not in analysis:
                analysis['summary'] = message_text[:50]
            
            # Simpan sebagai memori
            memory = Memory(
                memory_type=analysis['teaching_type'],
                content=f"User: {message_text}\nRingkasan: {analysis['summary']}",
                source_conversation_id=user_msg.id,
                created_at=datetime.now()
            )
            session.add(memory)
            
            # Generate respons konfirmasi
            confirmation = f"📝 Saya catat: {analysis['summary']}"
            
            # Simpan respons AI
            ai_msg = Conversation(
                role='assistant',
                message=confirmation,
                context=json.dumps({"teaching": analysis['teaching_type']}),
                created_at=datetime.now()
            )
            session.add(ai_msg)
            session.commit()
            
            return confirmation
            
        except Exception as e:
            logger.error(f"Error di process_user_message: {e}")
            # Fallback: tetap simpan sebagai memori sederhana
            try:
                # Simpan sebagai memori dengan tipe 'other'
                memory = Memory(
                    memory_type='other',
                    content=f"User: {message_text}",
                    source_conversation_id=user_msg.id if 'user_msg' in locals() else None,
                    created_at=datetime.now()
                )
                session.add(memory)
                session.commit()
                return f"📝 Saya catat pesan Anda (dalam mode sederhana)"
            except:
                return "Maaf, saya gagal memproses. Coba lagi nanti?"
        finally:
            session.close()
    
    def should_respond_to_wtb(self, wtb_message, channel_name):
        """Memutuskan apakah perlu respon"""
        session = Session()
        
        try:
            # Ambil SEMUA memori yang pernah diajarkan
            all_memories = session.query(Memory).order_by(Memory.created_at.desc()).limit(50).all()
            
            if not all_memories:
                logger.info("📭 Belum ada memori, pasti tidak akan respon")
                return {"should_respond": False, "reason": "Belum diajarkan apapun"}
            
            # Konteks dari database
            context = {
                "memori_yang_diajarkan": [
                    {
                        "type": m.memory_type,
                        "content": m.content[:200]
                    } for m in all_memories
                ]
            }
            
            prompt = f"""
    Pesan WTB dari channel {channel_name}:
    "{wtb_message}"
    
    INILAH SATU-SATUNYA PENGETAHUAN SAYA:
    {json.dumps(context, indent=2)}
    
    Tugas:
    Apakah pesan WTB ini sesuai dengan produk yang sudah diajarkan?
    Jika sesuai, produk apa?
    Jika TIDAK sesuai, jawab false.
    
    Format JSON WAJIB:
    {{
        "should_respond": true/false,
        "product": "nama produk atau null",
        "reason": "penjelasan singkat"
    }}
    """
            response = self.model.generate_content(prompt)
            
            if not response or not response.text:
                return {"should_respond": False, "reason": "Tidak ada respons dari AI"}
            
            # Parse JSON dengan aman
            try:
                response_text = response.text.strip()
                # Cari JSON
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = json.loads(response_text)
            except:
                # Fallback
                return {"should_respond": False, "reason": "Gagal memahami respons"}
            
            return result
            
        except Exception as e:
            logger.error(f"Error di should_respond: {e}")
            return {"should_respond": False, "reason": "Error, lebih baik diam"}
        finally:
            session.close()
    
    def generate_response(self, wtb_message, product_name, channel_name):
        """Generate respons berdasarkan MEMORI"""
        session = Session()
        
        try:
            # Ambil semua memori terkait produk ini
            memories = session.query(Memory).filter(
                Memory.content.contains(product_name) | 
                Memory.memory_type.in_(['style', 'rule'])
            ).order_by(Memory.created_at.desc()).limit(20).all()
            
            if not memories:
                return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
            
            prompt = f"""
Pesan WTB: "{wtb_message}"
Channel: {channel_name}
Produk yang cocok: {product_name}

INILAH YANG PERNAH DIAJARKAN PEMILIK:
{chr(10).join([f"- {m.content}" for m in memories])}

TUGAS:
Buat RESPON PROMOSI dengan aturan WAJIB:
1. HANYA gunakan informasi dari yang diajarkan di atas
2. JANGAN menambahkan informasi baru
3. Gaya bahasa harus seperti yang diajarkan
4. Jika ada pricelist, sertakan
5. JANGAN OOT (Out of Topic)
6. Bahasa santai, seperti orang biasa

RESPON LANGSUNG:
"""
            response = self.model.generate_content(prompt)
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Error di generate_response: {e}")
            return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
        finally:
            session.close()
