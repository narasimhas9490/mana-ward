import csv, io, re
from datetime import timedelta
from functools import wraps
from flask import (Blueprint, current_app as app, flash, redirect, render_template, request, session, url_for, Response, abort)
import store as S
from store import cached_all
from store import aw, iso, now, invalidate
import models as M

admin = Blueprint("admin", __name__, url_prefix="/admin", template_folder="templates")
ISSUE_STATUS = ["open", "in_progress", "resolved", "rejected"]
SR_STATUS = ["submitted", "in_progress", "completed", "rejected"]


# Posts still owed the reward: visible, not rejected, not yet paid.
UNPAID = S.or_(S.equal("paid", False), S.q("isNull", "paid"))
DUE = [UNPAID, S.equal("hidden", False), S.not_equal("status", "rejected")]


def login_required(fn):
    @wraps(fn)
    def w(*a, **k):
        if not session.get("admin"):
            return redirect(url_for("admin.login"))
        return fn(*a, **k)
    return w


@admin.app_context_processor
def inject():
    return {"ward": app.config["WARD_NAME"], "ISSUE_STATUS": ISSUE_STATUS, "SR_STATUS": SR_STATUS,
            "REWARD": app.config["REWARD_PER_POST"]}


def attach_issue_refs(items):
    users = aw.by_ids("users", [i.user_id for i in items])
    cats = M.category_map()
    for i in items:
        i.user = users.get(i.user_id) or S.Row({"$id": i.user_id, "name": "(deleted)", "phone": "—"})
        i.category = cats.get(i.category_id)
    return items


@admin.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        if (request.form["username"] == app.config["ADMIN_USER"]
                and request.form["password"] == app.config["ADMIN_PASSWORD"]):
            session["admin"] = True
            return redirect(url_for("admin.dashboard"))
        flash("Wrong username or password")
    return render_template("login.html")


@admin.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("admin.login"))


@admin.get("/")
@login_required
def dashboard():
    week = iso(now() - timedelta(days=7))
    active = ["open", "in_progress"]
    stats = {
        "users": aw.count("users"),
        "verified": aw.count("users", [S.equal("is_verified", True)]),
        "issues": aw.count("issues"),
        "open_issues": aw.count("issues", [S.equal("status", active)]),
        "resolved": aw.count("issues", [S.equal("status", "resolved")]),
        "requests": aw.count("service_requests"),
        "pending_requests": aw.count("service_requests", [S.equal("status", ["submitted", "in_progress"])]),
        "new_week": aw.count("issues", [S.gte("$createdAt", week)]),
        "paid": aw.count("issues", [S.equal("paid", True)]),
        "due": aw.count("issues", DUE),
    }
    stats["due_amount"] = stats["due"] * app.config["REWARD_PER_POST"]
    stats["paid_amount"] = stats["paid"] * app.config["REWARD_PER_POST"]
    cat_n = aw.counts_by("issues", "category_id")
    by_cat = sorted(((c.name, c.icon, cat_n.get(c.id, 0)) for c in M.categories()), key=lambda x: -x[2])
    svc_n = aw.counts_by("service_requests", "service_id")
    by_service = sorted(((s.name, s.icon, svc_n.get(s.id, 0)) for s in M.services()), key=lambda x: -x[2])
    top, _ = aw.list("issues", [S.equal("status", active), S.equal("hidden", False), S.order_desc("upvote_count")], lim=5, total=False)
    return render_template("dashboard.html", s=stats, by_cat=by_cat, by_service=by_service, top=top)


@admin.get("/issues")
@login_required
def issues():
    qs = []
    a = request.args
    if a.get("status"):
        qs.append(S.equal("status", a["status"]))
    if a.get("category"):
        qs.append(S.equal("category_id", a["category"]))
    if a.get("ward"):
        qs.append(S.equal("ward_id", int(a["ward"])))
    if a.get("q"):
        qs.append(S.contains("title", a["q"]))
    if a.get("pay") == "paid":
        qs.append(S.equal("paid", True))
    elif a.get("pay") == "unpaid":
        qs.append(UNPAID)
    elif a.get("pay") == "due":
        qs += DUE
    items, _ = aw.list("issues", [*qs, S.order_desc("$createdAt")], lim=300, total=False)
    return render_template("issues.html", items=attach_issue_refs(items), cats=M.categories(), wards=M.wards())


