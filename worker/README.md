# TG Lead Parser — Worker

Python-воркер на Telethon. Слушает Telegram-чаты, фильтрует сообщения
по ключевым словам из базы и пишет совпадения как «лиды» в Lovable Cloud.

## Что нужно

- VPS с Ubuntu 22.04+ (или любым Debian-подобным), 1 GB RAM хватит.
- Python 3.11+.
- **Отдельный** Telegram-аккаунт (не основной) с привязанной SIM.
- `api_id` и `api_hash` с https://my.telegram.org → API development tools.
- `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` из Lovable Cloud
  (View Backend → Project Settings → API).

## Установка

```bash
# на VPS под обычным пользователем
sudo apt update && sudo apt install -y python3.11 python3.11-venv git

git clone <ваш-репозиторий>
cd <repo>/worker

python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
nano .env   # заполнить значения
```

## Первый запуск (введение SMS-кода)

```bash
source .venv/bin/activate
python worker.py
```

При первом запуске Telethon попросит:
1. Код из Telegram (придёт в официальный чат Telegram, не SMS).
2. Если включена 2FA — облачный пароль.

После этого создастся файл `session.session` — храните его рядом со скриптом,
повторно вводить код не понадобится. **Никому не передавайте этот файл** —
он эквивалентен полному доступу к аккаунту.

Остановите процесс (`Ctrl+C`) после успешного логина и переходите к systemd.

## Автозапуск через systemd

```bash
sudo cp tg-lead-parser.service /etc/systemd/system/tg-lead-parser.service
# отредактируйте WorkingDirectory, User и пути в файле под своего пользователя
sudo systemctl daemon-reload
sudo systemctl enable --now tg-lead-parser
sudo systemctl status tg-lead-parser
journalctl -u tg-lead-parser -f
```

## Как добавлять чаты в мониторинг

1. Ваш Telegram-аккаунт должен **состоять** в чате (для приватных) или чат
   должен быть публичным.
2. В веб-интерфейсе на вкладке **Чаты** добавьте `@username` чата.
3. Воркер раз в минуту перечитывает список и подцепит новый чат
   автоматически. Перезапускать не нужно.

## Безопасность аккаунта

- Не вступайте в сотни чатов разом. 5–10 в день первую неделю.
- Не отправляйте сообщения автоматически.
- При появлении «FloodWait» в логах — воркер ждёт сам, не вмешивайтесь.
- Если аккаунт всё-таки забанили — заведите новый и удалите `session.session`.
