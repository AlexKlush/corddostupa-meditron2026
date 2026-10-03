"""Streamlit-обёртка прототипа «Эгида».

Склеивает prototype/ (index.html + css + js) в одну страницу и показывает её на весь экран.
Запуск: .venv/bin/streamlit run streamlit_app.py --server.port 8502
"""
import base64
import re
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

ROOT = Path(__file__).resolve().parent / "prototype"

st.set_page_config(
    page_title="Эгида · Навигатор маршрута пациента",
    page_icon=":material/health_and_safety:",
    layout="wide",
    initial_sidebar_state="collapsed",
)


@st.cache_data(show_spinner=False)
def build_page(stamp: float) -> str:
    """Одна HTML-страница: стили и скрипты встроены, иконка вкладки как data URI."""
    del stamp  # нужен только для сброса кэша при правках прототипа
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    def inline_css(m: re.Match) -> str:
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def inline_js(m: re.Match) -> str:
        code = (ROOT / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
        return "<script>\n" + code + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
    html = re.sub(r'<script src="((?:js|vendor)/[^"]+)"></script>', inline_js, html)
    icon = base64.b64encode((ROOT / "assets/favicon.svg").read_bytes()).decode()
    return html.replace('href="assets/favicon.svg"', f'href="data:image/svg+xml;base64,{icon}"')


# прячем оболочку Streamlit: прототип занимает всё окно
st.markdown(
    """
    <style>
      header[data-testid="stHeader"], [data-testid="stToolbar"], [data-testid="stDecoration"],
      [data-testid="stStatusWidget"], #MainMenu, footer { display: none !important; }
      .stApp { background: #F7FAFA; }
      [data-testid="stMain"], [data-testid="stAppViewContainer"] { padding: 0 !important; }
      [data-testid="stMainBlockContainer"], .block-container { padding: 0 !important; max-width: 100% !important; }
      [data-testid="stVerticalBlock"] { gap: 0 !important; }
      [data-testid="stElementContainer"]:has(iframe) { width: 100% !important; }
      iframe { display: block; width: 100% !important; height: 100vh !important; height: 100dvh !important; border: 0; }
    </style>
    """,
    unsafe_allow_html=True,
)

stamp = max(p.stat().st_mtime for p in ROOT.rglob("*") if p.is_file())
components.html(build_page(stamp), height=900, scrolling=True)
