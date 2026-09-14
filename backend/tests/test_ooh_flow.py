"""OOH campaign flow + regression tests for /api. Fresh-DB safe (uses far-future dates)."""
import os
import io
import time
import requests
import pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PW = "demo123"

# ---------- helpers ----------

def _login(email, password=PW):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}, r.json()["user"]


@pytest.fixture(scope="module")
def user_auth():
    return _login("user@demo.it")


@pytest.fixture(scope="module")
def roma_l3():
    return _login("comune.l3@demo.it")


@pytest.fixture(scope="module")
def roma_l1():
    return _login("comune@demo.it")


@pytest.fixture(scope="module")
def milano_l3():
    return _login("comune.milano@demo.it")


@pytest.fixture(scope="module")
def napoli_l3():
    return _login("comune.napoli@demo.it")


@pytest.fixture(scope="module")
def superadmin():
    return _login("mattia.fabrizi92@gmail.com")


@pytest.fixture(scope="module")
def comuni():
    r = requests.get(f"{BASE}/comuni", timeout=15)
    assert r.status_code == 200
    by_name = {c["nome"]: c for c in r.json()}
    return by_name


# ---------- SPID removal ----------

class TestSpidRemoved:
    def test_spid_endpoint_gone(self):
        r = requests.post(f"{BASE}/auth/spid", timeout=15)
        assert r.status_code in (404, 405), f"spid should be removed, got {r.status_code}"


# ---------- Login ----------

class TestAuth:
    def test_user_login(self, user_auth):
        headers, user = user_auth
        assert user["ruolo"] == "user"

    def test_me(self, user_auth):
        h, _ = user_auth
        r = requests.get(f"{BASE}/auth/me", headers=h, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == "user@demo.it"


# ---------- Comuni & Tipologie ----------

class TestSeed:
    def test_comuni_three(self, comuni):
        assert set(["Roma", "Milano", "Napoli"]).issubset(comuni.keys()), list(comuni.keys())

    def test_tipologie(self):
        r = requests.get(f"{BASE}/ooh/tipologie", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3
        cats = {c["id"] for c in data}
        assert cats == {"cartacee", "dooh", "maxi"}

    def test_zone_roma(self, comuni):
        r = requests.get(f"{BASE}/ooh/zone", params={"comune_id": comuni["Roma"]["id"]}, timeout=15)
        assert r.status_code == 200
        zone = r.json()
        assert len(zone) == 4, f"expected 4 zone Roma, got {len(zone)}"
        for z in zone:
            assert z.get("impianti_count") == 12, z
            assert z.get("pacchetti_count") == 3
            assert isinstance(z.get("polygon"), list) and len(z["polygon"]) == 4
            assert z.get("quartiere")
            assert isinstance(z.get("vie"), list) and len(z["vie"]) >= 1

    def test_pacchetti_roma(self, comuni):
        r = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": comuni["Roma"]["id"],
            "data_inizio": "2027-04-01", "data_fine": "2027-04-15",
        }, timeout=20)
        assert r.status_code == 200
        pack = r.json()
        assert len(pack) == 12, len(pack)
        p0 = pack[0]
        assert "impianti" in p0 and len(p0["impianti"]) >= 1
        assert "disponibile" in p0
        assert p0["disponibile"] is True


# ---------- OOH Campaign full flow ----------

@pytest.fixture(scope="module")
def campagna_ooh(user_auth, comuni):
    h, _ = user_auth
    roma_id = comuni["Roma"]["id"]
    packs = requests.get(f"{BASE}/ooh/pacchetti", params={
        "comune_id": roma_id, "data_inizio": "2027-04-01", "data_fine": "2027-04-10",
    }, timeout=15).json()
    # pick 1 pacchetto (12+ impianti keeps assign fast is if small; but circuiti 5/8/12; pick smallest)
    packs_sorted = sorted(packs, key=lambda p: len(p["impianti"]))
    p = packs_sorted[0]
    r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
        "nome": "TEST_camp_ooh_1", "data_inizio": "2027-04-01", "data_fine": "2027-04-10",
        "pacchetti_ids": [p["id"]],
    }, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return data, p


