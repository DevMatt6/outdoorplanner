# Auth Testing Playbook — Outdoor Planner

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({ruolo: "superadmin"}).pretty()
db.users.findOne({email: "user@demo.it"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email.

## Step 2: API Testing (Bearer token)
```
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"user@demo.it","password":"demo123"}'
# → returns {user, access_token}
curl http://localhost:8001/api/auth/me -H "Authorization: Bearer <access_token>"
```

## Mock SPID
```
curl -X POST http://localhost:8001/api/auth/spid
```
Logs in / creates spid.demo@demo.it and returns token.

Credentials: see /app/memory/test_credentials.md (all passwords: demo123).
