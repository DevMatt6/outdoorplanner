"""Persist uploads in MongoDB GridFS so serverless instances share files."""
import mimetypes
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorGridFSBucket


class UploadStorage:
    def __init__(self, db, local_dir):
        self.db = db
        self.bucket = AsyncIOMotorGridFSBucket(db, bucket_name="uploads")
        self.local_dir = local_dir

    async def save(self, path, content):
        await self.bucket.upload_from_stream(path, content)

    async def get(self, path):
        record = await self.db["uploads.files"].find_one({"filename": path})
        if record:
            stream = await self.bucket.open_download_stream(record["_id"])
            content = await stream.read()
        else:
            # Existing files in local checkouts remain accessible.
            root = self.local_dir.resolve()
            file_path = (root / path).resolve()
            if not file_path.is_relative_to(root) or not file_path.is_file():
                raise HTTPException(status_code=404, detail="File non trovato")
            content = file_path.read_bytes()
        media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return Response(content, media_type=media_type,
                        headers={"X-Content-Type-Options": "nosniff"})
