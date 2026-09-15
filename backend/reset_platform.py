"""Reset piattaforma a stato vergine: elimina tutti i dati business, mantiene superadmin, utenti inserzionisti e struttura."""
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    business = ["comuni", "zone", "impianti", "pacchetti", "spazi", "pratiche", "campagne",
                "prenotazioni", "soggetti", "creativita", "form_templates", "log_stato",
                "chat", "notifiche", "notifications", "occupazioni"]
    for coll in business:
        r = await db[coll].delete_many({})
        print(f"{coll}: {r.deleted_count} eliminati")
    r = await db.users.delete_many({"ruolo": "comune"})
    print(f"utenze comunali: {r.deleted_count} eliminate")
    print("Reset completato. Superadmin e inserzionisti mantenuti.")

asyncio.run(main())
