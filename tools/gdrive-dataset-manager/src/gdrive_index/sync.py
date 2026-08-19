from __future__ import annotations

import logging
import queue
import tempfile
import threading
from concurrent.futures import ProcessPoolExecutor, TimeoutError as FuturesTimeout
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from googleapiclient.http import MediaIoBaseDownload

from .auth import build_drive_service
from .chunk import chunk_text
from .config import Config
from .db import Database
from .embed import embed_texts
from .extract import Kind, route
from .extract.media import transcribe
from .extract.office import extract_xlsx
from .extract.pdf import extract_pdf
from .extract.text import extract_text_file
from .retry import with_retry

logger = logging.getLogger(__name__)

LIST_FIELDS = "nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum)"
PAGE_SIZE = 1000
DOWNLOAD_CHUNK_SIZE = 10 * 1024 * 1024
EXTRACT_TIMEOUT_S = 600
MAX_NON_MEDIA_BYTES = 1024 * 1024 * 1024

GOOGLE_DOC_EXPORT = "text/plain"
GOOGLE_SHEET_EXPORT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
GOOGLE_SLIDES_EXPORT = "text/plain"


class FileTooLargeError(RuntimeError):
    pass


@dataclass(frozen=True)
class DriveFileMeta:
    file_id: str
    name: str
    mime_type: str
    size_bytes: int | None
    modified_time: datetime
    md5: str | None


