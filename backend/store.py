"""Thin Appwrite TablesDB + Storage client (REST via `requests`). Server-side API key only."""
import json, os, threading, time
from datetime import datetime, timezone
import requests


def _cfg(k):
    return os.environ[k]


class AppwriteError(Exception):
    def __init__(self, status, msg):
        super().__init__(f"Appwrite {status}: {msg}")
        self.status = status


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000+00:00")


def parse_dt(s):
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)


class Row:
    """Row with attribute access. `id` is the Appwrite $id (string)."""
    def __init__(self, d):
        self._d = d
        self.id = d["$id"]
        self.created_at = parse_dt(d.get("$createdAt"))

    def __getattr__(self, name):
        if name.startswith("__"):
            raise AttributeError(name)
        return self._d.get(name)

    def get(self, k, default=None):
        return self._d.get(k, default)


# ---- query helpers ----
def q(method, attribute=None, values=None):
    d = {"method": method}
    if attribute is not None:
        d["attribute"] = attribute
    if values is not None:
        d["values"] = values
    return d


def equal(a, v): return q("equal", a, v if isinstance(v, list) else [v])
def not_equal(a, v): return q("notEqual", a, [v])
def contains(a, v): return q("contains", a, [v])
def gte(a, v): return q("greaterThanEqual", a, [v])
def order_desc(a): return q("orderDesc", a)
def order_asc(a): return q("orderAsc", a)
def limit(n): return q("limit", values=[n])
def offset(n): return q("offset", values=[n])
def or_(*qs): return q("or", values=list(qs))


class Client:
    def __init__(self):
        self.s = requests.Session()
        self._ready = False

    def _init(self):
        if self._ready:
            return
        self.base = _cfg("APPWRITE_ENDPOINT").rstrip("/")
        self.project = _cfg("APPWRITE_PROJECT_ID")
        self.db = _cfg("APPWRITE_DATABASE_ID")
        self.bucket = _cfg("APPWRITE_BUCKET_ID")
        self.s.headers.update({"X-Appwrite-Project": self.project, "X-Appwrite-Key": _cfg("APPWRITE_API_KEY")})
        self._ready = True

    def _req(self, method, path, **kw):
        self._init()
        for attempt in range(3):
            r = self.s.request(method, self.base + path, timeout=20, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(0.4 * (attempt + 1))
                continue
            break
        if r.status_code >= 400:
            try:
                msg = r.json().get("message", r.text)
            except Exception:
                msg = r.text
            raise AppwriteError(r.status_code, msg)
        return r.json() if r.content else {}

    def _t(self, table):
        self._init()
        return f"/tablesdb/{self.db}/tables/{table}/rows"

    # ---- rows ----
    def list(self, table, queries=(), lim=25, total=True):
        qs = [json.dumps(x) for x in [*queries, limit(lim)]]
        d = self._req("GET", self._t(table), params=[("queries[]", x) for x in qs] + [("total", "true" if total else "false")])
        return [Row(r) for r in d["rows"]], int(d.get("total", 0))

    def all(self, table, queries=(), cap=5000):
        out, off = [], 0
        while len(out) < cap:
            rows, _ = self.list(table, [*queries, offset(off)], lim=100, total=False)
            out += rows
            if len(rows) < 100:
                break
            off += 100
        return out

    def first(self, table, queries=()):
        rows, _ = self.list(table, queries, lim=1, total=False)
        return rows[0] if rows else None

    def count(self, table, queries=()):
        return self.list(table, queries, lim=1)[1]

    def get(self, table, rid):
        try:
            return Row(self._req("GET", f"{self._t(table)}/{rid}"))
        except AppwriteError as e:
            if e.status == 404:
                return None
            raise

    def by_ids(self, table, ids):
        ids = sorted({i for i in ids if i})
        out = {}
        for k in range(0, len(ids), 100):
            for r in self.list(table, [equal("$id", ids[k:k + 100])], lim=100, total=False)[0]:
                out[r.id] = r
        return out

    def create(self, table, data, rid="unique()"):
        return Row(self._req("POST", self._t(table), json={"rowId": rid, "data": data}))

    def create_many(self, table, rows):
        """rows: list of dicts that include '$id'."""
        for k in range(0, len(rows), 100):
            self._req("POST", self._t(table), json={"rows": rows[k:k + 100]})

    def upsert_many(self, table, rows):
        """rows: list of dicts including '$id'; creates or replaces."""
        for k in range(0, len(rows), 100):
            chunk = rows[k:k + 100]
            try:
                self._req("PUT", self._t(table), json={"rows": chunk})
            except AppwriteError:
                for r in chunk:
                    self.upsert(table, r["$id"], {x: y for x, y in r.items() if x != "$id"})

    def counts_by(self, table, column, queries=()):
        """{value: row count} computed client-side from a single-column projection."""
        out = {}
        for r in self.all(table, [*queries, q("select", values=[column])]):
            out[r.get(column)] = out.get(r.get(column), 0) + 1
        return out

    def update(self, table, rid, data):
        return Row(self._req("PATCH", f"{self._t(table)}/{rid}", json={"data": data}))

    def upsert(self, table, rid, data):
        return Row(self._req("PUT", f"{self._t(table)}/{rid}", json={"data": data}))

    def delete(self, table, rid):
        try:
            self._req("DELETE", f"{self._t(table)}/{rid}")
        except AppwriteError as e:
            if e.status != 404:
                raise

    def incr(self, table, rid, column, by=1):
        if by < 0:  # decrement is its own endpoint; floor at 0 so counters never go negative
            self._req("PATCH", f"{self._t(table)}/{rid}/{column}/decrement", json={"value": -by, "min": 0})
        else:
            self._req("PATCH", f"{self._t(table)}/{rid}/{column}/increment", json={"value": by})

    # ---- storage ----
    def upload(self, fileobj, filename, mime):
        self._init()
        r = self.s.post(f"{self.base}/storage/buckets/{self.bucket}/files", timeout=60,
                        data={"fileId": "unique()"}, files={"file": (filename, fileobj, mime)})
        if r.status_code >= 400:
            raise AppwriteError(r.status_code, r.json().get("message", r.text))
        return r.json()["$id"]

    def delete_file(self, fid):
        try:
            self._req("DELETE", f"/storage/buckets/{self.bucket}/files/{fid}")
        except AppwriteError:
            pass

    def photo_url(self, fid):
        self._init()
        return f"{self.base}/storage/buckets/{self.bucket}/files/{fid}/view?project={self.project}"


aw = Client()


# ---- small TTL cache for rarely-changing lookup tables ----
_cache, _lock = {}, threading.Lock()


def cached_all(table, ttl=60):
    with _lock:
        hit = _cache.get(table)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]
    rows = aw.all(table)
    with _lock:
        _cache[table] = (time.time(), rows)
    return rows


def invalidate(*tables):
    with _lock:
        for t in tables:
            _cache.pop(t, None)
