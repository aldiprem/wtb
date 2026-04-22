import os
from flask import Blueprint, jsonify

source_code_bp = Blueprint('source_code', __name__)

@source_code_bp.route('/api/source-code', methods=['GET'])
def get_source_code():
    # Path folder yang ingin dipindai (relatif terhadap root project /root/wtb)
    base_path = os.path.join(os.getcwd(), 'winedash')
    code_data = []
    
    # Ekstensi yang diizinkan untuk dibaca
    allowed_extensions = {'.py', '.js', '.html', '.css', '.json', '.sql'}

    if not os.path.exists(base_path):
        return jsonify({'success': False, 'error': f'Folder {base_path} tidak ditemukan'}), 404

    try:
        for root, dirs, files in os.walk(base_path):
            for file in sorted(files):
                if any(file.endswith(ext) for ext in allowed_extensions):
                    file_path = os.path.join(root, file)
                    # Mendapatkan path relatif untuk judul
                    relative_path = os.path.relpath(file_path, os.getcwd())
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            ext = os.path.splitext(file)[1][1:]
                            # Mapping bahasa untuk PrismJS
                            lang_map = {
                                'js': 'javascript',
                                'py': 'python',
                                'html': 'markup',
                                'css': 'css',
                                'json': 'json'
                            }
                            
                            code_data.append({
                                'path': relative_path,
                                'filename': file,
                                'content': content,
                                'language': lang_map.get(ext, 'clike')
                            })
                    except Exception as e:
                        continue
        
        return jsonify({'success': True, 'files': code_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500