def parse_modified_time(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def iter_drive_files(service, folder_id: str | None, limit: int | None):
    query = "trashed = false and mimeType != 'application/vnd.google-apps.folder'"
    if folder_id:
        query += f" and '{folder_id}' in parents"
    page_token = None
    yielded = 0

    @with_retry
    def page() -> dict:
        return (
            service.files()
            .list(
                q=query,
                spaces="drive",
                fields=LIST_FIELDS,
                pageSize=PAGE_SIZE,
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )

    while True:
        response = page()
        for raw in response.get("files", []):
            yield DriveFileMeta(
                file_id=raw["id"],
                name=raw["name"],
                mime_type=raw["mimeType"],
                size_bytes=int(raw["size"]) if raw.get("size") else None,
                modified_time=parse_modified_time(raw["modifiedTime"]),
                md5=raw.get("md5Checksum"),
            )
            yielded += 1
            if limit is not None and yielded >= limit:
                return
        page_token = response.get("nextPageToken")
        if not page_token:
            return


def stamp_seen(db: Database, meta: DriveFileMeta) -> None:
    with db.pool.connection() as conn:
        conn.execute(
            """
            INSERT INTO drive_files (file_id, name, mime_type, size_bytes, modified_time, md5, last_seen_at)
            VALUES (%s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (file_id) DO UPDATE SET
              name = EXCLUDED.name,
              mime_type = EXCLUDED.mime_type,
              size_bytes = EXCLUDED.size_bytes,
              modified_time = EXCLUDED.modified_time,
              md5 = EXCLUDED.md5,
              last_seen_at = now()
            """,
            (meta.file_id, meta.name, meta.mime_type, meta.size_bytes, meta.modified_time, meta.md5),
        )


def is_current(db: Database, meta: DriveFileMeta) -> bool:
    with db.pool.connection() as conn:
        row = conn.execute(
            "SELECT status, modified_time FROM drive_files WHERE file_id = %s",
            (meta.file_id,),
        ).fetchone()
    if row is None:
        return False
    status, modified_time = row
    return status in ("indexed", "skipped") and modified_time == meta.modified_time


def set_status(db: Database, file_id: str, status: str, error: str | None = None) -> None:
    with db.pool.connection() as conn:
        conn.execute(
            "UPDATE drive_files SET status = %s, error = %s WHERE file_id = %s",
            (status, error, file_id),
        )


def store_chunks(db: Database, meta: DriveFileMeta, chunks: list[str], vectors: list[list[float]]) -> None:
    with db.pool.connection() as conn, conn.transaction():
        conn.execute("DELETE FROM file_chunks WHERE file_id = %s", (meta.file_id,))
        if chunks:
            conn.executemany(
                "INSERT INTO file_chunks (file_id, chunk_index, chunk_text, embedding) VALUES (%s, %s, %s, %s)",
                [(meta.file_id, i, text, vector) for i, (text, vector) in enumerate(zip(chunks, vectors, strict=True))],
            )
        conn.execute(
            """
            UPDATE drive_files
            SET status = 'indexed', error = NULL, chunks_count = %s, indexed_at = now()
            WHERE file_id = %s
            """,
            (len(chunks), meta.file_id),
        )


def download_to_temp(service, file_id: str, cfg: Config, suffix: str) -> Path:
    return _download_media(service.files().get_media(fileId=file_id), cfg, suffix)


def export_to_temp(service, file_id: str, export_mime: str, cfg: Config, suffix: str) -> Path:
    return _download_media(service.files().export_media(fileId=file_id, mimeType=export_mime), cfg, suffix)


def _download_media(request, cfg: Config, suffix: str) -> Path:
    cfg.tmpdir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=cfg.tmpdir, delete=False, suffix=suffix) as tmp:
        path = Path(tmp.name)
        try:
            downloader = MediaIoBaseDownload(tmp, request, chunksize=DOWNLOAD_CHUNK_SIZE)
            done = False
            while not done:
                _status, done = with_retry(downloader.next_chunk)()
                if tmp.tell() > cfg.max_download_bytes:
                    raise FileTooLargeError(f"download exceeds {cfg.max_download_bytes} bytes")
        except BaseException:
            path.unlink(missing_ok=True)
            raise
    return path


def reset_stale_processing(db: Database) -> None:
    with db.pool.connection() as conn:
        conn.execute("UPDATE drive_files SET status = 'pending' WHERE status = 'processing'")


def reconcile_deletions(db: Database, run_start: datetime) -> int:
    with db.pool.connection() as conn:
        cursor = conn.execute("DELETE FROM drive_files WHERE last_seen_at < %s", (run_start,))
        return cursor.rowcount or 0


class SyncEngine:
    def __init__(self, cfg: Config, db: Database, include_media: bool) -> None:
        self.cfg = cfg
        self.db = db
        self.include_media = include_media
        self.service = build_drive_service(cfg)
        self.work_queue: queue.Queue[DriveFileMeta | None] = queue.Queue(maxsize=cfg.sync_workers * 4)
        self.media_queue: queue.Queue[tuple[DriveFileMeta, Path] | None] = queue.Queue(maxsize=2)
        self.extractor = ProcessPoolExecutor(max_workers=1)
        self.stats = {"indexed": 0, "skipped": 0, "errors": 0, "media": 0}
        self._stats_lock = threading.Lock()

    def run(self, folder_id: str | None, limit: int | None) -> None:
        reset_stale_processing(self.db)
        run_start = datetime.now(timezone.utc)

        workers = [
            threading.Thread(target=self._file_worker, name=f"file-worker-{i}", daemon=True)
            for i in range(self.cfg.sync_workers)
        ]
        for worker in workers:
            worker.start()
        media_worker = None
        if self.include_media:
            media_worker = threading.Thread(target=self._media_worker, name="media-worker", daemon=True)
            media_worker.start()

        listed = 0
        try:
            for meta in iter_drive_files(self.service, folder_id, limit):
                stamp_seen(self.db, meta)
                if is_current(self.db, meta):
                    continue
                self.work_queue.put(meta)
                listed += 1
        finally:
            for _ in range(self.cfg.sync_workers):
                self.work_queue.put(None)
            for worker in workers:
                worker.join()
            if media_worker is not None:
                self.media_queue.put(None)
                media_worker.join()
            self.extractor.shutdown(cancel_futures=True)

        if folder_id is None and limit is None:
            removed = reconcile_deletions(self.db, run_start)
            logger.info("Reconciled %d deleted Drive files", removed)
        logger.info(
            "Sync done: %d queued, %d indexed, %d media, %d skipped, %d errors",
            listed,
            self.stats["indexed"],
            self.stats["media"],
            self.stats["skipped"],
            self.stats["errors"],
        )

    def _file_worker(self) -> None:
        while True:
            meta = self.work_queue.get()
            if meta is None:
                return
            try:
                self._process_file(meta)
            except Exception as exc:
                logger.exception("Failed to process %s (%s)", meta.name, meta.file_id)
                set_status(self.db, meta.file_id, "error", str(exc)[:2000])
                self._count("errors")

    def _media_worker(self) -> None:
        while True:
            item = self.media_queue.get()
            if item is None:
                return
            meta, path = item
            try:
                text = transcribe(path, self.cfg.whisper_model)
                self._index_text(meta, text)
                self._count("media")
            except Exception as exc:
                logger.exception("Failed to transcribe %s (%s)", meta.name, meta.file_id)
                set_status(self.db, meta.file_id, "error", str(exc)[:2000])
                self._count("errors")
            finally:
                path.unlink(missing_ok=True)

    def _process_file(self, meta: DriveFileMeta) -> None:
        kind = route(meta.mime_type, meta.name)
        if kind is Kind.SKIP:
            set_status(self.db, meta.file_id, "skipped")
            self._count("skipped")
            return
        if kind is Kind.MEDIA:
            if not self.include_media:
                set_status(self.db, meta.file_id, "skipped")
                self._count("skipped")
                return
            set_status(self.db, meta.file_id, "processing")
            path = download_to_temp(self.service, meta.file_id, self.cfg, Path(meta.name).suffix)
            self.media_queue.put((meta, path))
            return

        set_status(self.db, meta.file_id, "processing")
        if (
            kind not in (Kind.GOOGLE_DOC, Kind.GOOGLE_SHEET, Kind.GOOGLE_SLIDES)
            and meta.size_bytes is not None
            and meta.size_bytes > MAX_NON_MEDIA_BYTES
        ):
            set_status(self.db, meta.file_id, "skipped", "non-media file larger than 1GB")
            self._count("skipped")
            return

        path = None
        try:
            if kind is Kind.GOOGLE_DOC:
                path = export_to_temp(self.service, meta.file_id, GOOGLE_DOC_EXPORT, self.cfg, ".txt")
                text = extract_text_file(path)
            elif kind is Kind.GOOGLE_SLIDES:
                path = export_to_temp(self.service, meta.file_id, GOOGLE_SLIDES_EXPORT, self.cfg, ".txt")
                text = extract_text_file(path)
            elif kind is Kind.GOOGLE_SHEET:
                path = export_to_temp(self.service, meta.file_id, GOOGLE_SHEET_EXPORT, self.cfg, ".xlsx")
                text = self._extract_with_timeout(extract_xlsx, path)
            elif kind is Kind.PDF:
                path = download_to_temp(self.service, meta.file_id, self.cfg, ".pdf")
                text = self._extract_with_timeout(extract_pdf, path)
            elif kind is Kind.XLSX:
                path = download_to_temp(self.service, meta.file_id, self.cfg, ".xlsx")
                text = self._extract_with_timeout(extract_xlsx, path)
            else:
                path = download_to_temp(self.service, meta.file_id, self.cfg, Path(meta.name).suffix)
                text = extract_text_file(path)
        finally:
            if path is not None:
                path.unlink(missing_ok=True)

        self._index_text(meta, text)

    def _extract_with_timeout(self, fn, path: Path) -> str:
        future = self.extractor.submit(fn, path)
        try:
            return future.result(timeout=EXTRACT_TIMEOUT_S)
        except FuturesTimeout as exc:
            future.cancel()
            raise RuntimeError(f"extraction timed out after {EXTRACT_TIMEOUT_S}s") from exc

    def _index_text(self, meta: DriveFileMeta, text: str) -> None:
        chunks = chunk_text(text)
        if not chunks:
            set_status(self.db, meta.file_id, "skipped", "no extractable text")
            self._count("skipped")
            return
        vectors = embed_texts(chunks, self.cfg.embedding_model)
        store_chunks(self.db, meta, chunks, vectors)
        self._count("indexed")
        logger.info("Indexed %s (%d chunks)", meta.name, len(chunks))

    def _count(self, key: str) -> None:
        with self._stats_lock:
            self.stats[key] += 1
