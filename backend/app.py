from flask import Flask
from flask_cors import CORS
from config import Config
from models import seed


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    from api import api
    from admin import admin
    app.register_blueprint(api)
    app.register_blueprint(admin)
    @app.errorhandler(413)
    def too_big(_e):
        from flask import jsonify
        return jsonify(error="Photo is too large (max 6 MB). Please pick a smaller one."), 413

    with app.app_context():
        seed()  # fills wards/categories/services in Appwrite if empty
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
