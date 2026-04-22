import os
from flask import Blueprint, render_template, abort

source_code_bp = Blueprint('source_code', __name__)

@source_code_bp.route('/source-viewer')
def source_viewer():
    # Path folder winedash
    base_path = os.path.join(os.getcwd(), 'winedash')
    all_files = []
    
    # Ekstensi yang ingin ditampilkan
    allowed_extensions = {'.py', '.js', '.html', '.css', '.json'}

    if not os.path.exists(base_path):
        return "Folder winedash tidak ditemukan", 404

    for root, dirs, files in os.walk(base_path):
        for file in sorted(files):
            if any(file.endswith(ext) for ext in allowed_extensions):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, os.getcwd())
                
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        all_files.append({
                            'path': rel_path,
                            'content': content
                        })
                except Exception:
                    continue

    # Mengirim data langsung ke file HTML
    return render_template('source-code.html', files=all_files)