class TestOOHCampagna:
    def test_create_hold(self, campagna_ooh):
        camp, pac = campagna_ooh
        assert camp["stato"] == "HOLD"
        assert "hold_expires_at" in camp
        assert len(camp["pratiche"]) == 1
        pr = camp["pratiche"][0]
        assert pr["tipo"] == "OOH"
        assert pr["stato"] == "DA_COMPLETARE"

    def test_overlap_conflict(self, campagna_ooh, user_auth):
        _, pac = campagna_ooh
        h, _ = user_auth
        r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
            "nome": "TEST_conflict", "data_inizio": "2027-04-05", "data_fine": "2027-04-08",
            "pacchetti_ids": [pac["id"]],
        }, timeout=15)
        assert r.status_code == 409, r.text

    def test_different_period_ok(self, campagna_ooh, user_auth):
        _, pac = campagna_ooh
        h, _ = user_auth
        r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
            "nome": "TEST_far_future", "data_inizio": "2027-11-01", "data_fine": "2027-11-05",
            "pacchetti_ids": [pac["id"]],
        }, timeout=15)
        assert r.status_code == 200, r.text
        # annulla to keep test clean
        cid = r.json()["id"]
        requests.post(f"{BASE}/ooh/campagne/{cid}/annulla", headers=h, timeout=15)

    def test_invia_before_complete_fails(self, campagna_ooh, user_auth):
        camp, _ = campagna_ooh
        h, _ = user_auth
        r = requests.post(f"{BASE}/ooh/campagne/{camp['id']}/invia", headers=h, timeout=15)
        assert r.status_code == 400, r.text


# ---------- OOH Completion + comune workflow ----------

