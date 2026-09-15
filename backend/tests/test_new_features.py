"""New spec: derived formato, computed pacchetto prezzo, Aree OSP zona_id + Progetto Speciale,
profilo/canone removed, soggetti flow (formati/upload/assign/delete), old creativita library removed."""
import os
import io
import uuid
import requests
import pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PW = "demo123"


def _login(email):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": PW}, timeout=15)
    assert r.status_code == 200, f"{email}: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["user"]


@pytest.fixture(scope="module")
def user_h():
    return _login("user@demo.it")


@pytest.fixture(scope="module")
def roma_l3():
    return _login("comune.l3@demo.it")


@pytest.fixture(scope="module")
def roma_l1():
    return _login("comune@demo.it")


@pytest.fixture(scope="module")
def comuni():
    r = requests.get(f"{BASE}/comuni", timeout=15)
    return {c["nome"]: c for c in r.json()}


# -------- Removed endpoints --------

class TestRemovedEndpoints:
    def test_put_comune_profilo_removed(self, roma_l3):
        h, _ = roma_l3
        r = requests.put(f"{BASE}/comune/profilo", headers=h, json={"nome": "X"}, timeout=15)
        assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code}"

    def test_get_comune_profilo_still_ok(self, roma_l3):
        h, _ = roma_l3
        r = requests.get(f"{BASE}/comune/profilo", headers=h, timeout=15)
        assert r.status_code == 200
        assert "nome" in r.json()

    def test_patch_canone_removed(self, roma_l3):
        h, _ = roma_l3
        # first find any spazio (may be empty)
        spazi = requests.get(f"{BASE}/comune/spazi", headers=h, timeout=15).json()
        sid = spazi[0]["id"] if spazi else "no-such-id"
        r = requests.patch(f"{BASE}/comune/spazi/{sid}/canone", headers=h, json={"canone_giornaliero": 10}, timeout=15)
        assert r.status_code in (404, 405), r.status_code

    def test_old_creativita_library_removed(self, user_h):
        h, _ = user_h
        # Old library create endpoint should not exist
        files = {"file": ("x.png", io.BytesIO(b"\x89PNG\r\n"), "image/png")}
        r = requests.post(f"{BASE}/creativita", headers=h, params={"nome": "x", "formato": "6x3 m", "digitale": "false"}, files=files, timeout=15)
        assert r.status_code in (404, 405, 422), f"old /creativita should be gone, got {r.status_code}"


# -------- Derived formato on impianti + computed pacchetto price --------

