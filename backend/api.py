import base64, hashlib, io, os, re, secrets
from datetime import timedelta
from functools import wraps
import jwt
from flask import Blueprint, current_app as app, g, jsonify, request
import store as S
from store import aw, AppwriteError, now, iso, parse_dt
import models as M
from models import OPEN_WARDS

api = Blueprint("api", __name__, url_prefix="/api")
PHONE_RE = re.compile(r"^[6-9]\d{9}$")
EPIC_RE = re.compile(r"^[A-Z0-9]{6,15}$")
PHOTO_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
PAGE = 12


def err(msg, code=400):
    return jsonify(error=msg), code


@api.errorhandler(AppwriteError)
def aw_error(e):
    app.logger.error("appwrite: %s", e)
    return err("Server is busy, please try again", 503)


def h(code):
    return hashlib.sha256((code + app.config["SECRET_KEY"]).encode()).hexdigest()


def token_for(u):
    return jwt.encode({"uid": u.id, "exp": now() + timedelta(days=90)}, app.config["SECRET_KEY"], "HS256")


def auth(required=True):
    def deco(fn):
        @wraps(fn)
        def w(*a, **k):
            g.user = None
            t = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            if t:
                try:
                    g.user = aw.get("users", jwt.decode(t, app.config["SECRET_KEY"], ["HS256"])["uid"])
                except AppwriteError:
                    raise
                except Exception:
                    pass
            if required and not g.user:
                return err("Please log in", 401)
            if g.user and g.user.is_blocked:
                return err("Your account is blocked", 403)
            return fn(*a, **k)
        return w
    return deco


def latest_otp(key):
    return aw.first("otps", [S.equal("key", key), S.order_desc("$createdAt")])


def issue_otp(key, phone):
    last = latest_otp(key)
    if last and (now() - last.created_at).total_seconds() < 30:
        return None, "Wait 30 seconds before requesting another OTP"
    for o in aw.list("otps", [S.equal("key", key)], lim=25, total=False)[0]:
        aw.delete("otps", o.id)
    code = f"{secrets.randbelow(10**6):06d}"
    aw.create("otps", {"key": key, "code_hash": h(code), "expires_at": iso(now() + timedelta(minutes=5)), "attempts": 0})
    from sms import send_sms_otp
    send_sms_otp(phone, code)
    return code, None


def check_otp(key, code):
    o = latest_otp(key)
    if not o or parse_dt(o.expires_at) < now() or (o.attempts or 0) >= 5:
        return False
    ok = secrets.compare_digest(o.code_hash, h(code or ""))
    if ok:
        aw.delete("otps", o.id)
    else:
        aw.update("otps", o.id, {"attempts": (o.attempts or 0) + 1})
    return ok


def user_by_phone(phone):
    return aw.first("users", [S.equal("phone", phone)])


# ---------- auth ----------
@api.post("/auth/send-otp")
def send_otp():
    phone = (request.json or {}).get("phone", "")
    if not PHONE_RE.match(phone):
        return err("Enter a valid 10-digit mobile number")
    code, e = issue_otp(f"login:{phone}", phone)
    if e:
        return err(e, 429)
    return jsonify(ok=True, **({"dev_otp": code} if app.config["DEV_RETURN_OTP"] else {}))


@api.post("/auth/verify-otp")
def verify_otp():
    d = request.json or {}
    phone = d.get("phone", "")
    if not PHONE_RE.match(phone) or not check_otp(f"login:{phone}", d.get("otp")):
        return err("Wrong or expired OTP", 401)
    name = (d.get("name") or "").strip()[:80]
    u = user_by_phone(phone)
    if not u:
        if len(name) < 2:
            return err("Please tell us your name")
        wid = d.get("ward_id") if d.get("ward_id") in OPEN_WARDS else 1
        u = aw.create("users", {"phone": phone, "name": name, "ward_id": wid, "is_verified": False, "is_blocked": False})
    elif name and not u.name:
        u = aw.update("users", u.id, {"name": name})
    if u.is_blocked:
        return err("Your account is blocked", 403)
    return jsonify(token=token_for(u), user=M.user_me(u))


@api.get("/health")
def health():
    return jsonify(ok=True)  # cheap keep-warm / uptime-monitor target (no Appwrite call)


@api.get("/wards")
def wards():
    return jsonify([M.ward_json(w) for w in M.wards()])


