from flask import Blueprint, jsonify, request, send_from_directory
import os

games_bp = Blueprint('games', __name__)

@games_bp.route('/games')
def games_page():
    """Halaman utama games"""
    return send_from_directory(os.path.dirname(__file__), 'games.html')

@games_bp.route('/games/css/<path:filename>')
def serve_games_css(filename):
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'css'), filename)

@games_bp.route('/games/js/<path:filename>')
def serve_games_js(filename):
    return send_from_directory(os.path.join(os.path.dirname(__file__), 'js'), filename)