@admin.get("/issues/<iid>")
@login_required
def issue(iid):
    i = aw.get("issues", iid) or abort(404)
    attach_issue_refs([i])
    i.comments = aw.all("comments", [S.equal("issue_id", iid), S.order_asc("$createdAt")], cap=500)
    users = aw.by_ids("users", [c.user_id for c in i.comments])
    for c in i.comments:
        c.user = users.get(c.user_id) or S.Row({"$id": c.user_id, "name": "(deleted)", "phone": "—"})
    i.photo_url = aw.photo_url(i.photo) if i.photo else None
    i.roll = aw.get("voter_roll", i.user.voter_id) if getattr(i.user, "voter_id", None) else None
    return render_template("issue.html", i=i)


@admin.post("/issues/<iid>")
@login_required
def issue_update(iid):
    i = aw.get("issues", iid) or abort(404)
    patch = {"admin_note": request.form.get("admin_note", i.admin_note or ""), "hidden": request.form.get("hidden") == "1"}
    if request.form.get("status") in ISSUE_STATUS:
        patch["status"] = request.form["status"]
    aw.update("issues", iid, patch)
    flash("Saved")
    return redirect(url_for("admin.issue", iid=iid))


@admin.post("/issues/<iid>/pay")
@login_required
def issue_pay(iid):
    """Mark the Rs reward for this post as paid / not paid (admin calls the resident and pays via PhonePe)."""
    i = aw.get("issues", iid) or abort(404)
    paid = request.form.get("paid") == "1"
    newly_paid = paid and not i.paid
    aw.update("issues", iid, {"paid": paid, "paid_at": iso(now()) if paid else None,
                              "pay_ref": request.form.get("pay_ref", "").strip()[:60] if paid else None})
    if newly_paid:
        from push import notify_user
        notify_user(i.user_id, f"₹{app.config['REWARD_PER_POST']} reward paid 🎉",
                    f"Your post \"{i.title[:60]}\" earned ₹{app.config['REWARD_PER_POST']}. Check your PhonePe.", {"type": "reward", "issue_id": iid})
    flash(f"Marked {'PAID' if paid else 'NOT PAID'}")
    return redirect(request.referrer or url_for("admin.issue", iid=iid))


@admin.post("/comments/<cid>/delete")
@login_required
def comment_delete(cid):
    c = aw.get("comments", cid) or abort(404)
    replies = aw.all("comments", [S.equal("parent_id", cid)])  # replies go with their parent
    for r in [*replies, c]:
        for l in aw.all("comment_likes", [S.equal("comment_id", r.id)]):
            aw.delete("comment_likes", l.id)
        aw.delete("comments", r.id)
    if c.parent_id:
        aw.incr("comments", c.parent_id, "reply_count", -1)
    iid = c.issue_id
    if aw.get("issues", iid):
        aw.incr("issues", iid, "comment_count", -(1 + len(replies)))
        last = aw.first("comments", [S.equal("issue_id", iid), S.order_desc("$createdAt")])
        u = aw.get("users", last.user_id) if last else None
        aw.update("issues", iid, {"last_comment": last.text[:300] if last else None,
                                  "last_comment_user": (u.name if u else None) if last else None})
    return redirect(url_for("admin.issue", iid=iid))


@admin.get("/requests")
@login_required
def requests_():
    qs = []
    if request.args.get("status"):
        qs.append(S.equal("status", request.args["status"]))
    if request.args.get("service"):
        qs.append(S.equal("service_id", request.args["service"]))
    items, _ = aw.list("service_requests", [*qs, S.order_desc("$createdAt")], lim=300, total=False)
    attach_request_refs(items)
    return render_template("requests.html", items=items, services=M.services())