@api.get("/me")
@auth()
def me():
    posts = aw.count("issues", [S.equal("user_id", g.user.id), S.equal("hidden", False)])
    mine = aw.all("issues", [S.equal("user_id", g.user.id), S.q("select", values=["upvote_count"])])
    likes = sum(i.upvote_count or 0 for i in mine)
    reqs = aw.count("service_requests", [S.equal("user_id", g.user.id)])
    return jsonify({**M.user_me(g.user), "stats": {"posts": posts, "likes": likes, "requests": reqs}})


@api.put("/me")
@auth()
def update_me():
    d = request.json or {}
    patch = {"name": (d.get("name") or g.user.name or "")[:80], "street": (d.get("street") or g.user.street or "")[:120]}
    if d.get("ward_id") in OPEN_WARDS:
        patch["ward_id"] = d["ward_id"]
    return jsonify(M.user_me(aw.update("users", g.user.id, patch)))


# ---------- voter verification ----------
@api.post("/voter/send-otp")
@auth()
def voter_send():
    epic = ((request.json or {}).get("voter_id") or "").strip().upper()
    if not EPIC_RE.match(epic):
        return err("Enter a valid Voter ID (EPIC) number")
    if g.user.is_verified:
        return err("Already verified")
    if aw.first("users", [S.equal("voter_id", epic), S.not_equal("$id", g.user.id)]):
        return err("This Voter ID is already linked to another account", 409)
    v = aw.get("voter_roll", epic)
    if not v:
        return err("This Voter ID is not in our ward voter list. Contact the ward office.", 404)
    code, e = issue_otp(f"voter:{g.user.id}:{epic}", v.mobile)
    if e:
        return err(e, 429)
    return jsonify(ok=True, masked_mobile="XXXXXX" + v.mobile[-4:],
                   **({"dev_otp": code} if app.config["DEV_RETURN_OTP"] else {}))


@api.post("/voter/verify")
@auth()
def voter_verify():
    d = request.json or {}
    epic = (d.get("voter_id") or "").strip().upper()
    if not check_otp(f"voter:{g.user.id}:{epic}", d.get("otp")):
        return err("Wrong or expired OTP", 401)
    patch = {"voter_id": epic, "is_verified": True}
    v = aw.get("voter_roll", epic)
    if v and not g.user.name:
        patch["name"] = v.name
    return jsonify(M.user_me(aw.update("users", g.user.id, patch)))


# ---------- issues ----------
def enrich_issues(items, uid=None):
    """Batch-load users / upvote flags so a feed page costs a handful of requests, not one per card."""
    users = aw.by_ids("users", [i.user_id for i in items])
    cats = M.category_map()
    voted = set()
    if uid and items:
        voted = {u.issue_id for u in aw.list("upvotes", [S.equal("user_id", uid), S.equal("issue_id", [i.id for i in items])],
                                              lim=100, total=False)[0]}
    return [issue_json(i, users.get(i.user_id), cats.get(i.category_id), i.id in voted) for i in items]


def issue_json(i, user, cat, upvoted):
    return {
        "id": i.id, "title": i.title, "description": i.description or "", "location": i.location or "",
        "photo": aw.photo_url(i.photo) if i.photo else None,
        "status": i.status or "open", "admin_note": i.admin_note or "",
        "category": {"id": cat.id, "name": cat.name, "icon": cat.icon} if cat else None,
        "user": M.user_public(user) if user else {"id": i.user_id, "name": "Resident", "verified": False},
        "created_at": i.created_at.isoformat() + "Z",
        "upvotes": i.upvote_count or 0, "comments": i.comment_count or 0, "upvoted": upvoted,
        "last_comment": {"text": i.last_comment, "user": i.last_comment_user or "Resident"} if i.last_comment else None,
        "ward_id": i.ward_id,
    }


@api.get("/categories")
def categories():
    return jsonify([{"id": c.id, "name": c.name, "icon": c.icon} for c in M.categories()])


