"""Setup TEST_ infrastructure for iteration 14 UI tests."""
import os, requests, time, json, sys

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://advert-hub-47.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
TS = int(time.time())

def die(msg): print("FAIL:", msg); sys.exit(1)

# Login superadmin
r = requests.post(f"{API}/auth/login", json={"email": "mattia.fabrizi92@gmail.com", "password": "demo123"})
if r.status_code != 200: die(f"superadmin login {r.status_code} {r.text}")
sa = r.json()["access_token"]
H_SA = {"Authorization": f"Bearer {sa}"}

# Create comune TEST_ in Toscana (unused for real data)
comune_name = f"TEST_Iter14_{TS}"
l3_email = f"test_iter14_l3_{TS}@demo.it"
r = requests.post(f"{API}/admin/comuni", headers=H_SA, json={
    "nome": comune_name, "regione": "Toscana", "provincia": "FI",
    "lat": 43.7696, "lng": 11.2558, "logo_url": "",
    "livelli_attivi": [1, 2, 3],
    "utenze": [{"email": l3_email, "nome": "Test L3", "password": "demo123", "livello": 3}]
})
if r.status_code != 200: die(f"comune create {r.status_code} {r.text}")
data = r.json()
comune_id = data["comune"]["id"]
print(f"comune_id={comune_id}")

# Login L3
r = requests.post(f"{API}/auth/login", json={"email": l3_email, "password": "demo123"})
if r.status_code != 200: die(f"L3 login {r.status_code} {r.text}")
l3_tok = r.json()["access_token"]
H_L3 = {"Authorization": f"Bearer {l3_tok}"}

# Create zone
r = requests.post(f"{API}/comune/zone", headers=H_L3, json={
    "nome": "Centro TEST", "descrizione": "Zona centrale", "quartiere": "Centro",
    "polygon": [[43.769, 11.253], [43.773, 11.253], [43.773, 11.259], [43.769, 11.259]]
})
if r.status_code != 200: die(f"zona create {r.status_code} {r.text}")
zona_id = r.json()["id"]
print(f"zona_id={zona_id}")

# Create 3 impianti - impianto 1 with external foto_url
EXT_FOTO = "https://www.sgcommunication.it/wp-content/uploads/2016/03/maxi-cartelloni-stradali.jpg"
impianti_data = [
    {"codice": "TEST-IMP-01", "zona_id": zona_id, "via": "Via Roma 10", "lat": 43.7705, "lng": 11.2560,
     "tipologia": "Manifesto 200x140", "prezzo": 30.0, "foto_url": EXT_FOTO, "note": "con foto"},
    {"codice": "TEST-IMP-02", "zona_id": zona_id, "via": "Via Verdi 5", "lat": 43.7712, "lng": 11.2570,
     "tipologia": "Manifesto 200x140", "prezzo": 25.0, "foto_url": "", "note": "no foto"},
    {"codice": "TEST-IMP-03", "zona_id": zona_id, "via": "Via Dante 8", "lat": 43.7700, "lng": 11.2555,
     "tipologia": "Manifesto 200x140", "prezzo": 28.0, "foto_url": "", "note": ""},
]
impianti_ids = []
for imp in impianti_data:
    r = requests.post(f"{API}/comune/impianti", headers=H_L3, json=imp)
    if r.status_code != 200: die(f"impianto create {r.status_code} {r.text}")
    impianti_ids.append(r.json()["id"])
print(f"impianti_ids={impianti_ids}")

# Create pacchetto/circuito
r = requests.post(f"{API}/comune/pacchetti", headers=H_L3, json={
    "zona_id": zona_id, "nome": "Circuito TEST Centro", "descrizione": "3 impianti TEST",
    "impianti_ids": impianti_ids, "attivo": True
})
if r.status_code != 200: die(f"pacchetto create {r.status_code} {r.text}")
pac_id = r.json()["id"]
print(f"pacchetto_id={pac_id}")

out = {"comune_id": comune_id, "comune_nome": comune_name, "zona_id": zona_id,
       "impianti_ids": impianti_ids, "pacchetto_id": pac_id, "l3_email": l3_email,
       "regione": "Toscana"}
with open("/tmp/iter14_setup.json", "w") as f:
    json.dump(out, f)
print("SETUP OK:", json.dumps(out))