class TestImpiantiFormatoDerived:
    def test_create_impianto_derives_formato(self, roma_l3, comuni):
        h, _ = roma_l3
        zone = requests.get(f"{BASE}/comune/zone", headers=h, timeout=15).json()
        assert zone, "no zones for Roma L3"
        z = zone[0]
        codice = f"TEST-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE}/comune/impianti", headers=h, json={
            "codice": codice, "zona_id": z["id"], "via": "Via Test",
            "lat": 41.9, "lng": 12.5, "tipologia": "Poster Maxi 6x3", "prezzo": 400,
            "foto_url": ""
        }, timeout=15)
        assert r.status_code == 200, r.text
        imp = r.json()
        assert imp["formato"] == "6x3 m", imp
        assert imp["categoria"] == "maxi"
        assert imp["indirizzo"] == "Via Test"
        assert imp["prezzo"] == 400
        # cleanup
        requests.delete(f"{BASE}/comune/impianti/{imp['id']}", headers=h, timeout=10)

    def test_pacchetto_prezzo_is_sum(self, comuni):
        roma_id = comuni["Roma"]["id"]
        r = requests.get(f"{BASE}/ooh/pacchetti", params={"comune_id": roma_id}, timeout=15)
        assert r.status_code == 200
        packs = r.json()
        assert len(packs) > 0
        for p in packs[:5]:
            expected = round(sum(i.get("prezzo", 0) for i in p["impianti"]), 2)
            assert p["prezzo_giornaliero"] == expected, f"{p['nome']}: {p['prezzo_giornaliero']} vs {expected}"

    def test_change_impianto_prezzo_updates_pacchetto(self, roma_l3, comuni):
        h, _ = roma_l3
        roma_id = comuni["Roma"]["id"]
        # take existing pacchetto
        packs = requests.get(f"{BASE}/comune/pacchetti", headers=h, timeout=15).json()
        assert packs
        p = packs[0]
        orig_prezzo = p["prezzo_giornaliero"]
        # pick one impianto in it
        imp_id = p["impianti_ids"][0]
        imp = requests.get(f"{BASE}/comune/impianti", headers=h, timeout=15).json()
        target = next(i for i in imp if i["id"] == imp_id)
        # +100
        new_prezzo = target["prezzo"] + 100
        r = requests.put(f"{BASE}/comune/impianti/{imp_id}", headers=h, json={
            "codice": target["codice"], "zona_id": target["zona_id"], "via": target.get("via", ""),
            "lat": target["lat"], "lng": target["lng"], "tipologia": target["tipologia"],
            "prezzo": new_prezzo, "foto_url": target.get("foto_url", ""),
        }, timeout=15)
        assert r.status_code == 200, r.text
        packs2 = requests.get(f"{BASE}/comune/pacchetti", headers=h, timeout=15).json()
        p2 = next(x for x in packs2 if x["id"] == p["id"])
        assert p2["prezzo_giornaliero"] == round(orig_prezzo + 100, 2), (orig_prezzo, p2["prezzo_giornaliero"])
        # restore
        requests.put(f"{BASE}/comune/impianti/{imp_id}", headers=h, json={
            "codice": target["codice"], "zona_id": target["zona_id"], "via": target.get("via", ""),
            "lat": target["lat"], "lng": target["lng"], "tipologia": target["tipologia"],
            "prezzo": target["prezzo"], "foto_url": target.get("foto_url", ""),
        }, timeout=15)


class TestPacchettoNoPrice:
    def test_pacchetto_create_without_prezzo(self, roma_l3):
        h, _ = roma_l3
        zone = requests.get(f"{BASE}/comune/zone", headers=h, timeout=15).json()
        imps = requests.get(f"{BASE}/comune/impianti", headers=h, timeout=15).json()
        zone_id = zone[0]["id"]
        imp_ids = [i["id"] for i in imps if i["zona_id"] == zone_id][:2]
        r = requests.post(f"{BASE}/comune/pacchetti", headers=h, json={
            "zona_id": zone_id, "nome": f"TEST_pk_{uuid.uuid4().hex[:5]}",
            "impianti_ids": imp_ids, "attivo": True
        }, timeout=15)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # verify computed price
        packs = requests.get(f"{BASE}/comune/pacchetti", headers=h, timeout=15).json()
        me = next(x for x in packs if x["id"] == pid)
        expected = round(sum(i["prezzo"] for i in imps if i["id"] in imp_ids), 2)
        assert me["prezzo_giornaliero"] == expected
        # cleanup
        requests.delete(f"{BASE}/comune/pacchetti/{pid}", headers=h, timeout=10)


class TestZoneVieDerived:
    def test_zone_vie_from_impianti(self, comuni):
        roma_id = comuni["Roma"]["id"]
        zone = requests.get(f"{BASE}/ooh/zone", params={"comune_id": roma_id}, timeout=15).json()
        for z in zone:
            assert isinstance(z["vie"], list)
            # vie should be derived non-empty (impianti seeded)
            assert len(z["vie"]) >= 1


# -------- Aree OSP: Progetto Speciale forced + zona_id --------

