"""Data model now lives in Appwrite TablesDB (see store.py). This module keeps constants, seed data and row->json helpers.

Tables: wards, users, otps, voter_roll, categories, issues, upvotes, comments, comment_likes, services, service_requests.
"""
from store import aw, cached_all, now  # noqa: F401  (now re-exported for callers)

OPEN_WARDS = {1}  # wards residents can currently join

SEED_CATEGORIES = [("Roads & Potholes","🛣️"),("Drinking Water","💧"),("Drainage & Sewage","🚰"),
    ("Street Lights","💡"),("Garbage & Sanitation","🗑️"),("Electricity","⚡"),("Mosquito / Health","🦟"),
    ("Encroachment","🚧"),("Other","📌")]
SEED_SERVICES = [("Ration Card","🍚","New card, add/remove member, correction, not receiving rations"),
    ("Pension (Aasara/YSR)","👵","Old age, widow, disabled pension issues"),
    ("Aadhaar Update","🆔","Address / mobile / name update help"),
    ("Voter ID","🗳️","New voter card, correction, shifting"),
    ("Birth / Death Certificate","📜","Apply or correct"),
    ("Caste / Income Certificate","📑","Help with applying"),
    ("House Tax / Assessment","🏠","Tax correction, new assessment"),
    ("Water Tap Connection","🚿","New connection or repair"),
    ("Housing Scheme","🏘️","House site / PMAY / housing loan"),
    ("Other Problem","❓","Anything else you need help with")]


# ---- lookups (cached 60s; admin edits call store.invalidate) ----
def wards():
    return sorted(cached_all("wards"), key=lambda w: int(w.id))


def ward_json(w):
    n = int(w.id)
    return {"id": n, "name": f"Ward {n}", "areas": w.areas or "", "open": n in OPEN_WARDS}


def get_ward(wid):
    return next((w for w in wards() if int(w.id) == int(wid or 1)), None)


def categories():
    return cached_all("categories")


def category_map():
    return {c.id: c for c in categories()}


def services():
    return cached_all("services")


def service_map():
    return {s.id: s for s in services()}


def user_public(u):
    return {"id": u.id, "name": u.name or "Resident", "verified": bool(u.is_verified)}


def user_me(u):
    w = get_ward(u.ward_id)
    return {**user_public(u), "phone": u.phone, "street": u.street or "", "voter_id": u.voter_id,
            "ward": ward_json(w) if w else None}


def seed():
    """Idempotent: fill empty lookup tables."""
    if not aw.count("wards"):
        aw.create_many("wards", [{"$id": str(n), "areas": "Thakatamvaripalle, Balasanipalle" if n == 1 else ""}
                                 for n in range(1, 24)])  # B.Kothakota Nagar Panchayat has 23 wards
    if not aw.count("categories"):
        aw.create_many("categories", [{"$id": f"c{i + 1}", "name": n, "icon": ic} for i, (n, ic) in enumerate(SEED_CATEGORIES)])
    if not aw.count("services"):
        aw.create_many("services", [{"$id": f"s{i + 1}", "name": n, "icon": ic, "description": d, "active": True}
                                    for i, (n, ic, d) in enumerate(SEED_SERVICES)])
