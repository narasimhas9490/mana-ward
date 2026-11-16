import requests
from flask import current_app

def send_sms_otp(phone: str, otp: str):
    """phone = 10-digit Indian mobile."""
    provider = current_app.config["SMS_PROVIDER"]
    if provider == "msg91":
        r = requests.post(
            "https://control.msg91.com/api/v5/otp",
            params={"template_id": current_app.config["MSG91_TEMPLATE_ID"], "mobile": "91" + phone, "otp": otp},
            headers={"authkey": current_app.config["MSG91_AUTH_KEY"]}, timeout=10)
        r.raise_for_status()
    else:
        print(f"[SMS-DEV] OTP for {phone}: {otp}", flush=True)
