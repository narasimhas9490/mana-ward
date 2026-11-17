import os

_env = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env):  # minimal .env loader
    for _l in open(_env, encoding="utf8"):
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            _k, _v = _l.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production-0000")
    ADMIN_USER = os.getenv("ADMIN_USER", "admin")
    WARD_SECTIONS = os.getenv("WARD_SECTIONS", "1,2")  # roll sections inside Ward 1: 1 Balasanivaripalle, 2 Thakatamvaripalli
    REWARD_PER_POST = int(os.getenv("REWARD_PER_POST", "33"))  # Rs paid (via PhonePe) per post
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
    SMS_PROVIDER = os.getenv("SMS_PROVIDER", "console")
    MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY", "")
    MSG91_TEMPLATE_ID = os.getenv("MSG91_TEMPLATE_ID", "")
    DEV_RETURN_OTP = os.getenv("DEV_RETURN_OTP", "true").lower() == "true"
    MAX_CONTENT_LENGTH = 6 * 1024 * 1024
    WARD_NAME = "Thakatamvaripalle (Ward 1), B.Kothakota Nagar Panchayat, Annamayya District, AP"
