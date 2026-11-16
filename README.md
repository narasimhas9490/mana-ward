# Mana Ward — Thakatamvaripalle (Ward 1), B.Kothakota NP, Annamayya Dist, AP

- `backend/` Flask API (`/api/*`) + admin dashboard (`/admin`)
- `mobile/` Expo (React Native) app

## Run backend
```
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env              # then set ADMIN_PASSWORD, SECRET_KEY and the APPWRITE_* values
python app.py                       # http://localhost:5000/admin  (default admin / admin123)
```

## Appwrite (data + photos)
Project `myWARD` (Singapore). The backend talks to Appwrite over REST with a server API key (scopes: `rows.read rows.write files.read files.write`).
- **TablesDB** `Production TablesDB`: `wards users otps voter_roll categories issues upvotes comments comment_likes services service_requests`. Seeded automatically on first start (wards, categories, services). Tables have no client permissions, so only the backend key can read or write.
- **Storage** bucket `issue-photos` (public read, JPG/PNG/WebP, 6 MB): issue photos are uploaded by the backend and served straight from Appwrite's CDN.
- Like/upvote/comment counts are denormalised on `issues`/`comments` and updated atomically with Appwrite increment/decrement.

OTPs print in the server console (and are returned to the app) while `SMS_PROVIDER=console` / `DEV_RETURN_OTP=true`.

## Run app
```
cd mobile && npm install && npx expo start
```
Edit `BASE_URL` in `mobile/src/api.js` to your PC's LAN IP (or deployed URL). Open in Expo Go.

## Voter-ID verification
There is no public API mapping a Voter ID to its registered mobile. So: admin uploads the ward voter list
(`voter_id,name,mobile` CSV) under **Admin → Voter List**. Verification sends an OTP to the mobile stored there;
entering it proves the user controls that voter's number.

## Before going live
Set strong `SECRET_KEY`/`ADMIN_PASSWORD`, `DEV_RETURN_OTP=false`, `SMS_PROVIDER=msg91` (DLT-registered OTP template),
serve over HTTPS (gunicorn app:app) and set the `APPWRITE_*` env vars on the host (DB and photos are already off-box).
