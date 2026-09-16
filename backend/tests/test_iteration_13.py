"""Iteration 13 backend tests: OOH impianti_sel (P5), campi comuni multi-comune (P4),
integrazione strutturata con richieste (P3)."""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "mattia.fabrizi92@gmail.com", "password": "demo123"}
TS = uuid.uuid4().hex[:6]

# 2 comuni test, regioni diverse
COM_A = {"nome": f"TEST_Alfa_{TS}", "regione": "Piemonte", "provincia": "TO"}
COM_B = {"nome": f"TEST_Beta_{TS}", "regione": "Lombardia", "provincia": "MI"}
L3A = f"test_it13_l3a_{TS}@demo.it"
L2A = f"test_it13_l2a_{TS}@demo.it"
L3B = f"test_it13_l3b_{TS}@demo.it"
L2B = f"test_it13_l2b_{TS}@demo.it"
USER1 = f"test_it13_u1_{TS}@demo.it"
USER2 = f"test_it13_u2_{TS}@demo.it"

DINI = (date.today() + timedelta(days=120)).isoformat()
DFIN = (date.today() + timedelta(days=125)).isoformat()

state = {}


def _h(t): return {"Authorization": f"Bearer {t}"}


def _login(e, p):
    r = requests.post(f"{API}/auth/login", json={"email": e, "password": p})
    assert r.status_code == 200, f"login {e}: {r.text}"
    return r.json()["access_token"]


def _register(email, nome="Test User"):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "demo123", "nome": nome, "tipo_soggetto": "Privato",
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _create_comune(hs, com, l2_email, l3_email):
    r = requests.post(f"{API}/admin/comuni", headers=hs, json={
        "nome": com["nome"], "regione": com["regione"], "provincia": com["provincia"],
        "lat": 45.0, "lng": 8.0, "livelli_attivi": [1, 2, 3],
        "utenze": [
            {"email": l2_email, "password": "demo123", "nome": f"L2 {com['nome']}", "livello": 2},
            {"email": l3_email, "password": "demo123", "nome": f"L3 {com['nome']}", "livello": 3},
        ],
    })
    assert r.status_code == 200, r.text
    return r.json()["comune"]["id"]


def _create_infra(l3_token, tag, num_impianti=3):
    """Zona, N impianti stessa tipologia, form template, 1 pacchetto."""
    h = _h(l3_token)
    r = requests.post(f"{API}/comune/zone", headers=h, json={"nome": f"Z_{tag}", "descrizione": ""})
    assert r.status_code == 200, r.text
    zid = r.json()["id"]
    imps = []
    for i in range(num_impianti):
        r = requests.post(f"{API}/comune/impianti", headers=h, json={
            "codice": f"IMP_{tag}_{i}", "zona_id": zid, "via": "Via Test",
            "lat": 45.0 + i * 0.001, "lng": 8.0, "tipologia": "Manifesto 200x140",
            "prezzo": 30.0 + i,  # prezzi diversi per verificare somma
        })
        assert r.status_code == 200, r.text
        imps.append(r.json())
    # form template con campo COMUNE_SHARED (stesso id in entrambi i comuni) + campo specifico
    r = requests.post(f"{API}/comune/form-templates", headers=h, json={
        "nome": f"Modulo OOH {tag}", "tipo": "OOH",
        "campi": [
            {"id": "shared_field", "label": "Campo condiviso", "tipo": "text", "required": True},
            {"id": f"spec_{tag}", "label": f"Spec {tag}", "tipo": "text", "required": False},
        ],
        "documenti_richiesti": [
            {"id": "bozzetto", "label": "Bozzetto", "required": True},
        ],
    })
    assert r.status_code == 200, r.text
    # patch tipo (crea_template non usa 'tipo' del payload, verifichiamo)
    tpl_id = r.json()["id"]
    # forziamo tipo OOH via db? l'API non lo espone → il template è generico e verrà usato come fallback
    r = requests.post(f"{API}/comune/pacchetti", headers=h, json={
        "zona_id": zid, "nome": f"Pacchetto {tag}",
        "impianti_ids": [x["id"] for x in imps], "attivo": True,
        "form_template_id": tpl_id,
    })
    assert r.status_code == 200, r.text
    return {"zona_id": zid, "impianti": imps, "pacchetto_id": r.json()["id"], "template_id": tpl_id}