def attach_request_refs(items):
    users = aw.by_ids("users", [r.user_id for r in items])
    sm = M.service_map()
    for r in items:
        r.user = users.get(r.user_id) or S.Row({"$id": r.user_id, "name": "(deleted)", "phone": "—"})
        r.service = sm.get(r.service_id) or S.Row({"$id": r.service_id, "name": "(removed)", "icon": ""})
    return items


@admin.post("/requests/<rid>")
@login_required
def request_update(rid):
    r = aw.get("service_requests", rid) or abort(404)
    patch = {"admin_note": request.form.get("admin_note", "")}
    if request.form.get("status") in SR_STATUS:
        patch["status"] = request.form["status"]
    aw.update("service_requests", r.id, patch)
    flash(f"Request updated")
    return redirect(request.referrer or url_for("admin.requests_"))


@admin.get("/users")
@login_required
def users():
    qs = []
    a = request.args
    if a.get("q"):
        qs.append(S.or_(S.contains("phone", a["q"]), S.contains("name", a["q"])))
    if a.get("verified"):
        qs.append(S.equal("is_verified", True))
    if a.get("ward"):
        qs.append(S.equal("ward_id", int(a["ward"])))
    items, _ = aw.list("users", [*qs, S.order_desc("$createdAt")], lim=500, total=False)
    return render_template("users.html", items=items, ic=aw.counts_by("issues", "user_id"),
                           sc=aw.counts_by("service_requests", "user_id"), wards=M.wards())


@admin.post("/users/<uid>/block")
@login_required
def user_block(uid):
    u = aw.get("users", uid) or abort(404)
    aw.update("users", uid, {"is_blocked": not u.is_blocked})
    return redirect(request.referrer or url_for("admin.users"))


@admin.post("/users/<uid>/verify")
@login_required
def user_verify(uid):
    u = aw.get("users", uid) or abort(404)
    aw.update("users", uid, {"is_verified": not u.is_verified})
    return redirect(request.referrer or url_for("admin.users"))


@admin.route("/voters", methods=["GET", "POST"])
@login_required
def voters():
    if request.method == "POST":
        f = request.files.get("csv")
        if not f:
            flash("Choose a CSV file")
        else:
            rows = csv.DictReader(io.StringIO(f.read().decode("utf-8-sig")))
            batch, skipped = {}, 0
            for r in rows:
                r = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
                epic = r.get("voter_id", "").upper()
                mob = re.sub(r"\D", "", r.get("mobile", ""))[-10:]
                if not re.fullmatch(r"[A-Z0-9]{6,15}", epic):
                    skipped += 1
                    continue
                row = {"$id": epic, "name": r.get("name", "")[:80], "relation": r.get("relation", "")[:12],
                       "relation_name": r.get("relation_name", "")[:100], "house": r.get("house", "")[:30],
                       "gender": r.get("gender", "")[:12], "section": r.get("section", "")[:60]}
                for k in ("age", "section_no", "serial"):
                    if r.get(k, "").isdigit():
                        row[k] = int(r[k])
                if len(mob) == 10:
                    row["mobile"] = mob
                batch[epic] = row
            aw.upsert_many("voter_roll", list(batch.values()))
            invalidate("voter_roll")
            flash(f"Imported {len(batch)} voters, skipped {skipped} invalid rows")
        return redirect(url_for("admin.voters"))
    # Whole roll is small (hundreds of rows): load it once (cached) and filter here, so every field is searchable.
    allv = sorted(cached_all("voter_roll", ttl=120), key=lambda v: (v.serial or 0))
    a = request.args
    q = (a.get("q") or "").strip().lower()
    sec, gen, only = a.get("section", ""), a.get("gender", ""), a.get("joined", "")
    joined = {u.voter_id for u in aw.all("users", [S.q("select", values=["voter_id"])]) if u.voter_id}
    items = []
    for v in allv:
        v.voter_id = v.id
        v.joined = v.id in joined
        hay = " ".join(str(x or "") for x in (v.id, v.name, v.relation_name, v.house, v.section)).lower()
        if q and q not in hay.replace("-", " ") and q not in hay:
            continue
        if sec and str(v.section_no) != sec:
            continue
        if gen and (v.gender or "")[:1].upper() != gen:
            continue
        if only == "yes" and not v.joined:
            continue
        if only == "no" and v.joined:
            continue
        items.append(v)
    return render_template("voters.html", total=len(allv), items=items[:300], found=len(items), joined_total=len(joined))


