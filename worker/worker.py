"""
TG Lead Parser — Telethon worker.

Слушает новые сообщения в чатах из таблицы public.chats, фильтрует по
ключевым словам из public.keywords и пишет совпадения в public.leads.
Раз в минуту синхронизирует список чатов/ключевиков из БД.
Параллельно собирает упоминания @username из сообщений в public.chat_suggestions.

Устойчивость:
- Автопереподключение к Postgres при OperationalError / SSL EOF.
- Автопереподключение Telethon (Telethon делает это сам, плюс мы ловим
  фатальные ошибки и выходим с ненулевым кодом — systemd перезапустит).
- При фатальной ошибке в main — sys.exit(1).
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import signal
import sys
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import psycopg
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat, User

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("worker")

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
PHONE = os.environ["TG_PHONE"]
SESSION = os.environ.get("SESSION_NAME", "session")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def build_dsn() -> str:
    dsn_env = os.environ.get("DATABASE_URL")
    if dsn_env:
        return dsn_env
    ref = SUPABASE_URL.split("//")[1].split(".")[0]
    host = "aws-0-eu-central-1.pooler.supabase.com"
    return (
        f"postgresql://postgres.{ref}:{SERVICE_KEY}@{host}:5432/postgres"
        "?sslmode=require"
    )


DSN = build_dsn()

USERNAME_RE = re.compile(
    r"(?:https?://)?t\.me/([A-Za-z][A-Za-z0-9_]{3,31})|@([A-Za-z][A-Za-z0-9_]{3,31})"
)


@dataclass
class Keyword:
    id: str
    phrase: str
    niche_id: Optional[str]
    type: str  # 'exact' | 'semantic'
    pattern: re.Pattern


def compile_pattern(phrase: str, kind: str) -> re.Pattern:
    p = re.escape(phrase.strip().lower()).replace(r"\ ", r"\s+")
    if kind == "exact":
        return re.compile(rf"(?<![\wа-яё]){p}(?![\wа-яё])", re.IGNORECASE | re.UNICODE)
    return re.compile(p, re.IGNORECASE | re.UNICODE)


class DB:
    """Тонкая обёртка над psycopg с автопереподключением."""

    def __init__(self, dsn: str):
        self.dsn = dsn
        self.conn: Optional[psycopg.Connection] = None
        self._lock = asyncio.Lock()

    def _connect(self):
        # keepalive_* помогают NAT/SSL не рвать соединение
        self.conn = psycopg.connect(
            self.dsn,
            autocommit=True,
            connect_timeout=15,
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=5,
        )
        log.info("DB connected")

    def ensure(self):
        if self.conn is None or self.conn.closed:
            self._connect()
            return
        # быстрый ping
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT 1")
        except Exception as e:
            log.warning(f"DB ping failed, reconnecting: {e}")
            try:
                self.conn.close()
            except Exception:
                pass
            self._connect()

    def run(self, fn):
        """Выполнить fn(conn) с одной попыткой переподключения."""
        for attempt in (1, 2):
            try:
                self.ensure()
                return fn(self.conn)
            except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                log.warning(f"DB op failed (attempt {attempt}): {e}")
                try:
                    if self.conn:
                        self.conn.close()
                except Exception:
                    pass
                self.conn = None
                if attempt == 2:
                    raise
                time.sleep(1)


class State:
    def __init__(self):
        self.db = DB(DSN)
        self.client: TelegramClient
        self.keywords: list[Keyword] = []
        self.chat_usernames: set[str] = set()
        self.chat_id_to_db: dict[int, dict] = {}
        self.messages_processed = 0
        self.leads_found = 0


S = State()


def reload_config():
    def _q(conn):
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id::text, phrase, niche_id::text, type FROM public.keywords WHERE is_active = true"
            )
            kws = [
                Keyword(
                    id=r[0],
                    phrase=r[1],
                    niche_id=r[2],
                    type=r[3],
                    pattern=compile_pattern(r[1], r[3]),
                )
                for r in cur.fetchall()
            ]
            cur.execute(
                "SELECT id::text, username, tg_chat_id, niche_id::text, title FROM public.chats WHERE is_active = true"
            )
            rows = cur.fetchall()
        return kws, rows

    kws, rows = S.db.run(_q)
    S.keywords = kws
    S.chat_usernames = {r[1].lower() for r in rows}
    S.chat_id_to_db = {}
    for r in rows:
        if r[2] is not None:
            S.chat_id_to_db[int(r[2])] = {
                "id": r[0],
                "username": r[1],
                "niche_id": r[3],
                "title": r[4],
            }
    log.info(f"Loaded {len(S.keywords)} keywords, {len(rows)} chats")


async def ensure_joined_and_index():
    def _missing(conn):
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id::text, username FROM public.chats WHERE is_active = true AND tg_chat_id IS NULL"
            )
            return cur.fetchall()

    missing = S.db.run(_missing)
    updates = []
    for chat_id, uname in missing:
        try:
            entity = await S.client.get_entity(uname)
            title = (
                getattr(entity, "title", None)
                or getattr(entity, "first_name", None)
                or uname
            )
            if isinstance(entity, Channel):
                event_id = int(f"-100{entity.id}")
            elif isinstance(entity, Chat):
                event_id = -entity.id
            else:
                event_id = entity.id
            updates.append((event_id, title, chat_id))
            log.info(f"Resolved @{uname} -> {event_id} ({title})")
        except Exception as e:
            log.warning(f"Cannot resolve @{uname}: {e}")
    if updates:
        def _upd(conn):
            with conn.cursor() as cur:
                cur.executemany(
                    "UPDATE public.chats SET tg_chat_id=%s, title=COALESCE(title,%s), joined_at=COALESCE(joined_at, now()) WHERE id=%s",
                    updates,
                )
        S.db.run(_upd)


def find_match(text: str) -> Optional[Keyword]:
    if not text:
        return None
    for kw in S.keywords:
        if kw.pattern.search(text):
            return kw
    return None


def upsert_lead(chat_row, message, kw, author_username, author_user_id, author_display):
    msg_link = (
        f"https://t.me/{chat_row['username']}/{message.id}"
        if chat_row.get("username")
        else None
    )
    niche_id = kw.niche_id or chat_row.get("niche_id")
    posted_at = (
        message.date.astimezone(timezone.utc) if message.date else datetime.now(timezone.utc)
    )

    def _ins(conn):
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.leads (
                  chat_id, chat_username, chat_title,
                  tg_message_id, tg_chat_id, message_link,
                  author_username, author_user_id, author_display_name,
                  message_text, matched_keyword_id, matched_phrase, matched_niche_id,
                  posted_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (tg_chat_id, tg_message_id, matched_keyword_id) DO NOTHING
                """,
                (
                    chat_row["id"], chat_row["username"], chat_row.get("title"),
                    message.id, int(message.chat_id), msg_link,
                    author_username, author_user_id, author_display,
                    message.message or "", kw.id, kw.phrase, niche_id,
                    posted_at,
                ),
            )

    S.db.run(_ins)
    S.leads_found += 1
    log.info(f"LEAD @{author_username} in @{chat_row['username']} :: «{kw.phrase}»")