@pytest.fixture(scope="module", autouse=True)
def bootstrap():
    state["super"] = _login(SUPER["email"], SUPER["password"])
    hs = _h(state["super"])
    state["cid_a"] = _create_comune(hs, COM_A, L2A, L3A)
    state["cid_b"] = _create_comune(hs, COM_B, L2B, L3B)
    state["infra_a"] = _create_infra(_login(L3A, "demo123"), "A", 3)
    state["infra_b"] = _create_infra(_login(L3B, "demo123"), "B", 3)
    state["u1_tok"] = _register(USER1, "User Uno")
    state["u2_tok"] = _register(USER2, "User Due")
    yield
    # cleanup
    requests.delete(f"{API}/admin/comuni/{state['cid_a']}", headers=hs)
    requests.delete(f"{API}/admin/comuni/{state['cid_b']}", headers=hs)


# ---------- PUNTO 5: impianti_sel ----------

def test_01_pacchetto_pubblico_expone_impianti_liberi():
    r = requests.get(f"{API}/ooh/pacchetti", params={
        "comune_id": state["cid_a"], "data_inizio": DINI, "data_fine": DFIN})
    assert r.status_code == 200
    p = next(x for x in r.json() if x["id"] == state["infra_a"]["pacchetto_id"])
    assert p["impianti_liberi"] == 3
    assert p["disponibile"] is True
    for i in p["impianti"]:
        assert i["occupato"] is False


def test_02_crea_campagna_con_impianti_sel_subset():
    """Punto 5: selezionare solo 2 dei 3 impianti; prezzo = somma selezionati × giorni."""
    imps = state["infra_a"]["impianti"]
    sel = [imps[0]["id"], imps[1]["id"]]  # prezzo 30 + 31 = 61
    giorni = 6  # DINI→DFIN inclusive
    h = _h(state["u1_tok"])
    r = requests.post(f"{API}/ooh/campagne", headers=h, json={
        "nome": f"C_sel_{TS}", "data_inizio": DINI, "data_fine": DFIN,
        "pacchetti_ids": [state["infra_a"]["pacchetto_id"]],
        "impianti_sel": {state["infra_a"]["pacchetto_id"]: sel},
    })
    assert r.status_code == 200, r.text
    camp = r.json()
    state["cid_sel"] = camp["id"]
    pratica = camp["pratiche"][0]
    state["pid_sel"] = pratica["id"]
    # pratica contiene SOLO 2 impianti
    assert len(pratica["impianti"]) == 2
    ids_in_p = {i["id"] for i in pratica["impianti"]}
    assert ids_in_p == set(sel)
    # importo = 61 * 6 = 366
    assert pratica["importo"] == pytest.approx(61 * giorni, abs=0.01), pratica["importo"]


def test_03_terzo_impianto_libero_prenotabile_da_altro_user():
    """Punto 5: l'impianto deselezionato può essere prenotato da un altro utente stesso periodo."""
    imps = state["infra_a"]["impianti"]
    # verifica prima /pacchetti mostra imp2 come libero, ma imp0/imp1 occupati
    r = requests.get(f"{API}/ooh/pacchetti", params={
        "comune_id": state["cid_a"], "data_inizio": DINI, "data_fine": DFIN})
    p = next(x for x in r.json() if x["id"] == state["infra_a"]["pacchetto_id"])
    busy = {i["id"] for i in p["impianti"] if i["occupato"]}
    assert imps[0]["id"] in busy and imps[1]["id"] in busy
    assert imps[2]["id"] not in busy
    assert p["impianti_liberi"] == 1
    # user2 prenota solo imp2
    h = _h(state["u2_tok"])
    r = requests.post(f"{API}/ooh/campagne", headers=h, json={
        "nome": f"C_alt_{TS}", "data_inizio": DINI, "data_fine": DFIN,
        "pacchetti_ids": [state["infra_a"]["pacchetto_id"]],
        "impianti_sel": {state["infra_a"]["pacchetto_id"]: [imps[2]["id"]]},
    })
    assert r.status_code == 200, r.text
    state["cid_alt"] = r.json()["id"]


def test_04_selezione_impianto_occupato_409():
    """Punto 5 edge: chi seleziona un impianto occupato riceve 409."""
    imps = state["infra_a"]["impianti"]
    tok = _register(f"test_it13_u3_{TS}@demo.it", "U3")
    r = requests.post(f"{API}/ooh/campagne", headers=_h(tok), json={
        "nome": f"C_conflict_{TS}", "data_inizio": DINI, "data_fine": DFIN,
        "pacchetti_ids": [state["infra_a"]["pacchetto_id"]],
        "impianti_sel": {state["infra_a"]["pacchetto_id"]: [imps[0]["id"], imps[2]["id"]]},
    })
    assert r.status_code == 409, r.text