@api.get("/issues")
@auth(False)
def list_issues():
    qs = [S.equal("hidden", False)]
    wid = request.args.get("ward") or (g.user.ward_id if g.user else None)
    if wid:
        qs.append(S.equal("ward_id", int(wid)))
    if request.args.get("category"):
        qs.append(S.equal("category_id", request.args["category"]))
    if request.args.get("mine") and g.user:
        qs.append(S.equal("user_id", g.user.id))
    st = request.args.get("status")
    if st == "active":
        qs.append(S.equal("status", ["open", "in_progress"]))
    elif st:
        qs.append(S.equal("status", st))
    if request.args.get("q"):
        t = request.args["q"][:60]
        qs.append(S.or_(S.contains("title", t), S.contains("description", t)))
    qs += [S.order_desc("upvote_count"), S.order_desc("$createdAt")] if request.args.get("sort") == "top" else [S.order_desc("$createdAt")]
    try:
        page = max(int(request.args.get("page", 1)), 1)
    except ValueError:
        page = 1
    items, _ = aw.list("issues", [*qs, S.offset((page - 1) * 20)], lim=20, total=False)
    return jsonify(enrich_issues(items, g.user.id if g.user else None))


@api.post("/issues")
@auth()
def create_issue():
    f = request.form if request.form else (request.json or {})
    title = (f.get("title") or "").strip()
    if len(title) < 5:
        return err("Please write a short title (min 5 characters)")
    photo = None
    p = request.files.get("photo")
    if p:
        ext = os.path.splitext(p.filename or "")[1].lower()
        if ext not in PHOTO_TYPES:
            return err("Photo must be JPG/PNG")
        photo = aw.upload(p.stream, f"{secrets.token_hex(8)}{ext}", PHOTO_TYPES[ext])  # -> Appwrite Storage
    elif f.get("photo_b64"):  # app sends a resized JPEG as base64 inside the JSON body (no multipart)
        try:
            raw = base64.b64decode(f["photo_b64"].split(",")[-1], validate=False)
        except Exception:
            return err("Could not read the photo, please pick another")
        if not raw or len(raw) > 5 * 1024 * 1024:
            return err("Photo is too large (max 5 MB). Please pick a smaller one.")
        photo = aw.upload(io.BytesIO(raw), f"{secrets.token_hex(8)}.jpg", "image/jpeg")
    cat = f.get("category_id") or None
    data = {"user_id": g.user.id, "title": title[:150], "description": (f.get("description") or "")[:3000],
            "ward_id": g.user.ward_id or 1, "location": (f.get("location") or g.user.street or "")[:150],
            "status": "open", "hidden": False, "upvote_count": 0, "comment_count": 0}
    if cat and cat in M.category_map():
        data["category_id"] = cat
    if photo:
        data["photo"] = photo
    try:
        i = aw.create("issues", data)
    except Exception:
        if photo:
            aw.delete_file(photo)
        raise
    return jsonify(enrich_issues([i], g.user.id)[0]), 201


@api.get("/issues/<iid>")
@auth(False)
def get_issue(iid):
    i = aw.get("issues", iid)
    if not i or i.hidden:
        return err("Not found", 404)
    return jsonify(enrich_issues([i], g.user.id if g.user else None)[0])


@api.post("/issues/<iid>/upvote")
@auth()
def upvote(iid):
    i = aw.get("issues", iid)
    if not i:
        return err("Not found", 404)
    u = aw.first("upvotes", [S.equal("issue_id", iid), S.equal("user_id", g.user.id)])
    if u:
        aw.delete("upvotes", u.id)
        aw.incr("issues", iid, "upvote_count", -1)
        n, on = max((i.upvote_count or 0) - 1, 0), False
    else:
        try:
            aw.create("upvotes", {"issue_id": iid, "user_id": g.user.id})
            aw.incr("issues", iid, "upvote_count", 1)
            n = (i.upvote_count or 0) + 1
        except AppwriteError as e:
            if e.status != 409:  # already voted in a parallel request
                raise
            n = i.upvote_count or 0
        on = True
    return jsonify(upvotes=n, upvoted=on)


def comment_json(c, users, liked):
    u = users.get(c.user_id)
    return {"id": c.id, "text": c.text, "user": M.user_public(u) if u else {"id": c.user_id, "name": "Resident", "verified": False},
            "created_at": c.created_at.isoformat() + "Z", "likes": c.like_count or 0, "liked": c.id in liked,
            "replies": c.reply_count or 0, "parent_id": c.parent_id}


def comments_out(rows, uid):
    users = aw.by_ids("users", [c.user_id for c in rows])
    liked = set()
    if uid and rows:
        liked = {l.comment_id for l in aw.list("comment_likes", [S.equal("user_id", uid), S.equal("comment_id", [c.id for c in rows])],
                                               lim=100, total=False)[0]}
    return [comment_json(c, users, liked) for c in rows]