def harvest_suggestions(text: str, source_chat: Optional[str]):
    if not text:
        return
    found = set()
    for m in USERNAME_RE.finditer(text):
        u = (m.group(1) or m.group(2) or "").lower()
        if not u or u in S.chat_usernames or u in {"joinchat", "addstickers", "share"}:
            continue
        found.add(u)
    if not found:
        return

    def _ins(conn):
        with conn.cursor() as cur:
            for u in found:
                cur.execute(
                    """
                    INSERT INTO public.chat_suggestions (username, source_chat, mentions_count, last_seen_at)
                    VALUES (%s, %s, 1, now())
                    ON CONFLICT (username) DO UPDATE
                      SET mentions_count = public.chat_suggestions.mentions_count + 1,
                          last_seen_at = now()
                    """,
                    (u, source_chat),
                )

    try:
        S.db.run(_ins)
    except Exception as e:
        log.warning(f"harvest_suggestions failed: {e}")


async def heartbeat_loop():
    while True:
        try:
            def _hb(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE public.worker_state
                           SET last_heartbeat=now(),
                               messages_processed=%s,
                               leads_found=%s,
                               updated_at=now()
                           WHERE id=1""",
                        (S.messages_processed, S.leads_found),
                    )
            S.db.run(_hb)
        except Exception as e:
            log.error(f"heartbeat failed: {e}")
        await asyncio.sleep(30)


async def reload_loop():
    while True:
        try:
            reload_config()
            await ensure_joined_and_index()
        except Exception as e:
            log.error(f"reload failed: {e}\n{traceback.format_exc()}")
            try:
                def _err(conn):
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE public.worker_state SET last_error=%s, updated_at=now() WHERE id=1",
                            (str(e),),
                        )
                S.db.run(_err)
            except Exception:
                pass
        await asyncio.sleep(60)


async def on_new_message(event):
    try:
        S.messages_processed += 1
        chat_row = S.chat_id_to_db.get(int(event.chat_id))
        if not chat_row:
            return
        text = event.message.message or ""
        harvest_suggestions(text, chat_row.get("username"))
        kw = find_match(text)
        if not kw:
            return
        sender = await event.get_sender()
        u = getattr(sender, "username", None)
        uid = getattr(sender, "id", None)
        display = None
        if isinstance(sender, User):
            display = " ".join(p for p in [sender.first_name, sender.last_name] if p) or None
        elif sender is not None:
            display = getattr(sender, "title", None)
        upsert_lead(chat_row, event.message, kw, u, uid, display)
    except Exception as e:
        log.error(f"on_new_message error: {e}\n{traceback.format_exc()}")


async def main():
    S.db.ensure()
    reload_config()
    S.client = TelegramClient(
        SESSION, API_ID, API_HASH,
        connection_retries=None,   # бесконечные ретраи на уровне сети
        retry_delay=5,
        auto_reconnect=True,
        request_retries=5,
    )
    await S.client.start(phone=PHONE)
    log.info("Telegram client started")

    # КРИТИЧЕСКИ ВАЖНО: get_dialogs() прогревает кэш диалогов на сервере Telegram.
    # Без этого вызова Telethon может не получать NewMessage апдейты из чатов,
    # даже если аккаунт в них состоит.
    try:
        dialogs = await S.client.get_dialogs(limit=None)
        log.info(f"Primed dialog cache: {len(dialogs)} dialogs")
    except Exception as e:
        log.warning(f"get_dialogs failed: {e}")

    await ensure_joined_and_index()
    reload_config()

    S.client.add_event_handler(on_new_message, events.NewMessage(incoming=True))

    asyncio.create_task(heartbeat_loop())
    asyncio.create_task(reload_loop())

    log.info("Listening for new messages…")
    await S.client.run_until_disconnected()


def _graceful(*_):
    log.info("Shutting down")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, _graceful)
    signal.signal(signal.SIGINT, _graceful)
    try:
        asyncio.run(main())
    except Exception as e:
        log.error(f"FATAL: {e}\n{traceback.format_exc()}")
        # ненулевой код → systemd перезапустит процесс
        sys.exit(1)
