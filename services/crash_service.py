import os
import time
import random
import threading
import json
from flask import Blueprint, Response, send_from_directory, jsonify

crash_bp = Blueprint('crash_bp', __name__)

# ==========================================
# ENDPOINT UNTUK MENYAJIKAN FILE .TGS LOTTIE
# ==========================================
@crash_bp.route('/assets/tgs/<path:filename>', methods=['GET'])
def serve_tgs_assets(filename):
    directory = '/root/wtb/image'
    file_path = os.path.join(directory, filename)
    
    # 1. Cek apakah foldernya ada
    if not os.path.exists(directory):
        return jsonify({
            "error": "Folder direktori tidak ditemukan di server",
            "path_yang_dicari": directory
        }), 404

    # 2. Cek apakah file spesifiknya ada
    if not os.path.isfile(file_path):
        # Jika tidak ada, tampilkan daftar file yang SEBENARNYA ada di folder tersebut
        # agar Anda tahu nama file yang benar
        files_available = os.listdir(directory)
        return jsonify({
            "error": "File tidak ditemukan",
            "file_yang_diminta": filename,
            "path_lengkap": file_path,
            "file_yang_tersedia_di_folder_ini": files_available
        }), 404

    # 3. Jika folder dan file ada, kirimkan filenya
    try:
        return send_from_directory(directory, filename)
    except Exception as e:
        return jsonify({"error": f"Gagal membaca file: {str(e)}"}), 500

# --- STATE GAME GLOBAL ---
game_state = {
    "status": "WAITING", # WAITING, PLAYING, CRASHED
    "multiplier": 1.00,
    "time_left": 5 # Countdown untuk waiting
}

def game_loop():
    """Background task untuk menjalankan logika game terus-menerus"""
    global game_state
    while True:
        # FASE 1: MENUNGGU
        game_state["status"] = "WAITING"
        game_state["multiplier"] = 1.00
        for i in range(5, 0, -1):
            game_state["time_left"] = i
            time.sleep(1)

        # FASE 2: BERMAIN (ROKET TERBANG)
        game_state["status"] = "PLAYING"
        # Roket akan meledak di angka random antara 1.01x dan 10.00x
        crash_point = random.uniform(1.01, 10.00) 
        speed = 0.001
        
        while game_state["status"] == "PLAYING":
            game_state["multiplier"] += speed
            speed += 0.0001 # Kecepatan eksponensial

            if game_state["multiplier"] >= crash_point:
                game_state["multiplier"] = crash_point
                game_state["status"] = "CRASHED"
            
            time.sleep(0.05) # Loop jalan setiap 50ms (real-time)

        # FASE 3: MELEDAK
        time.sleep(3) # Tampilkan teks meledak selama 3 detik sebelum restart

# Jalankan game loop di thread terpisah agar tidak memblokir Flask
thread = threading.Thread(target=game_loop, daemon=True)
thread.start()

# --- ENDPOINT SSE (Server-Sent Events) ---
@crash_bp.route('/stream')
def stream():
    """Endpoint ini diakses JS via EventSource untuk mendapatkan live update"""
    def event_stream():
        while True:
            # Mengirim data JSON ke frontend setiap 50ms
            yield f"data: {json.dumps(game_state)}\n\n"
            time.sleep(0.05)
            
    return Response(event_stream(), mimetype="text/event-stream")

# --- ENDPOINT TARUHAN (MOCKUP) ---
@crash_bp.route('/bet', methods=['POST'])
def place_bet():
    return {"status": "success", "message": "Bet placed"}

@crash_bp.route('/cashout', methods=['POST'])
def cashout():
    return {"status": "success", "message": "Cashed out"}