class TestOOHCompletion:

    def test_full_flow(self, user_auth, campagna_ooh, comuni, roma_l3, milano_l3):
        h, _ = user_auth
        camp, _ = campagna_ooh
        cid = camp["id"]
        pratica = camp["pratiche"][0]
        pid = pratica["id"]

        # 1) modulo
        r = requests.put(f"{BASE}/ooh/pratiche/{pid}/dati-form", headers=h, json={
            "dati_form": {"descrizione_contenuto": "Banner promo TEST", "settore_merceologico": "Moda"}
        }, timeout=15)
        assert r.status_code == 200, r.text

        # 2) documenti obbligatori
        for tipo in ("bozzetto", "doc_identita"):
            files = {"file": (f"{tipo}.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}
            r = requests.post(f"{BASE}/pratiche/{pid}/documenti", headers=h, params={"tipo": tipo}, files=files, timeout=15)
            assert r.status_code == 200, f"doc {tipo}: {r.text}"

        # 3) creatività: raggruppa impianti per formato+digitale, crea 1 creatività per gruppo
        impianti = pratica["impianti"]
        # map tipologia -> is_dooh via tipologie endpoint
        tips = requests.get(f"{BASE}/ooh/tipologie", timeout=10).json()
        dooh_types = set(next(c for c in tips if c["id"] == "dooh")["tipi"])
        # group by (formato, digitale)
        gruppi = {}
        for imp in impianti:
            key = (imp.get("formato", ""), imp["tipologia"] in dooh_types)
            gruppi.setdefault(key, []).append(imp)

        # upload one creatività per gruppo
        for (formato, digitale), imps in gruppi.items():
            files = {"file": ("cr.png", io.BytesIO(b"\x89PNG\r\n\x1a\ntest"), "image/png")}
            r = requests.post(f"{BASE}/creativita", headers=h, params={
                "nome": f"TEST_cr_{formato}", "formato": formato, "digitale": str(digitale).lower(),
            }, files=files, timeout=15)
            assert r.status_code == 200, r.text
            cr_id = r.json()["id"]
            # assegna a ciascun impianto del gruppo
            for imp in imps:
                r2 = requests.post(f"{BASE}/ooh/pratiche/{pid}/creativita", headers=h,
                                   json={"impianto_id": imp["id"], "creativita_id": cr_id}, timeout=15)
                assert r2.status_code == 200, f"assegna {imp['codice']}: {r2.text}"

        # 3b) test mismatch: crea creatività digitale sbagliata e prova su impianto cartaceo
        cartacei = [i for i in impianti if i["tipologia"] not in dooh_types]
        dooh_imps = [i for i in impianti if i["tipologia"] in dooh_types]
        if cartacei and dooh_imps:
            # crea una creatività digitale con formato di un impianto cartaceo
            files = {"file": ("bad.mp4", io.BytesIO(b"fakevideo"), "video/mp4")}
            r = requests.post(f"{BASE}/creativita", headers=h, params={
                "nome": "TEST_bad", "formato": cartacei[0]["formato"], "digitale": "true",
            }, files=files, timeout=15)
            assert r.status_code == 200
            bad_id = r.json()["id"]
            r2 = requests.post(f"{BASE}/ooh/pratiche/{pid}/creativita", headers=h,
                               json={"impianto_id": cartacei[0]["id"], "creativita_id": bad_id}, timeout=15)
            assert r2.status_code == 400, f"expected 400 for cartacei+digitale, got {r2.status_code}"

        # 4) checkout mock
        r = requests.post(f"{BASE}/ooh/campagne/{cid}/checkout", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        assert "transazione_id" in r.json()

        # 5) invia
        r = requests.post(f"{BASE}/ooh/campagne/{cid}/invia", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # verify state
        r = requests.get(f"{BASE}/ooh/campagne/{cid}", headers=h, timeout=15)
        camp_now = r.json()
        assert camp_now["stato"] == "CONFERMATA"
        assert camp_now["pratiche"][0]["stato"] == "INVIATA"

        # 6) comune workflow: L3 Roma
        h_roma, _ = roma_l3
        r = requests.get(f"{BASE}/comune/pratiche", headers=h_roma, timeout=15)
        assert r.status_code == 200
        praticas = r.json()
        found = [p for p in praticas if p["id"] == pid]
        assert len(found) == 1, "Roma L3 should see the OOH pratica"

        # scope: Milano must NOT see it
        h_mi, _ = milano_l3
        r = requests.get(f"{BASE}/comune/pratiche", headers=h_mi, timeout=15)
        assert r.status_code == 200
        assert pid not in {p["id"] for p in r.json()}

        # transition presa_in_carico -> IN_VERIFICA (OOH)
        r = requests.post(f"{BASE}/comune/pratiche/{pid}/transizione", headers=h_roma,
                          json={"azione": "presa_in_carico"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stato"] == "IN_VERIFICA"

        # approva -> APPROVATA
        r = requests.post(f"{BASE}/comune/pratiche/{pid}/transizione", headers=h_roma,
                          json={"azione": "approva"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stato"] == "APPROVATA"

        # Milano cannot act on Roma pratica
        r = requests.post(f"{BASE}/comune/pratiche/{pid}/transizione", headers=h_mi,
                          json={"azione": "presa_in_carico"}, timeout=15)
        assert r.status_code in (403, 404)


# ---------- Annulla flow ----------

class TestAnnulla:
    def test_annulla_frees_impianti(self, user_auth, comuni):
        h, _ = user_auth
        roma_id = comuni["Roma"]["id"]
        packs = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": roma_id, "data_inizio": "2028-01-01", "data_fine": "2028-01-05",
        }, timeout=15).json()
        p = sorted(packs, key=lambda x: len(x["impianti"]))[-1]
        r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
            "nome": "TEST_annulla", "data_inizio": "2028-01-01", "data_fine": "2028-01-05",
            "pacchetti_ids": [p["id"]],
        }, timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]
        # verify not disponibile now
        packs2 = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": roma_id, "data_inizio": "2028-01-01", "data_fine": "2028-01-05",
        }, timeout=15).json()
        target = next(x for x in packs2 if x["id"] == p["id"])
        assert target["disponibile"] is False

        r = requests.post(f"{BASE}/ooh/campagne/{cid}/annulla", headers=h, timeout=15)
        assert r.status_code == 200

        packs3 = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": roma_id, "data_inizio": "2028-01-01", "data_fine": "2028-01-05",
        }, timeout=15).json()
        target = next(x for x in packs3 if x["id"] == p["id"])
        assert target["disponibile"] is True


