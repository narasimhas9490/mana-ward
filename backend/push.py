"""Push notifications via Firebase Cloud Messaging (HTTP v1). Needs FCM_SERVICE_ACCOUNT (service-account JSON, raw or base64).
Without it every call is a harmless no-op, so the rest of the app works before Firebase is set up."""
import base64, json, logging, os, threading
import requests
from store import aw

log = logging.getLogger("push")
SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_creds, _lock = None, threading.Lock()


def _account():
    raw = os.environ.get("FCM_SERVICE_ACCOUNT", "").strip()
    if not raw:
        return None
    if not raw.startswith("{"):
        raw = base64.b64decode(raw).decode()
    return json.loads(raw)


def _access_token():
    global _creds
    info = _account()
    if not info:
        return None, None
    from google.oauth2 import service_account           # lazy: only needed once push is configured
    from google.auth.transport.requests import Request
    with _lock:
        if _creds is None:
            _creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
        if not _creds.valid:
            _creds.refresh(Request())
        return _creds.token, info["project_id"]


def _send(user_id, title, body, data):
    try:
        u = aw.get("users", user_id)
        if not u or not u.push_token:
            return
        token, project = _access_token()
        if not token:
            log.info("push skipped: FCM_SERVICE_ACCOUNT not set")
            return
        msg = {"message": {"token": u.push_token, "notification": {"title": title, "body": body},
                           "android": {"priority": "HIGH", "notification": {"channel_id": "default"}},
                           "data": {k: str(v) for k, v in (data or {}).items()}}}
        r = requests.post(f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
                          headers={"Authorization": f"Bearer {token}"}, json=msg, timeout=15)
        if r.status_code in (400, 404) and ("UNREGISTERED" in r.text or "INVALID_ARGUMENT" in r.text):
            aw.update("users", user_id, {"push_token": None})   # app uninstalled / token rotated
        elif r.status_code >= 400:
            log.warning("push failed %s: %s", r.status_code, r.text[:300])
    except Exception:  # never break the admin action because a notification failed
        log.exception("push error")


def notify_user(user_id, title, body, data=None):
    """Fire-and-forget (runs in a thread so the admin click returns immediately)."""
    threading.Thread(target=_send, args=(user_id, title, body, data), daemon=True).start()
