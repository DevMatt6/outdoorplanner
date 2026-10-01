# Outdoor Planner

Piattaforma React + FastAPI + MongoDB per campagne outdoor e occupazione del suolo pubblico.

## Deploy su Vercel

Il file `vercel.json` nella root dichiara i servizi frontend e backend. Le richieste
`/api/*` vanno a FastAPI; le altre al frontend React, con fallback SPA.

Impostazioni del progetto Vercel:
- Framework Preset: **Services**.
- Root Directory: root della repository (vuota o `.`), non `frontend`.
- Rimuovere eventuali override globali di install/build/output; sono definiti per servizio.

Variabili d'ambiente del backend (Production e, se necessario, Preview):
- `MONGODB_URI`: fornita automaticamente dall’integrazione MongoDB Atlas su Vercel.
  In alternativa è supportata `MONGO_URL`; non usare localhost.
- `DB_NAME`: nome del database dedicato (usare database distinti per preview e produzione).
- `JWT_SECRET`: segreto casuale robusto, mantenuto invariato tra deploy.
- `CORS_ORIGINS`: URL del sito, se si usa un frontend su un dominio diverso.
- `ADMIN_EMAIL`: facoltativo; il seed usa `admin@demo.it` come default.

Nel frontend **rimuovere** `REACT_APP_BACKEND_URL` da Vercel per usare `/api` sullo
stesso dominio. Impostarla solo se il backend viene ospitato separatamente.
Non caricare file `.env` o credenziali su GitHub.

Dopo il push, Vercel avvia il deploy dal branch collegato. La correzione locale non
modifica il commit GitHub già usato dal deploy fallito.

## Limiti da risolvere prima dell'uso in produzione

- Il seed automatico crea account demo con password `demo123` quando non trova il
  superadmin: questa configurazione serve per una demo, non per dati reali.
- Documenti, foto, loghi e creatività sono persistenti in MongoDB GridFS e
  condivisi tra istanze. Il piano gratuito Atlas ha 512 MB complessivi; gli upload
  via API restano soggetti ai limiti di richiesta Vercel. I file legacy nel
  checkout locale continuano a essere accessibili.
- Le scadenze OOH sono controllate durante le richieste; per notifiche puntuali
  senza traffico serve un job schedulato esterno.
- Pagamenti e invio email sono simulati.

## Avvio locale

Configurare `backend/.env` con `MONGO_URL`, `DB_NAME`, `JWT_SECRET` e
`CORS_ORIGINS=http://localhost:3000`. Avviare MongoDB prima del backend.

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend
../.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
```

In un altro terminale, configurare `frontend/.env.local` con
`REACT_APP_BACKEND_URL=http://localhost:8000`, poi:

```sh
cd frontend
yarn install --frozen-lockfile
WATCHPACK_POLLING=1000 yarn start
```

## Catalogo demo Roma / Napoli / Milano

`backend/seed_demo.py` inserisce 2 zone, 2 circuiti (3 + 2 impianti) e 5 impianti
per comune. Gli account comunali sono `{comune}.l1@demo.it`,
`{comune}.l2@demo.it`, `{comune}.l3@demo.it`, con password `demo123`.
Lo script è ripetibile, conserva gli account e le risorse già presenti e non cancella dati.

Su Vercel il seed viene applicato una sola volta all’avvio, registrando la migrazione
`demo-three-cities-2026-10-01` nella collezione `migrations`. Un reset successivo
non lo riapplica automaticamente. Il database locale non viene copiato online.