def test_05_no_impianti_sel_prenota_solo_liberi():
    """Punto 5 edge: senza selezione esplicita, default = solo impianti liberi."""
    # tutti gli impianti A sono ora occupati (imp0,imp1 dal test_02 e imp2 dal test_03)
    r = requests.get(f"{API}/ooh/pacchetti", params={
        "comune_id": state["cid_a"], "data_inizio": DINI, "data_fine": DFIN})
    p = next(x for x in r.json() if x["id"] == state["infra_a"]["pacchetto_id"])
    assert p["impianti_liberi"] == 0
    assert p["disponibile"] is False
    # nuova prenotazione senza impianti_sel → 409 perché non ci sono liberi
    tok = _register(f"test_it13_u4_{TS}@demo.it", "U4")
    r = requests.post(f"{API}/ooh/campagne", headers=_h(tok), json={
        "nome": f"C_empty_{TS}", "data_inizio": DINI, "data_fine": DFIN,
        "pacchetti_ids": [state["infra_a"]["pacchetto_id"]],
    })
    assert r.status_code == 409, r.text


# ---------- PUNTO 4: multi-comune ----------

DINI2 = (date.today() + timedelta(days=200)).isoformat()
DFIN2 = (date.today() + timedelta(days=205)).isoformat()


def test_06_crea_campagna_multi_comune():
    """Punto 4: campagna con 2 pacchetti da 2 comuni diversi."""
    h = _h(state["u1_tok"])
    r = requests.post(f"{API}/ooh/campagne", headers=h, json={
        "nome": f"C_multi_{TS}", "data_inizio": DINI2, "data_fine": DFIN2,
        "pacchetti_ids": [state["infra_a"]["pacchetto_id"], state["infra_b"]["pacchetto_id"]],
    })
    assert r.status_code == 200, r.text
    camp = r.json()
    assert len(camp["pratiche"]) == 2
    state["cid_multi"] = camp["id"]
    state["pid_multi_a"] = next(p["id"] for p in camp["pratiche"] if p["comune_id"] == state["cid_a"])
    state["pid_multi_b"] = next(p["id"] for p in camp["pratiche"] if p["comune_id"] == state["cid_b"])


def test_07_template_pratica_ooh_contiene_shared_field():
    """Punto 4: entrambe le pratiche hanno un campo con lo stesso id nel template."""
    h = _h(state["u1_tok"])
    ta = requests.get(f"{API}/ooh/pratiche/{state['pid_multi_a']}/template", headers=h).json()
    tb = requests.get(f"{API}/ooh/pratiche/{state['pid_multi_b']}/template", headers=h).json()
    ids_a = {c["id"] for c in ta.get("campi", [])}
    ids_b = {c["id"] for c in tb.get("campi", [])}
    assert "shared_field" in ids_a
    assert "shared_field" in ids_b
    # intersezione = shared_field
    assert (ids_a & ids_b) >= {"shared_field"}


def test_08_applica_dati_form_a_entrambe():
    """Punto 4: PUT /ooh/pratiche/{id}/dati-form su entrambe con lo stesso valore
    (simula la 'card dati comuni'). Verifica persistenza via GET."""
    h = _h(state["u1_tok"])
    valore = "ACME S.p.A."
    for pid in (state["pid_multi_a"], state["pid_multi_b"]):
        r = requests.put(f"{API}/ooh/pratiche/{pid}/dati-form", headers=h,
                         json={"dati_form": {"shared_field": valore}})
        assert r.status_code == 200, r.text
    for pid in (state["pid_multi_a"], state["pid_multi_b"]):
        p = requests.get(f"{API}/pratiche/{pid}", headers=h).json()
        assert p["dati_form"].get("shared_field") == valore, p["dati_form"]


# ---------- PUNTO 3: integrazione strutturata ----------

