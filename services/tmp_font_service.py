from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import tmp_font

tmp_font_bp = Blueprint('tmp_font', __name__)

@tmp_font_bp.route('/font-templates/save', methods=['POST'])
def save_font_template():
    try:
        data = request.json
        print(f"📥 Saving font template: {data.get('template_name')}")
        print(f"📦 Data lengkap: {data.keys()}")
        
        if not data.get('template_name'):
            return jsonify({'success': False, 'error': 'Template name required'}), 400
        
        if not data.get('font_family'):
            return jsonify({'success': False, 'error': 'Font family required'}), 400
        
        # Log ukuran file font
        if data.get('font_file_data'):
            print(f"📏 Font file size: {len(data['font_file_data'])} characters")
        
        template_code = tmp_font.save_template(
            template_name=data['template_name'],
            font_family=data['font_family'],
            font_file_data=data.get('font_file_data'),
            font_file_name=data.get('font_file_name'),
            font_weight=data.get('font_weight', 400),
            font_style=data.get('font_style', 'normal'),
            font_size=data.get('font_size', 48),
            text_color=data.get('text_color', '#ffffff'),
            animation_type=data.get('animation_type', 'none'),
            animation_duration=data.get('animation_duration', 2),
            animation_delay=data.get('animation_delay', 0),
            animation_iteration=data.get('animation_iteration', 'infinite'),
            preview_text=data.get('preview_text', 'Toko Online Premium'),
            preview_subtext=data.get('preview_subtext', 'dengan Layanan Terbaik 24/7'),
            website_id=data.get('website_id'),
            user_id=data.get('user_id'),
            is_public=data.get('is_public', False)
        )
        
        if template_code:
            # Verifikasi template benar-benar tersimpan
            verify = tmp_font.get_template(template_code)
            if verify:
                print(f"✅ Verifikasi sukses: Template {template_code} ditemukan di database")
                return jsonify({
                    'success': True,
                    'template_code': template_code,
                    'message': f'Template "{data["template_name"]}" saved successfully'
                })
            else:
                print(f"⚠️ Verifikasi gagal: Template {template_code} tidak ditemukan setelah simpan")
                return jsonify({
                    'success': False, 
                    'error': 'Template saved but verification failed'
                }), 500
        else:
            print("❌ save_template returned None")
            return jsonify({'success': False, 'error': 'Failed to save template'}), 500
            
    except Exception as e:
        print(f"❌ Error saving template: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_font_bp.route('/font-templates/<template_code>', methods=['GET'])
def get_font_template(template_code):
    try:
        print(f"📥 Getting template: {template_code}")
        template = tmp_font.get_template(template_code)
        
        if template:
            return jsonify({'success': True, 'template': template})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error getting template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_font_bp.route('/font-templates/<template_code>', methods=['DELETE'])
def delete_font_template(template_code):
    try:
        print(f"📥 Deleting template: {template_code}")
        success = tmp_font.delete_template(template_code)
        
        if success:
            return jsonify({'success': True, 'message': 'Template deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error deleting template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_font_bp.route('/font-templates', methods=['GET'])
def get_all_font_templates():
    try:
        website_id = request.args.get('website_id', type=int)
        user_id = request.args.get('user_id', type=int)
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        popular = request.args.get('popular', default=False, type=bool)
        search = request.args.get('search', default=None, type=str)
        
        print(f"📥 Getting templates - search: {search}, popular: {popular}, limit: {limit}")
        
        if search:
            templates = tmp_font.search_templates(search, limit)
        elif popular:
            templates = tmp_font.get_popular_templates(limit)
        elif website_id:
            templates = tmp_font.get_website_templates(website_id, limit)
        elif user_id:
            templates = tmp_font.get_user_templates(user_id, limit)
        else:
            templates = tmp_font.get_all_templates(limit=limit, offset=offset)
        
        print(f"📤 Returning {len(templates)} templates")
        
        return jsonify({
            'success': True, 
            'templates': templates, 
            'count': len(templates)
        })
        
    except Exception as e:
        print(f"❌ Error getting templates: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False, 
            'error': str(e)
        }), 500

@tmp_font_bp.route('/font-templates/verify/<template_code>', methods=['GET'])
def verify_font_template(template_code):
    try:
        template = tmp_font.get_template(template_code)
        if template:
            return jsonify({'success': True, 'template': template})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error verifying template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_font_bp.route('/font-templates/by-font/<path:font_family>', methods=['GET'])
def get_font_template_by_font(font_family):
    """
    Mendapatkan template berdasarkan font family
    """
    try:
        # Decode URL encoding
        from urllib.parse import unquote
        font_family = unquote(font_family)
        
        # Cari template dengan font family yang sama
        templates = tmp_font.get_all_templates(limit=50)
        
        # Filter template yang memiliki font family yang cocok
        matching_templates = [t for t in templates if t.get('font_family') == font_family]
        
        if matching_templates:
            # Ambil yang pertama (atau yang paling populer)
            template = matching_templates[0]
            return jsonify({'success': True, 'template': template})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
            
    except Exception as e:
        print(f"❌ Error getting font template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500