class TestAreeOSP:
    def test_create_spazio_forces_tipologia(self, roma_l3):
        h, _ = roma_l3
        zone = requests.get(f"{BASE}/comune/zone", headers=h, timeout=15).json()
        assert zone
        r = requests.post(f"{BASE}/comune/spazi", headers=h, json={
            "nome": f"TEST_OSP_{uuid.uuid4().hex[:5]}",
            "zona_id": zone[0]["id"], "indirizzo": "Via Test 1",
            "lat": 41.9, "lng": 12.5, "canone_giornaliero": 50, "foto_url": ""
        }, timeout=15)
        assert r.status_code == 200, r.text
        sp = r.json()
        assert sp["tipologia"] == "Progetto Speciale"
        assert sp["zona_id"] == zone[0]["id"]
        # update should keep it forced even if payload tries otherwise (payload has no tipologia field now)
        r2 = requests.put(f"{BASE}/comune/spazi/{sp['id']}", headers=h, json={
            "nome": sp["nome"], "zona_id": zone[0]["id"], "indirizzo": "Via Test 1",
            "lat": 41.9, "lng": 12.5, "canone_giornaliero": 60, "foto_url": ""
        }, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["tipologia"] == "Progetto Speciale"
        # cleanup
        requests.delete(f"{BASE}/comune/spazi/{sp['id']}", headers=h, timeout=10)


# -------- Soggetti flow: formati / upload / assign / delete --------

@pytest.fixture(scope="module")
def campagna_5(user_h, comuni):
    h, _ = user_h
    roma_id = comuni["Roma"]["id"]
    # Look for "Circuito .. 5" pacchetto (5 impianti = 5 formats)
    packs = requests.get(f"{BASE}/ooh/pacchetti", params={"comune_id": roma_id}, timeout=15).json()
    small = sorted(packs, key=lambda p: p["n_impianti"])
    # pick one with min number of impianti to keep upload cheap
    p = small[0]
    r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
        "nome": f"TEST_sog_{uuid.uuid4().hex[:5]}",
        "data_inizio": "2028-05-01", "data_fine": "2028-05-03",
        "pacchetti_ids": [p["id"]],
    }, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    # cleanup
    if data.get("stato") == "HOLD":
        requests.post(f"{BASE}/ooh/campagne/{data['id']}/annulla", headers=h, timeout=10)