@admin.post("/voters/add")
@login_required
def voter_add():
    epic = request.form["voter_id"].strip().upper()
    mob = re.sub(r"\D", "", request.form.get("mobile", ""))[-10:]
    if re.fullmatch(r"[A-Z0-9]{6,15}", epic):
        data = {"name": request.form.get("name", "").strip()[:80], "house": request.form.get("house", "").strip()[:30],
                "relation_name": request.form.get("relation_name", "").strip()[:100]}
        if request.form.get("age", "").strip().isdigit():
            data["age"] = int(request.form["age"])
        if len(mob) == 10:
            data["mobile"] = mob
        aw.upsert("voter_roll", epic, data)
        invalidate("voter_roll")
    else:
        flash("Need a valid voter id (6-15 letters/digits)")
    return redirect(url_for("admin.voters"))


@admin.route("/catalog", methods=["GET", "POST"])
@login_required
def catalog():
    if request.method == "POST":
        if request.form.get("kind") == "ward":
            wid = request.form["ward_id"]
            if aw.get("wards", wid):
                aw.update("wards", wid, {"areas": request.form.get("areas", "").strip()[:200]})
                invalidate("wards")
            return redirect(url_for("admin.catalog"))
        kind, name = request.form["kind"], request.form["name"].strip()
        icon = request.form.get("icon", "").strip()[:8] or "📌"
        if name:
            if kind == "service" and not any(s.name == name for s in M.services()):
                aw.create("services", {"name": name[:80], "icon": icon, "active": True,
                                       "description": request.form.get("description", "")[:200]})
                invalidate("services")
            elif kind == "category" and not any(c.name == name for c in M.categories()):
                aw.create("categories", {"name": name[:60], "icon": icon})
                invalidate("categories")
        return redirect(url_for("admin.catalog"))
    return render_template("catalog.html", services=M.services(), cats=M.categories(), wards=M.wards())


@admin.post("/services/<sid>/toggle")
@login_required
def service_toggle(sid):
    s = aw.get("services", sid) or abort(404)
    aw.update("services", sid, {"active": not s.active})
    invalidate("services")
    return redirect(url_for("admin.catalog"))


@admin.get("/export/<what>.csv")
@login_required
def export(what):
    out = io.StringIO()
    w = csv.writer(out)
    if what == "requests":
        w.writerow(["id", "date", "service", "subject", "details", "status", "name", "phone", "verified"])
        rows = attach_request_refs(aw.all("service_requests", [S.order_asc("$createdAt")]))
        for r in rows:
            w.writerow([r.id, r.created_at, r.service.name, r.subject, r.details, r.status, r.user.name, r.user.phone, bool(r.user.is_verified)])
    elif what == "issues":
        w.writerow(["id", "date", "category", "title", "location", "status", "upvotes", "comments", "name", "phone", "reward", "paid", "paid_at", "pay_ref"])
        for i in attach_issue_refs(aw.all("issues", [S.order_asc("$createdAt")])):
            w.writerow([i.id, i.created_at, i.category.name if i.category else "", i.title, i.location, i.status,
                        i.upvote_count or 0, i.comment_count or 0, i.user.name, i.user.phone,
                        app.config["REWARD_PER_POST"], "paid" if i.paid else "not paid", i.paid_at or "", i.pay_ref or ""])
    else:
        w.writerow(["id", "joined", "name", "phone", "street", "verified", "voter_id"])
        for u in aw.all("users", [S.order_asc("$createdAt")]):
            w.writerow([u.id, u.created_at, u.name, u.phone, u.street, bool(u.is_verified), u.voter_id])
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={what}.csv"})
