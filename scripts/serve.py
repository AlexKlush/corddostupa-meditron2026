#!/usr/bin/env python3
"""Локальный сервер прототипа без кэширования: python3 scripts/serve.py [порт].

Отдаёт папку prototype/ и запрещает браузеру кэшировать файлы, чтобы правки
были видны сразу после перезагрузки страницы.
"""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "prototype"


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):  # тише в консоли
        if args and str(args[1]) not in ("200", "304"):
            super().log_message(fmt, *args)


class Server(http.server.ThreadingHTTPServer):
    # по умолчанию очередь всего 5 соединений: браузер грузит ~20 файлов разом и получает сбросы
    request_queue_size = 128
    daemon_threads = True


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8795
    handler = functools.partial(NoCache, directory=str(ROOT))
    with Server(("127.0.0.1", port), handler) as srv:
        print(f"Прототип: http://localhost:{port}", flush=True)
        srv.serve_forever()


if __name__ == "__main__":
    main()