# ---------- Backoffice comune scope + L3 role ----------

class TestComuneBackoffice:
    def test_zone_scoped(self, roma_l3, milano_l3):
        hr, _ = roma_l3
        hm, _ = milano_l3
        zr = requests.get(f"{BASE}/comune/zone", headers=hr, timeout=15).json()
        zm = requests.get(f"{BASE}/comune/zone", headers=hm, timeout=15).json()
        assert len(zr) == 4 and len(zm) == 4
        # no overlap in comune_id
        assert {z["comune_id"] for z in zr}.isdisjoint({z["comune_id"] for z in zm})

    def test_l1_cannot_write(self, roma_l1):
        h, _ = roma_l1
        r = requests.post(f"{BASE}/comune/zone", headers=h, json={
            "nome": "TEST_L1", "vie": [], "polygon": [], "quartiere": ""
        }, timeout=15)
        assert r.status_code == 403


# ---------- Admin onboarding sospendi ----------

class TestAdminSospendi:
    def test_sospendi_and_restore(self, superadmin, comuni):
        h, _ = superadmin
        nap_id = comuni["Napoli"]["id"]
        # sospendi
        r = requests.patch(f"{BASE}/admin/comuni/{nap_id}/stato", headers=h,
                           json={"stato_onboarding": "SOSPESO"}, timeout=15)
        assert r.status_code == 200, r.text
        # public list should hide Napoli
        pub = requests.get(f"{BASE}/comuni", timeout=15).json()
        assert nap_id not in {c["id"] for c in pub}, "SOSPESO comune must be hidden"
        # restore
        r = requests.patch(f"{BASE}/admin/comuni/{nap_id}/stato", headers=h,
                           json={"stato_onboarding": "ATTIVO"}, timeout=15)
        assert r.status_code == 200
        pub2 = requests.get(f"{BASE}/comuni", timeout=15).json()
        assert nap_id in {c["id"] for c in pub2}


# ---------- OSP regression ----------

class TestOSPRegression:
    def test_spazi_only_osp(self):
        r = requests.get(f"{BASE}/spazi", timeout=15).json()
        # per seed: Roma 2, Milano 1, Napoli 1 = 4
        assert len(r) == 4, f"expected 4 OSP spazi, got {len(r)}: {[s['nome'] for s in r]}"
        for s in r:
            assert s.get("tipologia") == "Area Eventi / OSP"

    def test_osp_wizard_flow(self, user_auth):
        h, _ = user_auth
        spazi = requests.get(f"{BASE}/spazi", timeout=15).json()
        s = spazi[0]
        # crea pratica
        r = requests.post(f"{BASE}/pratiche", headers=h, json={
            "spazio_id": s["id"], "data_inizio": "2027-06-01", "data_fine": "2027-06-03",
            "dati_form": {"descrizione_evento": "TEST evento", "tipo_occupazione": "Gazebo", "superficie_mq": 20},
        }, timeout=15)
        assert r.status_code == 200, r.text
        pratica = r.json()
        pid = pratica["id"]
        assert pratica.get("tipo") in ("OSP", None)  # tolerant
        # upload required docs
        for tipo in ("planimetria", "polizza_assicurativa", "doc_identita"):
            files = {"file": (f"{tipo}.pdf", io.BytesIO(b"%PDF"), "application/pdf")}
            r = requests.post(f"{BASE}/pratiche/{pid}/documenti", headers=h, params={"tipo": tipo}, files=files, timeout=15)
            assert r.status_code == 200, f"doc {tipo}: {r.text}"
        # checkout
        r = requests.post(f"{BASE}/pratiche/{pid}/checkout", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # invia
        r = requests.post(f"{BASE}/pratiche/{pid}/invia", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # cleanup: comune (Roma L3) can pick up