@api.get("/issues/<iid>/comments")
@auth(False)
def list_comments(iid):
    if not aw.get("issues", iid):
        return err("Not found", 404)
    try:
        page = max(int(request.args.get("page", 1)), 1)
    except ValueError:
        page = 1
    rows, _ = aw.list("comments", [S.equal("issue_id", iid), S.q("isNull", "parent_id"), S.order_desc("$createdAt"),
                                   S.offset((page - 1) * PAGE)], lim=PAGE + 1, total=False)
    return jsonify(items=comments_out(rows[:PAGE], g.user.id if g.user else None), has_more=len(rows) > PAGE)


@api.get("/comments/<cid>/replies")
@auth(False)
def list_replies(cid):
    rows, _ = aw.list("comments", [S.equal("parent_id", cid), S.order_asc("$createdAt")], lim=100, total=False)
    return jsonify(items=comments_out(rows, g.user.id if g.user else None))


@api.post("/issues/<iid>/comments")
@auth()
def comment(iid):
    if not aw.get("issues", iid):
        return err("Not found", 404)
    d = request.json or {}
    t = (d.get("text") or "").strip()
    if not t:
        return err("Write something")
    parent = None
    if d.get("parent_id"):
        parent = aw.get("comments", str(d["parent_id"]))
        if not parent or parent.issue_id != iid:
            return err("Comment not found", 404)
        if parent.parent_id:  # replies are one level deep, like Instagram
            parent = aw.get("comments", parent.parent_id)
    c = aw.create("comments", {"issue_id": iid, "user_id": g.user.id, "text": t[:1000],
                               "parent_id": parent.id if parent else None, "like_count": 0, "reply_count": 0})
    aw.incr("issues", iid, "comment_count", 1)
    aw.update("issues", iid, {"last_comment": t[:300], "last_comment_user": g.user.name or "Resident"})
    if parent:
        aw.incr("comments", parent.id, "reply_count", 1)
    return jsonify(comment_json(c, {g.user.id: g.user}, set())), 201


@api.post("/comments/<cid>/like")
@auth()
def like_comment(cid):
    c = aw.get("comments", cid)
    if not c:
        return err("Not found", 404)
    l = aw.first("comment_likes", [S.equal("comment_id", cid), S.equal("user_id", g.user.id)])
    if l:
        aw.delete("comment_likes", l.id)
        aw.incr("comments", cid, "like_count", -1)
        n, on = max((c.like_count or 0) - 1, 0), False
    else:
        try:
            aw.create("comment_likes", {"comment_id": cid, "user_id": g.user.id})
            aw.incr("comments", cid, "like_count", 1)
            n = (c.like_count or 0) + 1
        except AppwriteError as e:
            if e.status != 409:
                raise
            n = c.like_count or 0
        on = True
    return jsonify(likes=n, liked=on)


# ---------- services ----------
def sr_json(r, svc):
    return {"id": r.id, "service": svc.name if svc else "", "icon": svc.icon if svc else "", "subject": r.subject,
            "details": r.details or "", "status": r.status or "submitted", "admin_note": r.admin_note or "",
            "created_at": r.created_at.isoformat() + "Z"}


@api.get("/services")
def services():
    return jsonify([{"id": s.id, "name": s.name, "icon": s.icon, "description": s.description or ""}
                    for s in M.services() if s.active])


@api.post("/service-requests")
@auth()
def create_sr():
    d = request.json or {}
    s = M.service_map().get(str(d.get("service_id") or ""))
    if not s:
        return err("Choose a service")
    subject = (d.get("subject") or "").strip()
    if len(subject) < 3:
        return err("Tell us briefly what you need")
    r = aw.create("service_requests", {"user_id": g.user.id, "service_id": s.id, "subject": subject[:150],
                                       "details": (d.get("details") or "")[:3000], "status": "submitted"})
    return jsonify(sr_json(r, s)), 201


@api.get("/service-requests")
@auth()
def my_srs():
    rows, _ = aw.list("service_requests", [S.equal("user_id", g.user.id), S.order_desc("$createdAt")], lim=100, total=False)
    sm = M.service_map()
    return jsonify([sr_json(r, sm.get(r.service_id)) for r in rows])