class TestSoggetti:
    def test_formati_endpoint(self, user_h, campagna_5):
        h, _ = user_h
        cid = campagna_5["id"]
        r = requests.get(f"{BASE}/ooh/campagne/{cid}/formati", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        fmts = r.json()
        assert len(fmts) >= 1
        for f in fmts:
            assert "formato" in f and "n_impianti" in f and "tipologie" in f
            assert f["n_impianti"] >= 1

    def test_upload_and_assign_soggetto(self, user_h, campagna_5):
        h, _ = user_h
        cid = campagna_5["id"]
        pratica = campagna_5["pratiche"][0]
        pid = pratica["id"]
        fmts = requests.get(f"{BASE}/ooh/campagne/{cid}/formati", headers=h, timeout=15).json()

        # 1) upload one soggetto per formato
        sogg_per_fmt = {}
        for i, f in enumerate(fmts):
            files = {"file": ("s.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + f["formato"].encode()), "image/png")}
            r = requests.post(f"{BASE}/ooh/campagne/{cid}/soggetti", headers=h,
                              params={"formato": f["formato"], "ordine": 1, "nome": f"TEST_s_{i}"},
                              files=files, timeout=15)
            assert r.status_code == 200, f"upload {f['formato']}: {r.text}"
            sogg_per_fmt[f["formato"]] = r.json()["id"]

        # 2) list soggetti
        r = requests.get(f"{BASE}/ooh/campagne/{cid}/soggetti", headers=h, timeout=15)
        assert r.status_code == 200 and len(r.json()) == len(fmts)

        # 3) assign each soggetto to matching impianti
        for imp in pratica["impianti"]:
            sid = sogg_per_fmt.get(imp["formato"])
            assert sid, f"missing soggetto for {imp['formato']}"
            r = requests.post(f"{BASE}/ooh/pratiche/{pid}/creativita", headers=h,
                              json={"impianto_id": imp["id"], "soggetto_id": sid}, timeout=15)
            assert r.status_code == 200, f"assign {imp['codice']}: {r.text}"

        # 4) mismatch: try assigning a soggetto to impianto of different formato
        impianti = pratica["impianti"]
        distinct = {}
        for i in impianti:
            distinct.setdefault(i["formato"], i)
        formats = list(distinct.keys())
        if len(formats) >= 2:
            wrong_soggetto = sogg_per_fmt[formats[0]]
            wrong_impianto = distinct[formats[1]]
            r = requests.post(f"{BASE}/ooh/pratiche/{pid}/creativita", headers=h,
                              json={"impianto_id": wrong_impianto["id"], "soggetto_id": wrong_soggetto}, timeout=15)
            assert r.status_code == 400, f"expected 400 mismatch, got {r.status_code}: {r.text}"

    def test_full_flow_invia(self, user_h, campagna_5):
        h, _ = user_h
        cid = campagna_5["id"]
        pratica = campagna_5["pratiche"][0]
        pid = pratica["id"]

        # modulo
        r = requests.put(f"{BASE}/ooh/pratiche/{pid}/dati-form", headers=h, json={
            "dati_form": {"descrizione_contenuto": "TEST", "settore_merceologico": "Moda"}
        }, timeout=15)
        assert r.status_code == 200

        # docs
        for tipo in ("bozzetto", "doc_identita"):
            files = {"file": (f"{tipo}.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}
            r = requests.post(f"{BASE}/pratiche/{pid}/documenti", headers=h,
                              params={"tipo": tipo}, files=files, timeout=15)
            assert r.status_code == 200, r.text

        # checkout
        r = requests.post(f"{BASE}/ooh/campagne/{cid}/checkout", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # invia
        r = requests.post(f"{BASE}/ooh/campagne/{cid}/invia", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # check
        camp = requests.get(f"{BASE}/ooh/campagne/{cid}", headers=h, timeout=15).json()
        assert camp["stato"] == "CONFERMATA"
        assert camp["pratiche"][0]["stato"] == "INVIATA"

    def test_delete_soggetto_removes_assignments(self, user_h, comuni):
        """New campaign: upload+assign, delete soggetto, verify assignment gone & creativita_ok=False."""
        h, _ = user_h
        roma_id = comuni["Roma"]["id"]
        packs = requests.get(f"{BASE}/ooh/pacchetti", params={"comune_id": roma_id}, timeout=15).json()
        p = sorted(packs, key=lambda x: x["n_impianti"])[0]
        r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
            "nome": f"TEST_del_{uuid.uuid4().hex[:5]}",
            "data_inizio": "2028-08-01", "data_fine": "2028-08-03",
            "pacchetti_ids": [p["id"]],
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        cid = data["id"]
        pratica = data["pratiche"][0]
        pid = pratica["id"]

        fmts = requests.get(f"{BASE}/ooh/campagne/{cid}/formati", headers=h, timeout=15).json()
        f0 = fmts[0]["formato"]
        # upload single soggetto for first formato
        files = {"file": ("s.png", io.BytesIO(b"\x89PNG\r\n"), "image/png")}
        r = requests.post(f"{BASE}/ooh/campagne/{cid}/soggetti", headers=h,
                          params={"formato": f0}, files=files, timeout=15)
        assert r.status_code == 200
        sid = r.json()["id"]
        # assign to first matching impianto
        imp = next(i for i in pratica["impianti"] if i["formato"] == f0)
        r = requests.post(f"{BASE}/ooh/pratiche/{pid}/creativita", headers=h,
                          json={"impianto_id": imp["id"], "soggetto_id": sid}, timeout=15)
        assert r.status_code == 200

        # verify assignment present
        camp = requests.get(f"{BASE}/ooh/campagne/{cid}", headers=h, timeout=15).json()
        pratica_now = camp["pratiche"][0]
        assert any(a.get("soggetto_id") == sid for a in pratica_now.get("creativita", []))

        # delete soggetto
        r = requests.delete(f"{BASE}/ooh/soggetti/{sid}", headers=h, timeout=15)
        assert r.status_code == 200

        # verify assignment removed and checklist creativita_ok=False (impianti unassigned)
        camp2 = requests.get(f"{BASE}/ooh/campagne/{cid}", headers=h, timeout=15).json()
        pratica_now2 = camp2["pratiche"][0]
        assert not any(a.get("soggetto_id") == sid for a in pratica_now2.get("creativita", []))
        assert pratica_now2["checklist"]["creativita_ok"] is False

        # cleanup
        requests.post(f"{BASE}/ooh/campagne/{cid}/annulla", headers=h, timeout=10)
