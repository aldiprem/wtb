#!/usr/bin/env python3
"""
Simple HTTP Server untuk testing game Auto Block Builder 3D
Run with: python server.py
"""

import http.server
import socketserver
import webbrowser
import os
from pathlib import Path

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]} {args[1]} {args[2]}")

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def check_files():
    required_files = ['index.html', 'css/style.css', 'js/game.js']
    missing_files = []
    
    for file in required_files:
        if not os.path.exists(os.path.join(DIRECTORY, file)):
            missing_files.append(file)
    
    if missing_files:
        print("⚠️ Warning: File berikut tidak ditemukan:")
        for file in missing_files:
            print(f"   - {file}")
        return False
    
    print("✅ Semua file required ditemukan!")
    return True

def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def main():
    print("\n" + "="*60)
    print("🖥️  MEMULAI SERVER...")
    print("="*60)
    
    if not check_files():
        print("\n❌ Perbaiki struktur folder!")
        return
    
    print(f"\n📁 Directory: {DIRECTORY}")
    print(f"🌐 Local URL: http://localhost:{PORT}")
    print(f"📡 Network URL: http://{get_local_ip()}:{PORT}")
    print("\n🔴 Tekan Ctrl+C untuk menghentikan server\n")
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"✨ Server running at http://localhost:{PORT}")
            webbrowser.open(f"http://localhost:{PORT}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Server dihentikan.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