def _complete_pratica(pid, cid):
    """Riempie modulo, carica bozzetto e assegna creatività per una singola pratica."""
    h = _h(state["u1_tok"])
    p = requests.get(f"{API}/pratiche/{pid}", headers=h).json()
    tpl = p.get("template") or {}
    dati = dict(p.get("dati_form") or {})
    for c in tpl.get("campi", []):
        if c.get("required") and not dati.get(c["id"]):
            dati[c["id"]] = "valore"
    requests.put(f"{API}/ooh/pratiche/{pid}/dati-form", headers=h, json={"dati_form": dati})
    for d in tpl.get("documenti_richiesti", []):
        if d.get("required"):
            files = {"file": ("bozz.pdf", b"%PDF-1.4\n", "application/pdf")}
            r = requests.post(f"{API}/pratiche/{pid}/documenti?tipo={d['id']}",
                              headers=h, files=files)
            assert r.status_code == 200, r.text
    # soggetto per campagna (uno solo, formato = 200x140 cm)
    files = {"file": ("s.png", b"\x89PNG\r\n\x1a\n" + b"0" * 20, "image/png")}
    r = requests.post(
        f"{API}/ooh/campagne/{cid}/soggetti?formato=200x140+cm&ordine={uuid.uuid4().int % 999}&nome=Sog",
        headers=h, files=files)
    assert r.status_code == 200, r.text
    sog_id = r.json()["id"]
    p2 = requests.get(f"{API}/pratiche/{pid}", headers=h).json()
    for imp in p2["impianti"]:
        r = requests.post(f"{API}/ooh/pratiche/{pid}/creativita", headers=h,
                          json={"impianto_id": imp["id"], "soggetto_id": sog_id})
        assert r.status_code == 200, r.text


def test_09_completa_e_invia_pratica_A():
    """Completa entrambe le pratiche della campagna multi-comune, checkout e invio."""
    _complete_pratica(state["pid_multi_a"], state["cid_multi"])
    _complete_pratica(state["pid_multi_b"], state["cid_multi"])
    h = _h(state["u1_tok"])
    r = requests.post(f"{API}/ooh/campagne/{state['cid_multi']}/checkout", headers=h)
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/ooh/campagne/{state['cid_multi']}/invia", headers=h)
    assert r.status_code == 200, r.text
    p = requests.get(f"{API}/pratiche/{state['pid_multi_a']}", headers=h).json()
    assert p["stato"] == "INVIATA"


def test_10_richiedi_integrazione_strutturata():
    """Punto 3: L2 presa_in_carico + richiedi_integrazione con richieste strutturate."""
    t2 = _login(L2A, "demo123")
    r = requests.post(f"{API}/comune/pratiche/{state['pid_multi_a']}/transizione",
                      headers=_h(t2), json={"azione": "presa_in_carico"})
    assert r.status_code == 200, r.text
    # payload richieste: 1 campo + 1 creatività (impianto 0)
    imp0 = state["infra_a"]["impianti"][0]["id"]
    richieste = [
        {"tipo": "campo", "id": "shared_field", "label": "Campo condiviso",
         "nota": "Valore troppo generico"},
        {"tipo": "creativita", "id": imp0, "label": f"Creatività {imp0}",
         "nota": "Sostituire la creatività (qualità bassa)"},
    ]
    r = requests.post(f"{API}/comune/pratiche/{state['pid_multi_a']}/transizione",
                      headers=_h(t2), json={
                          "azione": "richiedi_integrazione",
                          "nota": "Correggi elementi indicati",
                          "richieste": richieste,
                      })
    assert r.status_code == 200, r.text
    assert r.json()["stato"] == "INTEGRAZIONE_RICHIESTA"
    # verifica GET pratica: integrazione_richieste popolato
    p = requests.get(f"{API}/pratiche/{state['pid_multi_a']}", headers=_h(t2)).json()
    assert p["stato"] == "INTEGRAZIONE_RICHIESTA"
    lst = p.get("integrazione_richieste") or []
    assert len(lst) == 2, lst
    tipi = {x["tipo"] for x in lst}
    assert tipi == {"campo", "creativita"}
    # note preservate
    assert any(x["nota"] == "Valore troppo generico" for x in lst)


def test_11_reinvio_svuota_richieste_e_riporta_in_verifica():
    """Punto 3: reinvio → integrazione_richieste = [] e stato = IN_VERIFICA per OOH."""
    h = _h(state["u1_tok"])
    r = requests.post(f"{API}/pratiche/{state['pid_multi_a']}/invia", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["stato"] == "IN_VERIFICA"
    p = requests.get(f"{API}/pratiche/{state['pid_multi_a']}", headers=h).json()
    assert p["stato"] == "IN_VERIFICA"
    assert (p.get("integrazione_richieste") or []) == []


def test_12_comune_puo_approvare_dopo_reinvio():
    """Regressione fix iterazione 12: OOH IN_VERIFICA → APPROVATA OK."""
    t2 = _login(L2A, "demo123")
    r = requests.post(f"{API}/comune/pratiche/{state['pid_multi_a']}/transizione",
                      headers=_h(t2), json={"azione": "approva"})
    assert r.status_code == 200, r.text
    assert r.json()["stato"] == "APPROVATA"


# ---------- REGRESSIONE ----------

def test_13_admin_kpi_carica():
    r = requests.get(f"{API}/admin/kpi", headers=_h(state["super"]))
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d, dict)
