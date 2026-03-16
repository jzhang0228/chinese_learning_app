import hashlib
import io
import json
import os
import random
import secrets
import sqlite3
import time
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

# ─── Database backend selection ───────────────────────────────────────────────
_DATABASE_URL = os.environ.get("DATABASE_URL")
_USE_PG = bool(_DATABASE_URL)

if _USE_PG:
    import psycopg2
    import psycopg2.extras
    _IntegrityError = psycopg2.IntegrityError
else:
    _IntegrityError = sqlite3.IntegrityError

# ─── Game constants ───────────────────────────────────────────────────────────
MEMORY_PAIRS = [
    ("你好","Hello"),("谢谢","Thank you"),("水","Water"),("火","Fire"),
    ("山","Mountain"),("猫","Cat"),("狗","Dog"),("书","Book"),
    ("家","Home"),("爱","Love"),("吃","Eat"),("喝","Drink"),
    ("大","Big"),("小","Small"),("红","Red"),("蓝","Blue"),
    ("月","Moon"),("星","Star"),("风","Wind"),("雨","Rain"),
]

WORDLE_WORDS = [
    "APPLE","BRAVE","CHAIR","DANCE","EARTH","FAITH","GRACE","HAPPY",
    "IMAGE","JUICE","KNEEL","LIGHT","MAGIC","NIGHT","OCEAN","PEACE",
    "QUEEN","RIVER","SMILE","TABLE","VOICE","WATER","YACHT","ANGEL",
    "BEACH","CLOUD","DREAM","EAGLE","FLAME","HEART","JEWEL","LEMON",
    "MUSIC","NOBLE","OLIVE","PIANO","QUIET","STONE","TIGER","WHEAT",
    "YOUTH","BLAZE","CRISP","FROWN","GLOBE","LODGE","NURSE","OPTIC",
    "PRISM","RIDGE","SNOWY","TRUNK","WRIST","YIELD","ATTIC","BONUS",
    "CHARM","DEPOT","FROZE","GUSTO","HONOR","INPUT","JELLY","KINGS",
    "LASER","MAYOR","NOVEL","PLUMB","RAPID","SCONE","TULIP","USHER",
    "VENOM","WALTZ","ZESTY","BLUNT","CRIMP","DWARF","EXPEL","FLINT",
]

RECOMMENDED_WORDS = [
    # kept as fallback if characters.csv is missing
    "water", "fire", "food", "rice", "tea", "family", "mother", "father",
    "sun", "moon", "star", "rain", "wind", "tree", "dog", "cat",
    "house", "school", "eat", "drink", "sleep", "walk", "happy", "love",
    "big", "small", "hot", "cold", "time", "book", "music", "heart",
]

CHARACTERS_FILE = Path(__file__).parent / "characters.csv"
_DB_FILE        = Path(__file__).parent / "app.db"

class _PGCon:
    """Thin psycopg2 wrapper that mimics the sqlite3 connection interface."""
    def __init__(self):
        self._con = psycopg2.connect(
            _DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor
        )

    def execute(self, sql: str, params=()):
        cur = self._con.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):   self._con.commit()
    def rollback(self): self._con.rollback()
    def close(self):    self._con.close()

    def __enter__(self): return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type: self.rollback()
        else:        self.commit()
        self.close()
        return False


class _SQLiteCon:
    """Thin sqlite3 wrapper with the same interface as _PGCon.
    Translates %s placeholders → ? so shared SQL strings work unchanged."""
    def __init__(self):
        self._con = sqlite3.connect(_DB_FILE)
        self._con.row_factory = sqlite3.Row

    def execute(self, sql: str, params=()):
        return self._con.execute(sql.replace("%s", "?"), params)

    def commit(self):   self._con.commit()
    def rollback(self): self._con.rollback()
    def close(self):    self._con.close()

    def __enter__(self): return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type: self.rollback()
        else:        self.commit()
        self.close()
        return False


def _db():
    """Return a database connection wrapper (PostgreSQL or SQLite)."""
    return _PGCon() if _USE_PG else _SQLiteCon()


def _init_db():
    _id_col = "SERIAL PRIMARY KEY" if _USE_PG else "INTEGER PRIMARY KEY AUTOINCREMENT"
    with _db() as con:
        con.execute(f"""
            CREATE TABLE IF NOT EXISTS users (
                username      TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL
            )
        """)
        con.execute(f"""
            CREATE TABLE IF NOT EXISTS learned_words (
                id       {_id_col},
                username TEXT NOT NULL,
                english  TEXT NOT NULL,
                chinese  TEXT NOT NULL,
                pinyin   TEXT NOT NULL,
                UNIQUE(username, english)
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                username     TEXT PRIMARY KEY,
                manual_level INTEGER
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token      TEXT PRIMARY KEY,
                username   TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)

_init_db()

ALL_GAMES = {
    "sudoku":   "🔢 Sudoku",
    "puzzle":   "🧩 Sliding Puzzle",
    "memory":   "🃏 Memory Match",
    "lights":   "💡 Lights Out",
    "mines":    "💣 Minesweeper",
    "wordle":   "🔤 Wordle",
    "nonogram": "🎯 Nonogram",
}

NONOGRAM_PUZZLES = [
    [[0,1,1,1,0],[1,1,0,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],  # heart-ish
    [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],  # diamond
    [[1,1,1,1,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]],  # square
    [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],  # X
    [[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]],  # plus
]

import datetime
import streamlit as st
import extra_streamlit_components as stx
from gtts import gTTS
from deep_translator import GoogleTranslator
from pypinyin import pinyin as to_pinyin, Style

# ─── Page setup ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Learn Chinese",
    page_icon="🇨🇳",
    layout="centered",
    initial_sidebar_state="collapsed",
)

_cookie_mgr = stx.CookieManager(key="ck")

st.markdown("""
<style>
  .big-char  { font-size:100px; text-align:center; color:#c0392b; }
  .pinyin    { font-size:28px;  text-align:center; color:#2c3e50; letter-spacing:4px; }
  .eng-label { font-size:18px;  text-align:center; color:#7f8c8d; }
  .quiz-box  { background:#fff8f0; border-left:4px solid #c0392b;
               padding:16px; border-radius:8px; margin:12px 0; }
  .cell-fixed{ text-align:center; font-size:18px; font-weight:bold;
               padding:6px 0; border-radius:4px; margin:1px; }
</style>
""", unsafe_allow_html=True)

# ─── Auth helpers ─────────────────────────────────────────────────────────────
def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _register(username: str, password: str) -> str | None:
    """Return error string or None on success."""
    username = username.strip().lower()
    if not username or not password:
        return "Username and password are required."
    if len(username) < 3:
        return "Username must be at least 3 characters."
    if len(password) < 4:
        return "Password must be at least 4 characters."
    try:
        with _db() as con:
            con.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)",
                        (username, _hash(password)))
        return None
    except _IntegrityError:
        return "Username already taken."

def _login(username: str, password: str) -> bool:
    username = username.strip().lower()
    with _db() as con:
        row = con.execute("SELECT password_hash FROM users WHERE username = %s", (username,)).fetchone()
    return row is not None and row["password_hash"] == _hash(password)

# ─── Session-state defaults ────────────────────────────────────────────────────
DEFAULTS = dict(
    username=None,
    stage="input",
    english_word="",
    chinese_text="",
    pinyin_text="",
    example_sentences=[],
    # quiz results (reset per lesson)
    pron_quiz_passed=False,
    sentences_spoken=[],
    sent_quiz_passed=False,
    writing_quiz_passed=False,
    writing_quiz_revealed=False,
    # settings
    favorite_games=list(ALL_GAMES.keys()),
    # games
    selected_game=None,
    reward_game=None,
    sudoku_solution=None,
    sudoku_puzzle=None,
    puzzle_state=None,
    # Memory match (reward)
    memory_cards=None, memory_first=None, memory_second=None, memory_won=False,
    # Review games
    review_memory_cards=None, review_memory_first=None, review_memory_second=None, review_memory_won=False,
    # Sky Drop
    sky_words=[], sky_score=0, sky_lives=3,
    sky_audio=None, sky_done=False, sky_tick=0, sky_last_audio_hash=None,
    sky_feedback=None, sky_feedback_type="success",
    # Lights out
    lights_grid=None, lights_won=False,
    # Minesweeper
    mines_grid=None, mines_flag_mode=False, mines_game_over=False,
    mines_won=False, mines_first_click=True,
    # Wordle
    wordle_answer="", wordle_guesses=[], wordle_won=False, wordle_lost=False,
    # Nonogram
    nono_solution=None, nono_grid=None,
    nono_row_clues=None, nono_col_clues=None, nono_won=False,
)
for k, v in DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ─── Session token persistence (cookie) ───────────────────────────────────────
def _create_session(username: str) -> str:
    token = secrets.token_hex(32)
    with _db() as con:
        con.execute("DELETE FROM sessions WHERE created_at < ?", (time.time() - 30 * 86400,))
        con.execute("INSERT INTO sessions (token, username, created_at) VALUES (?,?,?)",
                    (token, username, time.time()))
    return token

def _validate_session(token: str) -> str | None:
    with _db() as con:
        row = con.execute("SELECT username FROM sessions WHERE token=?", (token,)).fetchone()
    return row["username"] if row else None

def _delete_session(token: str):
    with _db() as con:
        con.execute("DELETE FROM sessions WHERE token=?", (token,))

# Restore session from cookie.
# CookieManager needs one render cycle to read browser cookies, so we do
# a single extra rerun on the very first page load (tracked by _ck_init).
if not st.session_state.username:
    _tok = _cookie_mgr.get("session_token")
    if _tok:
        _uname = _validate_session(_tok)
        if _uname:
            st.session_state.username = _uname
    elif not st.session_state.get("_ck_init"):
        st.session_state["_ck_init"] = True
        st.rerun()

# ─── Login / Register wall ─────────────────────────────────────────────────────
if not st.session_state.username:
    st.title("🇨🇳 Learn Chinese")
    tab_login, tab_reg = st.tabs(["Login", "Create account"])

    with tab_login:
        with st.form("login_form"):
            lu = st.text_input("Username")
            lp = st.text_input("Password", type="password")
            if st.form_submit_button("Login", use_container_width=True, type="primary"):
                if _login(lu, lp):
                    st.session_state.username = lu.strip().lower()
                    _tok = _create_session(st.session_state.username)
                    _cookie_mgr.set("session_token", _tok,
                                    expires_at=datetime.datetime.now() + datetime.timedelta(days=30))
                    st.rerun()
                else:
                    st.error("Invalid username or password.")

    with tab_reg:
        with st.form("reg_form"):
            ru = st.text_input("Choose a username")
            rp = st.text_input("Choose a password", type="password")
            rp2 = st.text_input("Confirm password", type="password")
            if st.form_submit_button("Create account", use_container_width=True, type="primary"):
                if rp != rp2:
                    st.error("Passwords do not match.")
                else:
                    err = _register(ru, rp)
                    if err:
                        st.error(err)
                    else:
                        st.session_state.username = ru.strip().lower()
                        _tok = _create_session(st.session_state.username)
                        _cookie_mgr.set("session_token", _tok,
                                        expires_at=datetime.datetime.now() + datetime.timedelta(days=30))
                        st.rerun()
    st.stop()

# ─── Helpers ──────────────────────────────────────────────────────────────────
def translate_en(text: str) -> str | None:
    try:
        return GoogleTranslator(source="en", target="zh-CN").translate(text)
    except Exception:
        return None

def pinyin_str(text: str) -> str:
    try:
        return " ".join(p[0] for p in to_pinyin(text, style=Style.TONE))
    except Exception:
        return ""

def recognize_handwriting(image_data, expected: str) -> tuple[bool, str]:
    """Use Claude vision to judge whether the drawing is a reasonable attempt at the expected character(s).
    Returns (passed, feedback_message)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return False, "No API key — cannot check."
    try:
        import anthropic
        import base64
        from PIL import Image
        img = Image.fromarray(image_data.astype("uint8"), "RGBA").convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_b64 = base64.standard_b64encode(buf.getvalue()).decode()
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=120,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
                    {"type": "text", "text": (
                        f'A beginner is learning to write the Chinese character(s): {expected}\n'
                        f'Look at their handwritten attempt and be VERY lenient — this is a beginner using a mouse or finger. '
                        f'PASS if the overall shape is even loosely recognisable or shows a genuine attempt at the right strokes. '
                        f'Only FAIL if it looks completely unrelated to the character (e.g. a random scribble with no resemblance). '
                        f'Proportion, stroke order, and neatness do NOT matter.\n'
                        f'Reply with exactly one line:\n'
                        f'PASS: <brief encouraging feedback>\n'
                        f'or\n'
                        f'FAIL: <one simple tip>'
                    )},
                ],
            }],
        )
        text = msg.content[0].text.strip()
        if text.upper().startswith("PASS"):
            return True, text[5:].lstrip(": ").strip()
        else:
            return False, text[5:].lstrip(": ").strip()
    except Exception as e:
        return False, f"Recognition error: {e}"

@st.cache_data(show_spinner=False)
def make_audio(text: str) -> bytes | None:
    """Generate MP3 audio for Chinese text via gTTS.
    Returns raw bytes (cached) or None on failure.
    Validates the result contains a real MP3 frame before returning."""
    try:
        buf = io.BytesIO()
        gTTS(text=text, lang="zh").write_to_fp(buf)
        data = buf.getvalue()
        # Validate: MP3 frames start with 0xFF 0xFx, or an ID3 tag starts with "ID3"
        if len(data) < 4 or not (data[:2] in (b"\xff\xf3", b"\xff\xf2", b"\xff\xfb", b"\xff\xfa") or data[:3] == b"ID3"):
            return None
        return data
    except Exception:
        return None

def go(stage: str):
    st.session_state.stage = stage
    st.rerun()

def generate_sentences_ai(english_word: str, chinese_text: str) -> list[dict]:
    """Use Claude to generate 2 short phrases and 2 full sentences. Falls back to templates."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=700,
                system=(
                    "You are a native Mandarin Chinese speaker helping beginners learn. "
                    "Your job is to write sentences that sound EXACTLY like something a real person "
                    "would say — not textbook examples. Think of how people actually text, talk to "
                    "friends, or comment on everyday things."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f'Write 4 examples using "{chinese_text}" ({english_word}).\n\n'
                        f'Exactly in this order:\n'
                        f'1. A SHORT PHRASE (2–4 characters, no verb required) — e.g. a label, descriptor, or common expression\n'
                        f'2. A SHORT PHRASE (2–4 characters, no verb required) — different context from #1\n'
                        f'3. A FULL SENTENCE — something someone says casually in daily life (NOT starting with 我)\n'
                        f'4. A FULL SENTENCE — a question, reaction, or exclamation in natural conversation\n\n'
                        f'AVOID:\n'
                        f'- Full sentences that start with 我 + verb\n'
                        f'- Using 很/非常 as the main point\n'
                        f'- Textbook patterns like "X是很好的" or "我喜欢X"\n'
                        f'- Translating English sentence structure into Chinese\n\n'
                        f'The English should be a natural translation of what the Chinese actually means.\n\n'
                        f'Return ONLY a JSON array of exactly 4 objects:\n'
                        f'[{{"chinese":"...","pinyin":"...","english":"..."}}]'
                    ),
                }],
            )
            raw = msg.content[0].text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(raw)
        except Exception as e:
            st.error(f"⚠️ AI failed: `{type(e).__name__}: {e}`")
    # Fallback: translate fixed templates
    sents = []
    for tmpl in [
        f"{english_word.capitalize()}",
        f"Good {english_word}",
        f"I like {english_word}.",
        f"Do you have {english_word}?",
    ]:
        ch = translate_en(tmpl)
        if ch:
            sents.append({"english": tmpl, "chinese": ch, "pinyin": pinyin_str(ch)})
    return sents

def progress(step: int, total: int = 6, label: str = ""):
    st.progress(step / total)
    st.caption(f"Step {step} of {total}: {label}")

def transcribe_chinese(audio_bytes: bytes, mime_type: str = "") -> str | None:
    """Transcribe audio bytes to Chinese text via Google STT.
    st.audio_input() always returns WAV, so we pass the bytes straight to
    SpeechRecognition without any ffmpeg/pydub conversion."""
    if not audio_bytes:
        return None
    try:
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        with sr.AudioFile(io.BytesIO(audio_bytes)) as source:
            audio_data = recognizer.record(source)
        return recognizer.recognize_google(audio_data, language="zh-CN")
    except sr.UnknownValueError:
        return None
    except sr.RequestError:
        st.warning("Speech recognition service unavailable. Check your connection.")
        return None
    except Exception:
        return None

def contains_learned_chars(transcribed: str, chinese_text: str) -> bool:
    """Check that the transcription contains at least one CJK char from the learned word."""
    cjk_chars = [c for c in chinese_text if '\u4e00' <= c <= '\u9fff']
    if not cjk_chars:
        return bool(transcribed)
    return any(c in transcribed for c in cjk_chars)

def reset_for_new_word():
    for k in ["english_word", "chinese_text", "pinyin_text"]:
        st.session_state[k] = ""
    st.session_state.example_sentences       = []
    st.session_state.pron_quiz_passed        = False
    st.session_state.sentences_spoken        = []
    st.session_state.sent_quiz_passed        = False
    st.session_state.writing_quiz_passed     = False
    st.session_state.writing_quiz_revealed   = False
    st.session_state.reward_game             = None
    st.session_state.current_recommendation  = None
    go("input")

def pronunciation_matches(transcribed: str, chinese_text: str) -> bool:
    """Return True if ≥ 60% of the expected characters appear in the transcription."""
    cjk_chars = [c for c in chinese_text if '\u4e00' <= c <= '\u9fff']
    if not cjk_chars:
        return bool(transcribed)
    matched = sum(1 for c in cjk_chars if c in transcribed)
    return matched / len(cjk_chars) >= 0.6

# ─── Learned words persistence ────────────────────────────────────────────────
def load_learned_words() -> list[dict]:
    username = st.session_state.get("username", "_guest")
    with _db() as con:
        rows = con.execute(
            "SELECT english, chinese, pinyin FROM learned_words WHERE username = %s ORDER BY id",
            (username,)
        ).fetchall()
    return [{"english": r["english"], "chinese": r["chinese"], "pinyin": r["pinyin"]} for r in rows]

def save_learned_word(english: str, chinese: str, pinyin: str):
    username = st.session_state.get("username", "_guest")
    with _db() as con:
        con.execute(
            "INSERT INTO learned_words (username, english, chinese, pinyin) VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (username, english) DO NOTHING",
            (username, english, chinese, pinyin)
        )

def load_settings() -> dict:
    username = st.session_state.get("username", "_guest")
    with _db() as con:
        row = con.execute("SELECT manual_level FROM settings WHERE username = %s", (username,)).fetchone()
    return {"manual_level": row["manual_level"] if row else None}

def save_settings(settings: dict):
    username = st.session_state.get("username", "_guest")
    with _db() as con:
        con.execute(
            "INSERT INTO settings (username, manual_level) VALUES (%s, %s) "
            "ON CONFLICT (username) DO UPDATE SET manual_level = excluded.manual_level",
            (username, settings.get("manual_level"))
        )

@st.cache_data
def load_characters_df():
    import pandas as pd
    return pd.read_csv(CHARACTERS_FILE)

def get_user_level(learned: list[dict]) -> int:
    """Return the user's current level (1–10). Manual override takes priority."""
    manual = load_settings().get("manual_level")
    if manual is not None:
        return int(manual)
    # Auto: start at 1; advance when ≥70% of current level learned
    if not learned or not CHARACTERS_FILE.exists():
        return 1
    df = load_characters_df()
    learned_chars = {w["chinese"] for w in learned}
    matched = df[df["character"].isin(learned_chars)]
    if matched.empty:
        return 1
    max_level = int(matched["level"].max())
    level_total   = len(df[df["level"] == max_level])
    level_learned = len(matched[matched["level"] == max_level])
    if level_learned / level_total >= 0.7 and max_level < 10:
        return max_level + 1
    return max_level

def get_recommendation(learned: list[dict]) -> dict | None:
    """Return the next recommended character dict from characters.csv, or a fallback string."""
    if not CHARACTERS_FILE.exists():
        # fallback to old word list
        learned_set = {w["english"].lower() for w in learned}
        pool = [w for w in RECOMMENDED_WORDS if w.lower() not in learned_set]
        return {"english": random.choice(pool), "character": None} if pool else None

    df = load_characters_df()
    learned_chars = {w["chinese"] for w in learned}
    user_level    = get_user_level(learned)

    # Try user's current level first, then higher levels; pick randomly within each level
    for level in range(user_level, 11):
        unlearned = df[(df["level"] == level) & (~df["character"].isin(learned_chars))]
        if not unlearned.empty:
            row = unlearned.sample(1).iloc[0]
            return {
                "character": row["character"],
                "pinyin":    row["pinyin"],
                "english":   row["english"],
                "level":     int(row["level"]),
                "rank":      int(row["rank"]),
            }
    return None

# ─── Game generators ──────────────────────────────────────────────────────────
def generate_sudoku():
    # 9x9 sudoku with 3x3 boxes, easy difficulty (fewer removed cells)
    def ok(b, r, c, n):
        if n in b[r]: return False
        if any(b[i][c] == n for i in range(9)): return False
        br, bc = 3*(r//3), 3*(c//3)
        return not any(b[i][j] == n for i in range(br, br+3) for j in range(bc, bc+3))
    def solve(b):
        for i in range(9):
            for j in range(9):
                if b[i][j] == 0:
                    ns = list(range(1, 10)); random.shuffle(ns)
                    for n in ns:
                        if ok(b, i, j, n):
                            b[i][j] = n
                            if solve(b): return True
                            b[i][j] = 0
                    return False
        return True
    board = [[0]*9 for _ in range(9)]
    solve(board)
    puzzle = [row[:] for row in board]
    cells = [(i, j) for i in range(9) for j in range(9)]
    random.shuffle(cells)
    for i, j in cells[:30]:   # easy: only 30 cells removed (vs 45 before)
        puzzle[i][j] = 0
    return board, puzzle

def generate_sliding():
    tiles = list(range(1, 9)) + [0]
    for _ in range(300):
        zi = tiles.index(0)
        moves = []
        if zi % 3 > 0: moves.append(zi - 1)
        if zi % 3 < 2: moves.append(zi + 1)
        if zi >= 3:    moves.append(zi - 3)
        if zi < 6:     moves.append(zi + 3)
        s = random.choice(moves)
        tiles[zi], tiles[s] = tiles[s], tiles[zi]
    return tiles

# ─── Memory Match ─────────────────────────────────────────────────────────────
def init_memory():
    pairs = random.sample(MEMORY_PAIRS, 8)
    cards = []
    for ch, en in pairs:
        cards.append({"chinese": ch, "english": en, "flipped": False, "matched": False})
        cards.append({"chinese": ch, "english": en, "flipped": False, "matched": False})
    random.shuffle(cards)
    st.session_state.memory_cards = cards
    st.session_state.memory_first = None
    st.session_state.memory_second = None
    st.session_state.memory_won = False

# ─── Review games ─────────────────────────────────────────────────────────────
def init_review_memory(learned: list[dict]):
    pairs = random.sample(learned, min(8, len(learned)))
    cards = []
    for w in pairs:
        cards.append({"chinese": w["chinese"], "english": w["english"], "flipped": False, "matched": False})
        cards.append({"chinese": w["chinese"], "english": w["english"], "flipped": False, "matched": False})
    random.shuffle(cards)
    st.session_state.review_memory_cards = cards
    st.session_state.review_memory_first = None
    st.session_state.review_memory_second = None
    st.session_state.review_memory_won = False

# ─── Sky Drop ─────────────────────────────────────────────────────────────────
def _sky_spawn(learned: list[dict], existing_chars: set, start_y: int = 0):
    """Pick a random unshown learned word and add it at start_y."""
    pool = [w for w in learned if w["chinese"] not in existing_chars]
    if not pool:
        return
    w = random.choice(pool)
    st.session_state.sky_words.append({
        "chinese": w["chinese"], "pinyin": w["pinyin"],
        "english": w["english"],
        "y": start_y,
        "x": random.randint(15, 80),
    })

def init_sky_drop(learned: list[dict]):
    st.session_state.sky_words          = []
    st.session_state.sky_score          = 0
    st.session_state.sky_lives          = 3
    st.session_state.sky_audio          = None
    st.session_state.sky_done           = False
    st.session_state.sky_tick           = 0
    st.session_state.sky_last_audio_hash = None
    # Stagger 3 starting words: first visible, others above the screen
    offsets = [0, -35, -65]
    for offset in offsets[:min(3, len(learned))]:
        existing = {w["chinese"] for w in st.session_state.sky_words}
        _sky_spawn(learned, existing, start_y=offset)

# ─── Lights Out ───────────────────────────────────────────────────────────────
def _toggle(grid, r, c, size=5):
    for dr, dc in [(0,0),(1,0),(-1,0),(0,1),(0,-1)]:
        nr, nc = r+dr, c+dc
        if 0 <= nr < size and 0 <= nc < size:
            grid[nr][nc] = not grid[nr][nc]

def init_lights():
    size = 5
    grid = [[False]*size for _ in range(size)]
    for _ in range(random.randint(8, 14)):
        _toggle(grid, random.randint(0,4), random.randint(0,4))
    # Ensure at least one light is on
    if not any(grid[r][c] for r in range(size) for c in range(size)):
        _toggle(grid, 2, 2)
    st.session_state.lights_grid = grid
    st.session_state.lights_won = False

# ─── Minesweeper ──────────────────────────────────────────────────────────────
def init_mines(size=8, n_mines=10):
    grid = [[{"mine":False,"revealed":False,"flagged":False,"adj":0}
             for _ in range(size)] for _ in range(size)]
    st.session_state.mines_grid = grid
    st.session_state.mines_flag_mode = False
    st.session_state.mines_game_over = False
    st.session_state.mines_won = False
    st.session_state.mines_first_click = True

def _place_mines(grid, safe_r, safe_c, size=8, n_mines=10):
    cells = [(i,j) for i in range(size) for j in range(size)
             if not (abs(i-safe_r) <= 1 and abs(j-safe_c) <= 1)]
    for r, c in random.sample(cells, min(n_mines, len(cells))):
        grid[r][c]["mine"] = True
    for i in range(size):
        for j in range(size):
            if not grid[i][j]["mine"]:
                grid[i][j]["adj"] = sum(
                    1 for di in [-1,0,1] for dj in [-1,0,1]
                    if 0<=i+di<size and 0<=j+dj<size and grid[i+di][j+dj]["mine"]
                )

def _flood_reveal(grid, r, c, size=8):
    stack = [(r, c)]
    while stack:
        cr, cc = stack.pop()
        cell = grid[cr][cc]
        if cell["revealed"] or cell["flagged"]: continue
        cell["revealed"] = True
        if cell["adj"] == 0 and not cell["mine"]:
            for di in [-1,0,1]:
                for dj in [-1,0,1]:
                    nr, nc = cr+di, cc+dj
                    if 0 <= nr < size and 0 <= nc < size:
                        stack.append((nr, nc))

# ─── Wordle ───────────────────────────────────────────────────────────────────
def init_wordle():
    st.session_state.wordle_answer = random.choice(WORDLE_WORDS)
    st.session_state.wordle_guesses = []
    st.session_state.wordle_won = False
    st.session_state.wordle_lost = False

def score_wordle(guess: str, answer: str):
    """Return list of (letter, color) for a guess."""
    result = []
    answer_remaining = list(answer)
    marks = ["gray"] * 5
    # First pass: greens
    for i, (g, a) in enumerate(zip(guess, answer)):
        if g == a:
            marks[i] = "green"
            answer_remaining[i] = None
    # Second pass: yellows
    for i, g in enumerate(guess):
        if marks[i] == "green": continue
        if g in answer_remaining:
            marks[i] = "yellow"
            answer_remaining[answer_remaining.index(g)] = None
    return list(zip(guess, marks))

# ─── Nonogram ─────────────────────────────────────────────────────────────────
def _nono_clues(grid):
    size = len(grid)
    def clues_for(line):
        clues, n = [], 0
        for v in line:
            if v: n += 1
            elif n: clues.append(n); n = 0
        if n: clues.append(n)
        return clues or [0]
    rows = [clues_for(grid[r]) for r in range(size)]
    cols = [clues_for([grid[r][c] for r in range(size)]) for c in range(size)]
    return rows, cols

def init_nonogram():
    sol = random.choice(NONOGRAM_PUZZLES)
    size = len(sol)
    st.session_state.nono_solution = sol
    st.session_state.nono_grid = [[False]*size for _ in range(size)]
    st.session_state.nono_row_clues, st.session_state.nono_col_clues = _nono_clues(sol)
    st.session_state.nono_won = False

# ─── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🇨🇳 Chinese Learner")
    st.markdown(f"👤 **{st.session_state.username}**")
    if st.button("Logout", use_container_width=True):
        _tok = _cookie_mgr.get("session_token")
        if _tok:
            _delete_session(_tok)
        _cookie_mgr.delete("session_token")
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        st.rerun()
    if st.session_state.chinese_text:
        st.markdown(f"**Word:** {st.session_state.english_word}")
        st.markdown(
            f"<div style='font-size:44px;color:#c0392b;text-align:center;'>"
            f"{st.session_state.chinese_text}</div>",
            unsafe_allow_html=True,
        )
        st.markdown(f"*{st.session_state.pinyin_text}*")
        st.markdown("---")

    NAV = [
        ("input",        "📝 Input Word"),
        ("learn",        "📖 Learn"),
        ("pron_quiz",    "🎤 Quiz: Pronunciation"),
        ("sentence",     "💬 Sentences"),
        ("sent_quiz",    "🎤 Quiz: Sentence"),
        ("writing",      "✍️ Writing"),
        ("writing_quiz", "✏️ Quiz: Writing"),
        ("celebrate",    "🎉 Celebrate"),
        ("game",         "🎮 Play Game"),
    ]
    cur = st.session_state.stage
    for s, name in NAV:
        if s == cur:
            st.markdown(f"**→ {name}**")
        else:
            st.markdown(f"&nbsp;&nbsp;{name}", unsafe_allow_html=True)

    st.markdown("---")
    with st.expander("⚙️ Settings"):
        st.markdown("**Favorite reward games:**")
        new_favs = st.multiselect(
            "Select games you enjoy:",
            options=list(ALL_GAMES.keys()),
            default=st.session_state.favorite_games,
            format_func=lambda x: ALL_GAMES[x],
            label_visibility="collapsed",
        )
        if new_favs != st.session_state.favorite_games:
            st.session_state.favorite_games = new_favs
            st.rerun()
        if not st.session_state.favorite_games:
            st.caption("⚠️ No favorites — all games eligible.")

    st.markdown("---")
    if st.button("🏠 Start Over", use_container_width=True):
        username = st.session_state.username
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        st.session_state.username = username
        st.rerun()

# ─── Stage: INPUT ─────────────────────────────────────────────────────────────
if st.session_state.stage == "input":
    st.title("🇨🇳 Learn Chinese")

    learned = load_learned_words()

    # ── Recommendation ────────────────────────────────────────────────────────
    if "current_recommendation" not in st.session_state or st.session_state.current_recommendation is None:
        st.session_state.current_recommendation = get_recommendation(learned)
    rec = st.session_state.current_recommendation

    user_level = get_user_level(learned)
    settings = load_settings()
    manual_level = settings.get("manual_level")

    col_lvl, col_sel = st.columns([2, 1])
    with col_lvl:
        label = f"Level {user_level} / 10" + (" (manual)" if manual_level else " (auto)")
        st.markdown(
            f"<div style='font-size:13px;color:#7f8c8d;margin-bottom:4px;'>"
            f"Your level: <b>{label}</b> &nbsp;·&nbsp; "
            f"Words learned: <b>{len(learned)}</b></div>",
            unsafe_allow_html=True,
        )
    with col_sel:
        level_options = ["Auto"] + [str(i) for i in range(1, 11)]
        current_choice = "Auto" if manual_level is None else str(manual_level)
        chosen = st.selectbox("Set my level:", level_options,
                              index=level_options.index(current_choice))
        new_manual = None if chosen == "Auto" else int(chosen)
        if new_manual != manual_level:
            settings["manual_level"] = new_manual
            save_settings(settings)
            st.session_state.current_recommendation = None
            st.rerun()

    if rec:
        has_char = rec.get("character")
        st.markdown("### ✨ Recommended for you:")
        if has_char:
            st.markdown(
                f"<div style='background:#fff8f0;border-left:4px solid #c0392b;"
                f"padding:14px 18px;border-radius:8px;margin-bottom:12px;'>"
                f"<span style='font-size:36px;color:#c0392b;font-weight:bold;'>{rec['character']}</span>"
                f"&nbsp;&nbsp;<span style='font-size:18px;color:#555;'>{rec['english']}</span><br>"
                f"<span style='font-size:14px;color:#999;'>{rec['pinyin']} &nbsp;·&nbsp; Level {rec['level']} &nbsp;·&nbsp; Rank #{rec['rank']}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )
            if st.button(f"Learn {rec['character']} ({rec['english']}) →", type="primary", use_container_width=True):
                st.session_state.english_word = rec["english"]
                st.session_state.chinese_text = rec["character"]
                st.session_state.pinyin_text  = rec["pinyin"]
                st.session_state.current_recommendation = None
                go("learn")
        else:
            # fallback: old-style string recommendation
            eng = rec["english"]
            st.markdown(
                f"<div style='background:#fff8f0;border-left:4px solid #c0392b;"
                f"padding:14px 18px;border-radius:8px;margin-bottom:12px;font-size:18px;'>"
                f"<b>{eng.capitalize()}</b></div>",
                unsafe_allow_html=True,
            )
            if st.button(f'Learn "{eng.capitalize()}" now →', type="primary", use_container_width=True):
                with st.spinner("Translating…"):
                    ch = translate_en(eng)
                if ch:
                    st.session_state.english_word = eng
                    st.session_state.chinese_text = ch
                    st.session_state.pinyin_text  = pinyin_str(ch)
                    st.session_state.current_recommendation = None
                    go("learn")
        st.markdown("---")

    st.markdown("---")
    st.markdown("### Or enter your own word:")
    word = st.text_input("Enter an English word or phrase:",
                         placeholder="e.g. hello, water, thank you…",
                         label_visibility="collapsed")
    if st.button("🚀 Start Learning!", type="primary", use_container_width=True):
        if word.strip():
            with st.spinner("Translating…"):
                ch = translate_en(word.strip())
            if ch:
                st.session_state.english_word = word.strip()
                st.session_state.chinese_text = ch
                st.session_state.pinyin_text  = pinyin_str(ch)
                st.session_state.current_recommendation = None
                go("learn")
            else:
                st.error("Translation failed — check your connection and try again.")
        else:
            st.warning("Please enter a word first!")

    # ── Learned words history ─────────────────────────────────────────────────
    if learned:
        st.markdown("---")
        with st.expander(f"📚 Words you've learned ({len(learned)})"):
            for w in reversed(learned):
                st.markdown(
                    f"<div style='display:flex;align-items:center;gap:16px;"
                    f"padding:6px 0;border-bottom:1px solid #f0f0f0;'>"
                    f"<span style='font-size:28px;color:#c0392b;min-width:48px;'>{w['chinese']}</span>"
                    f"<span style='color:#2c3e50;'><b>{w['english'].capitalize()}</b>"
                    f"<br><small style='color:#7f8c8d;'>{w['pinyin']}</small></span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )

    if len(learned) >= 2:
        st.markdown("---")
        st.markdown("### 📚 Review your words:")
        rc1, rc2 = st.columns(2)
        with rc1:
            if st.button("🃏 Memory Match", use_container_width=True, help="Match characters with their meanings!"):
                init_review_memory(learned)
                go("review_memory")
        with rc2:
            if st.button("☁️ Sky Drop", use_container_width=True, help="Destroy falling words before they hit the ground!"):
                init_sky_drop(learned)
                go("sky_drop")

# ─── Stage: LEARN ─────────────────────────────────────────────────────────────
elif st.session_state.stage == "learn":
    progress(1, label="Learn the character")
    st.title("📖 Learn")
    st.markdown(
        f"<div class='big-char'>{st.session_state.chinese_text}</div>"
        f"<div class='pinyin'>{st.session_state.pinyin_text}</div>"
        f"<div class='eng-label'>{st.session_state.english_word}</div>",
        unsafe_allow_html=True,
    )
    st.markdown("---")
    c1, c2, c3 = st.columns(3)
    c1.metric("English", st.session_state.english_word)
    c2.metric("Chinese", st.session_state.chinese_text)
    c3.metric("Pinyin",  st.session_state.pinyin_text)
    st.markdown("### 🔊 Listen:")
    audio = make_audio(st.session_state.chinese_text)
    if audio:
        st.audio(audio, format="audio/mpeg")
    st.markdown("---")
    if st.button("Next: Pronunciation Quiz →", type="primary", use_container_width=True):
        go("pron_quiz")


# ─── Stage: PRONUNCIATION QUIZ ────────────────────────────────────────────────
elif st.session_state.stage == "pron_quiz":
    progress(2, label="Pronunciation quiz")
    st.title("🎤 Pronunciation Quiz")

    st.markdown(
        "<div class='quiz-box'>"
        f"<b>Say this word aloud in Chinese:</b><br>"
        f"<span style='font-size:22px;color:#7f8c8d;'>Pinyin: {st.session_state.pinyin_text}</span>"
        "</div>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f"<div class='big-char'>{st.session_state.chinese_text}</div>",
        unsafe_allow_html=True,
    )

    # Replay audio for reference
    with st.expander("🔊 Hear it again first"):
        audio = make_audio(st.session_state.chinese_text)
        if audio:
            st.audio(audio, format="audio/mpeg")

    st.markdown("### Record your pronunciation:")
    audio_input = st.audio_input("Click to record", key="pron_recorder")
    audio_bytes = audio_input.read() if audio_input else None

    if audio_bytes:
        with st.spinner("Checking your pronunciation…"):
            transcribed = transcribe_chinese(audio_bytes)

        if transcribed:
            st.markdown(f"**I heard:** {transcribed}")
            if pronunciation_matches(transcribed, st.session_state.chinese_text):
                st.success("✅ Excellent pronunciation! Quiz passed!")
                st.session_state.pron_quiz_passed = True
            else:
                st.error(
                    f"Not quite — I heard **{transcribed}** but expected something "
                    f"like **{st.session_state.chinese_text}**. Try again!"
                )
        else:
            st.warning("Couldn't catch that. Make sure your microphone is on and speak clearly.")

    if st.session_state.pron_quiz_passed:
        st.markdown("---")
        if st.button("Next: Sentences →", type="primary", use_container_width=True):
            with st.spinner("Generating sentences…"):
                st.session_state.example_sentences = generate_sentences_ai(
                    st.session_state.english_word, st.session_state.chinese_text
                )
            go("sentence")

# ─── Stage: SENTENCES ─────────────────────────────────────────────────────────
elif st.session_state.stage == "sentence":
    progress(3, label="Make a sentence")
    st.title("💬 Make a Sentence")
    st.markdown("Listen to each phrase or sentence, then record yourself saying it. Your pronunciation must match to continue.")

    spoken = set(st.session_state.sentences_spoken)
    total  = len(st.session_state.example_sentences)

    for i, s in enumerate(st.session_state.example_sentences):
        done = i in spoken
        with st.container(border=True):
            ca, cb = st.columns([2, 1])
            with ca:
                st.markdown(f"**{i+1}. {s['chinese']}**")
                st.markdown(f"*{s['pinyin']}*")
                st.markdown(f"{s['english']}")
            with cb:
                a = make_audio(s["chinese"])
                if a:
                    st.audio(a, format="audio/mpeg")

            if done:
                st.success("✅ Pronunciation matched!")
            else:
                st.markdown("**Say this aloud:**")
                audio_input = st.audio_input("Click to record", key=f"sent_rec_{i}")
                audio_bytes = audio_input.read() if audio_input else None
                if audio_bytes:
                    with st.spinner("Checking pronunciation…"):
                        transcribed = transcribe_chinese(audio_bytes)
                    if transcribed:
                        st.markdown(f"**I heard:** {transcribed}")
                        if pronunciation_matches(transcribed, s["chinese"]):
                            spoken.add(i)
                            st.session_state.sentences_spoken = list(spoken)
                            st.rerun()
                        else:
                            st.error(f"Not quite — I heard **{transcribed}** but expected **{s['chinese']}**. Try again!")
                    else:
                        st.warning("Couldn't catch that. Speak clearly and try again.")

    st.markdown("---")
    all_spoken = len(spoken) >= total
    if not all_spoken:
        remaining = total - len(spoken)
        st.info(f"{remaining} more item{'s' if remaining > 1 else ''} left to pronounce correctly.")
    if st.button("Next: Sentence Quiz →", type="primary",
                 use_container_width=True, disabled=not all_spoken):
        go("sent_quiz")

# ─── Stage: SENTENCE QUIZ ─────────────────────────────────────────────────────
elif st.session_state.stage == "sent_quiz":
    progress(4, label="Sentence quiz")
    st.title("🎤 Sentence Quiz")

    st.markdown(
        "<div class='quiz-box'>"
        f"<b>Say a complete sentence in Chinese using the character:</b><br>"
        f"<span style='font-size:60px;color:#c0392b;'>{st.session_state.chinese_text}</span><br>"
        f"<span style='font-size:18px;color:#7f8c8d;'>({st.session_state.english_word})</span>"
        "</div>",
        unsafe_allow_html=True,
    )
    st.caption("Example sentences you learned:")
    for s in st.session_state.example_sentences:
        st.markdown(f"  • {s['chinese']} — {s['english']}")
    st.markdown("**Now say a *new* sentence that uses this character!**")

    audio_input = st.audio_input("Click to record your sentence", key="sent_recorder")
    audio_bytes = audio_input.read() if audio_input else None

    if audio_bytes:
        with st.spinner("Checking…"):
            transcribed = transcribe_chinese(audio_bytes)

        if transcribed:
            st.markdown(f"**I heard:** {transcribed}")
            # A sentence should contain the character AND be at least 3 characters long
            has_char = contains_learned_chars(transcribed, st.session_state.chinese_text)
            long_enough = len(transcribed.strip()) >= 3
            if has_char and long_enough:
                st.success(f"✅ Great sentence! **{transcribed}** — quiz passed!")
                st.session_state.sent_quiz_passed = True
            elif not has_char:
                st.error(
                    f"I heard **{transcribed}** but it doesn't include "
                    f"**{st.session_state.chinese_text}**. Try again!"
                )
            else:
                st.error("That's too short for a sentence — try adding more words!")
        else:
            st.warning("Couldn't catch that. Speak clearly and try again.")

    if st.session_state.sent_quiz_passed:
        st.markdown("---")
        if st.button("Next: Writing Practice →", type="primary", use_container_width=True):
            go("writing")

# ─── Stage: WRITING ───────────────────────────────────────────────────────────
elif st.session_state.stage == "writing":
    progress(5, label="Writing practice")
    st.title("✍️ Writing Practice")
    st.markdown(f"Practice writing **{st.session_state.chinese_text}** ({st.session_state.pinyin_text})")
    n = len(st.session_state.chinese_text)
    font_size = min(180, 360 // n)
    box_w = max(400, n * 200)
    canvas_w = box_w

    st.markdown("**Reference character:**")
    st.markdown(
        f"<div style='font-size:{font_size}px;text-align:center;color:#c0392b;"
        f"border:2px dashed #ddd;border-radius:12px;padding:10px;background:#fff9f9;"
        f"width:{box_w}px;height:220px;display:flex;align-items:center;"
        f"justify-content:center;letter-spacing:8px;'>"
        f"{st.session_state.chinese_text}</div>",
        unsafe_allow_html=True,
    )
    st.markdown("**Your writing (draw below):**")
    try:
        from streamlit_drawable_canvas import st_canvas
        st_canvas(stroke_width=10, stroke_color="#c0392b", background_color="#ffffff",
                  height=220, width=canvas_w, drawing_mode="freedraw", key="canvas_practice")
    except ImportError:
        st.info("Install `streamlit-drawable-canvas` for on-screen writing.")
    st.markdown("---")
    st.markdown("**Tips:**  Top → Bottom · Left → Right · Each character fits in a square")
    if st.button("Take Writing Quiz →", type="primary", use_container_width=True):
        go("writing_quiz")

# ─── Stage: WRITING QUIZ ──────────────────────────────────────────────────────
elif st.session_state.stage == "writing_quiz":
    progress(6, label="Writing quiz")
    st.title("✏️ Writing Quiz")

    st.markdown(
        "<div class='quiz-box'>"
        f"<b>Draw the character for:</b><br>"
        f"<span style='font-size:36px;font-weight:bold;'>{st.session_state.english_word}</span><br>"
        f"<span style='font-size:18px;color:#7f8c8d;'>Pinyin: {st.session_state.pinyin_text}</span>"
        "</div>",
        unsafe_allow_html=True,
    )
    st.markdown("*The character is hidden — draw from memory!*")

    n = len(st.session_state.chinese_text)
    canvas_w = max(400, n * 200)

    try:
        from streamlit_drawable_canvas import st_canvas
        canvas_result = st_canvas(
            stroke_width=10,
            stroke_color="#2c3e50",
            background_color="#ffffff",
            height=220,
            width=canvas_w,
            drawing_mode="freedraw",
            key="canvas_quiz",
        )
        has_drawing = (
            canvas_result.json_data is not None
            and len(canvas_result.json_data.get("objects", [])) > 0
        )
    except ImportError:
        st.info("Install `streamlit-drawable-canvas` for on-screen writing.")
        canvas_result = None
        has_drawing = False

    st.markdown("---")

    # Recognition-based check flow
    if not st.session_state.writing_quiz_passed:
        check_disabled = not has_drawing
        if st.button("🔍 Check My Writing", type="primary", use_container_width=True, disabled=check_disabled):
            with st.spinner("Checking your handwriting…"):
                passed, feedback = recognize_handwriting(
                    canvas_result.image_data, st.session_state.chinese_text
                ) if (canvas_result is not None and has_drawing) else (False, "Nothing drawn yet.")
            if passed:
                st.success(f"✅ {feedback}")
                st.session_state.writing_quiz_passed = True
                st.rerun()
            else:
                font_size = min(160, 320 // n)
                st.error(f"Not quite — {feedback}")
                st.markdown("### Reference:")
                st.markdown(
                    f"<div style='font-size:{font_size}px;"
                    f"text-align:center;color:#c0392b;border:2px solid #c0392b;border-radius:12px;"
                    f"padding:10px;background:#fff9f9;display:flex;align-items:center;"
                    f"justify-content:center;width:{canvas_w}px;height:220px;letter-spacing:8px;'>"
                    f"{st.session_state.chinese_text}</div>",
                    unsafe_allow_html=True,
                )
                st.markdown(
                    f"<div style='text-align:center;font-size:22px;color:#2c3e50;'>"
                    f"{st.session_state.pinyin_text}</div>",
                    unsafe_allow_html=True,
                )
                if st.button("✅ Close enough — continue anyway", use_container_width=True):
                    st.session_state.writing_quiz_passed = True
                    st.rerun()

    if st.session_state.writing_quiz_passed:
        st.success("🎉 Writing quiz passed!")
        st.markdown("---")
        if st.button("🎉 Complete Lesson!", type="primary", use_container_width=True):
            save_learned_word(
                st.session_state.english_word,
                st.session_state.chinese_text,
                st.session_state.pinyin_text,
            )
            go("celebrate")

# ─── Stage: CELEBRATE ─────────────────────────────────────────────────────────
elif st.session_state.stage == "celebrate":
    st.balloons()
    st.markdown(
        f"<div style='text-align:center;padding:30px;'>"
        f"<div style='font-size:72px;'>🎉</div>"
        f"<h1 style='color:#c0392b;'>Congratulations!</h1>"
        f"<p style='font-size:20px;'>You mastered:</p>"
        f"<div style='font-size:70px;color:#c0392b;'>{st.session_state.chinese_text}</div>"
        f"<p style='font-size:26px;color:#2c3e50;'>{st.session_state.pinyin_text}</p>"
        f"<p style='font-size:18px;color:#7f8c8d;'>{st.session_state.english_word}</p>"
        f"</div>",
        unsafe_allow_html=True,
    )
    with st.expander("📊 What you completed:"):
        st.markdown(f"- **Word:** {st.session_state.english_word} → {st.session_state.chinese_text}")
        st.markdown(f"- **Pinyin:** {st.session_state.pinyin_text}")
        st.markdown("- 🎤 Pronunciation quiz ✅")
        st.markdown("- 🎤 Sentence quiz ✅")
        st.markdown("- ✏️ Writing quiz ✅")
    # Pick a random reward game from favorites (once per celebrate visit)
    if st.session_state.reward_game is None:
        pool = st.session_state.favorite_games or list(ALL_GAMES.keys())
        st.session_state.reward_game = random.choice(pool)

    reward = st.session_state.reward_game
    st.markdown("---")
    st.markdown(
        f"<div style='text-align:center;padding:16px;background:#fff8f0;"
        f"border-radius:12px;border:2px solid #c0392b;'>"
        f"<div style='font-size:36px;'>{ALL_GAMES[reward]}</div>"
        f"<div style='color:#7f8c8d;margin-top:6px;'>Your reward game has been chosen!</div>"
        f"</div>",
        unsafe_allow_html=True,
    )
    st.markdown("")
    if st.button(f"🎮 Play {ALL_GAMES[reward]}!", type="primary", use_container_width=True):
        if reward == "sudoku":
            sol, puz = generate_sudoku()
            st.session_state.sudoku_solution = sol
            st.session_state.sudoku_puzzle = puz
        elif reward == "puzzle":
            st.session_state.puzzle_state = generate_sliding()
        elif reward == "memory":
            init_memory()
        elif reward == "lights":
            init_lights()
        elif reward == "mines":
            init_mines()
        elif reward == "wordle":
            init_wordle()
        elif reward == "nonogram":
            init_nonogram()
        st.session_state.selected_game = reward
        go("game")
    st.markdown("---")
    if st.button("🔄 Learn Another Word", use_container_width=True):
        reset_for_new_word()

# ─── Stage: GAME ──────────────────────────────────────────────────────────────
elif st.session_state.stage == "game":

    if st.session_state.selected_game == "sudoku":
        st.title("🔢 Sudoku")
        st.markdown("Fill every **row**, **column**, and **3×3 box** with digits **1–9**.")
        puzzle   = st.session_state.sudoku_puzzle
        solution = st.session_state.sudoku_solution
        BOX_COLORS = ["#f5f5f5", "#e0e0e0"]
        st.markdown("---")
        with st.form("sudoku_form"):
            for i in range(9):
                cols = st.columns(9)
                for j in range(9):
                    box_shade = BOX_COLORS[(i // 3 + j // 3) % 2]
                    with cols[j]:
                        if puzzle[i][j] != 0:
                            st.markdown(
                                f"<div class='cell-fixed' style='background:{box_shade};'>"
                                f"{puzzle[i][j]}</div>",
                                unsafe_allow_html=True,
                            )
                        else:
                            st.text_input("", max_chars=1, label_visibility="collapsed",
                                          key=f"s{i}{j}")
                if i in (2, 5):
                    st.markdown("<div style='height:3px;background:#555;margin:2px 0;'></div>",
                                unsafe_allow_html=True)
            submitted = st.form_submit_button("✅ Check Answer", use_container_width=True,
                                              type="primary")
        if submitted:
            errors = sum(
                1 for i in range(9) for j in range(9)
                if puzzle[i][j] == 0 and (
                    not st.session_state.get(f"s{i}{j}", "").strip().isdigit()
                    or int(st.session_state.get(f"s{i}{j}", "0")) != solution[i][j]
                )
            )
            if errors == 0:
                st.success("🎉 Perfect! You solved the Sudoku!")
                st.balloons()
            else:
                total = sum(1 for i in range(9) for j in range(9) if puzzle[i][j] == 0)
                st.warning(f"{total - errors}/{total} cells correct — keep going!")
        if st.button("🔄 Learn Another Word", use_container_width=True):
            reset_for_new_word()

    elif st.session_state.selected_game == "puzzle":
        st.title("🧩 Sliding Puzzle")
        st.markdown("Arrange tiles **1 – 8** in order. Tap a tile next to the blank to slide it!")
        tiles  = st.session_state.puzzle_state
        solved = list(range(1, 9)) + [0]
        zi     = tiles.index(0)
        st.markdown("---")
        for row in range(3):
            cols = st.columns([1, 1, 1, 1])
            for col in range(3):
                idx  = row * 3 + col
                tile = tiles[idx]
                with cols[col]:
                    if tile == 0:
                        st.markdown("<div style='height:40px;background:#f0f0f0;"
                                    "border-radius:8px;margin:3px;'></div>",
                                    unsafe_allow_html=True)
                    else:
                        adjacent = (
                            (abs(idx - zi) == 1 and idx // 3 == zi // 3)
                            or abs(idx - zi) == 3
                        )
                        if st.button(str(tile), key=f"t{idx}", use_container_width=True,
                                     type="primary" if adjacent else "secondary"):
                            if adjacent:
                                tiles[zi], tiles[idx] = tiles[idx], tiles[zi]
                                st.session_state.puzzle_state = tiles
                                st.rerun()
        st.markdown("---")
        if tiles == solved:
            st.success("🎉 Brilliant! Puzzle solved!")
            st.balloons()
        if st.button("🔄 Learn Another Word", use_container_width=True):
            reset_for_new_word()

    # ── Memory Match ──────────────────────────────────────────────────────────
    elif st.session_state.selected_game == "memory":
        st.title("🃏 Memory Match")
        st.markdown("Match each Chinese character with its English meaning!")

        cards = st.session_state.memory_cards
        first = st.session_state.memory_first
        second = st.session_state.memory_second

        # If two unmatched cards are showing, let user see them then continue
        if second is not None:
            c1, c2 = cards[first], cards[second]
            if c1["chinese"] == c2["chinese"]:
                cards[first]["matched"] = True
                cards[second]["matched"] = True
                st.session_state.memory_first = None
                st.session_state.memory_second = None
                if all(c["matched"] for c in cards):
                    st.session_state.memory_won = True
            else:
                st.warning("No match! Click **Continue** to flip them back.")
                if st.button("Continue", type="primary"):
                    cards[first]["flipped"] = False
                    cards[second]["flipped"] = False
                    st.session_state.memory_first = None
                    st.session_state.memory_second = None
                    st.rerun()

        if st.session_state.memory_won:
            st.success("🎉 You matched all the pairs!")
            st.balloons()

        cols_per_row = 4
        for row_start in range(0, 16, cols_per_row):
            cols = st.columns(cols_per_row)
            for col_idx, card_idx in enumerate(range(row_start, row_start + cols_per_row)):
                card = cards[card_idx]
                with cols[col_idx]:
                    if card["matched"]:
                        st.markdown(
                            f"<div style='background:#d4edda;border-radius:8px;padding:12px;"
                            f"text-align:center;font-size:18px;min-height:70px;"
                            f"display:flex;align-items:center;justify-content:center;'>"
                            f"{card['chinese']}<br><small>{card['english']}</small></div>",
                            unsafe_allow_html=True)
                    elif card["flipped"] or card_idx in (first, second):
                        st.markdown(
                            f"<div style='background:#fff3cd;border-radius:8px;padding:12px;"
                            f"text-align:center;font-size:20px;min-height:70px;"
                            f"display:flex;align-items:center;justify-content:center;'>"
                            f"{card['chinese']}<br><small>{card['english']}</small></div>",
                            unsafe_allow_html=True)
                    else:
                        if st.button("?", key=f"mc{card_idx}", use_container_width=True):
                            if second is None and card_idx != first:
                                card["flipped"] = True
                                if first is None:
                                    st.session_state.memory_first = card_idx
                                else:
                                    st.session_state.memory_second = card_idx
                                st.rerun()

        st.markdown("---")
        if st.button("🔄 Learn Another Word", use_container_width=True):
            reset_for_new_word()

    # ── Lights Out ────────────────────────────────────────────────────────────
    elif st.session_state.selected_game == "lights":
        st.title("💡 Lights Out")
        st.markdown("Click a tile to toggle it **and its neighbors**. Turn all lights off!")

        grid = st.session_state.lights_grid
        size = 5
        on_count = sum(grid[r][c] for r in range(size) for c in range(size))

        if st.session_state.lights_won:
            st.success("🎉 All lights off! You won!")
            st.balloons()

        for r in range(size):
            cols = st.columns(size)
            for c in range(size):
                with cols[c]:
                    color = "#f39c12" if grid[r][c] else "#bdc3c7"
                    label = "💡" if grid[r][c] else "○"
                    if st.button(label, key=f"lt{r}{c}", use_container_width=True):
                        _toggle(grid, r, c)
                        st.session_state.lights_grid = grid
                        if not any(grid[i][j] for i in range(size) for j in range(size)):
                            st.session_state.lights_won = True
                        st.rerun()

        st.markdown(f"**Lights on:** {on_count} / {size*size}")
        st.markdown("---")
        if st.button("🔄 Learn Another Word", use_container_width=True):
            reset_for_new_word()

    # ── Minesweeper ───────────────────────────────────────────────────────────
    elif st.session_state.selected_game == "mines":
        st.title("💣 Minesweeper")
        SIZE = 8
        N_MINES = 10

        flag_mode = st.session_state.mines_flag_mode
        btn_label = "🚩 Flag Mode: ON" if flag_mode else "🚩 Flag Mode: OFF"
        if st.button(btn_label):
            st.session_state.mines_flag_mode = not flag_mode
            st.rerun()
        st.caption("Flag Mode OFF = reveal cell | Flag Mode ON = place/remove flag")

        grid = st.session_state.mines_grid

        if st.session_state.mines_won:
            st.success("🎉 All mines flagged — you win!")
            st.balloons()
        elif st.session_state.mines_game_over:
            st.error("💥 Boom! Game over.")

        NUM_COLORS = {1:"#0000ff",2:"#007b00",3:"#ff0000",4:"#00007b",
                      5:"#7b0000",6:"#007b7b",7:"#000000",8:"#7b7b7b"}

        for r in range(SIZE):
            cols = st.columns(SIZE)
            for c in range(SIZE):
                cell = grid[r][c]
                with cols[c]:
                    if cell["revealed"]:
                        if cell["mine"]:
                            st.markdown("<div style='text-align:center;font-size:18px;'>💣</div>",
                                        unsafe_allow_html=True)
                        elif cell["adj"] == 0:
                            st.markdown("<div style='background:#e0e0e0;border-radius:4px;"
                                        "height:28px;'></div>", unsafe_allow_html=True)
                        else:
                            color = NUM_COLORS.get(cell["adj"], "#000")
                            st.markdown(
                                f"<div style='text-align:center;font-size:16px;font-weight:bold;"
                                f"color:{color};'>{cell['adj']}</div>",
                                unsafe_allow_html=True)
                    else:
                        label = "🚩" if cell["flagged"] else "■"
                        if st.button(label, key=f"mn{r}{c}", use_container_width=True):
                            if not st.session_state.mines_game_over and not st.session_state.mines_won:
                                if st.session_state.mines_flag_mode:
                                    cell["flagged"] = not cell["flagged"]
                                elif not cell["flagged"]:
                                    if st.session_state.mines_first_click:
                                        _place_mines(grid, r, c, SIZE, N_MINES)
                                        st.session_state.mines_first_click = False
                                    if cell["mine"]:
                                        cell["revealed"] = True
                                        # Reveal all mines
                                        for i in range(SIZE):
                                            for j in range(SIZE):
                                                if grid[i][j]["mine"]:
                                                    grid[i][j]["revealed"] = True
                                        st.session_state.mines_game_over = True
                                    else:
                                        _flood_reveal(grid, r, c, SIZE)
                                        # Check win: all non-mines revealed
                                        revealed = sum(1 for i in range(SIZE) for j in range(SIZE)
                                                       if grid[i][j]["revealed"])
                                        if revealed == SIZE*SIZE - N_MINES:
                                            st.session_state.mines_won = True
                                st.session_state.mines_grid = grid
                                st.rerun()

        flagged = sum(1 for i in range(SIZE) for j in range(SIZE) if grid[i][j]["flagged"])
        st.markdown(f"**Mines:** {N_MINES} | **Flags placed:** {flagged}")
        st.markdown("---")
        if st.button("🔄 Learn Another Word", use_container_width=True):
            reset_for_new_word()

    # ── Wordle ────────────────────────────────────────────────────────────────
    elif st.session_state.selected_game == "wordle":
        st.title("🔤 Wordle")
        st.markdown("Guess the 5-letter word in **6 tries**.")

        answer = st.session_state.wordle_answer
        guesses = st.session_state.wordle_guesses

        COLOR_BG = {"green": "#6aaa64", "yellow": "#c9b458", "gray": "#787c7e"}

        # Display previous guesses
        for guess_scored in guesses:
            html = "<div style='display:flex;gap:6px;margin:4px 0;'>"
            for letter, color in guess_scored:
                bg = COLOR_BG[color]
                html += (f"<div style='width:52px;height:52px;background:{bg};color:white;"
                         f"display:flex;align-items:center;justify-content:center;"
                         f"font-size:24px;font-weight:bold;border-radius:4px;'>{letter}</div>")
            html += "</div>"
            st.markdown(html, unsafe_allow_html=True)

        # Empty rows
        for _ in range(6 - len(guesses)):
            html = "<div style='display:flex;gap:6px;margin:4px 0;'>"
            for _ in range(5):
                html += ("<div style='width:52px;height:52px;border:2px solid #d3d6da;"
                         "border-radius:4px;'></div>")
            html += "</div>"
            st.markdown(html, unsafe_allow_html=True)

        if st.session_state.wordle_won:
            st.success(f"🎉 Correct! The word was **{answer}**")
        elif st.session_state.wordle_lost:
            st.error(f"The word was **{answer}**. Better luck next time!")
        elif len(guesses) < 6:
            st.markdown("---")
            guess_input = st.text_input("Your guess:", max_chars=5,
                                        placeholder="Type a 5-letter word",
                                        key=f"wordle_input_{len(guesses)}").upper().strip()
            if st.button("Submit Guess", type="primary") and guess_input:
                if len(guess_input) != 5 or not guess_input.isalpha():
                    st.warning("Please enter exactly 5 letters.")
                else:
                    scored = score_wordle(guess_input, answer)
                    guesses.append(scored)
                    st.session_state.wordle_guesses = guesses
                    if guess_input == answer:
                        st.session_state.wordle_won = True
                    elif len(guesses) >= 6:
                        st.session_state.wordle_lost = True
                    st.rerun()

        st.markdown("---")
        if st.button("🔄 Learn Another Word", use_container_width=True):
            reset_for_new_word()

    # ── Nonogram ──────────────────────────────────────────────────────────────
    elif st.session_state.selected_game == "nonogram":
        st.title("🎯 Nonogram")
        st.markdown("Fill in the grid according to the number clues. Numbers show consecutive filled cells in each row/column.")

        sol = st.session_state.nono_solution
        grid = st.session_state.nono_grid
        row_clues = st.session_state.nono_row_clues
        col_clues = st.session_state.nono_col_clues
        SIZE = 5

        if st.session_state.nono_won:
            st.success("🎉 Puzzle solved!")
            st.balloons()

        # Column clues header
        header_cols = st.columns([1] + [1]*SIZE)
        with header_cols[0]:
            st.markdown("&nbsp;", unsafe_allow_html=True)
        for c in range(SIZE):
            with header_cols[c+1]:
                clue_str = "\n".join(str(n) for n in col_clues[c])
                st.markdown(
                    f"<div style='text-align:center;font-weight:bold;font-size:14px;"
                    f"color:#2c3e50;'>{clue_str}</div>",
                    unsafe_allow_html=True)

        # Grid rows with row clues
        for r in range(SIZE):
            row_cols = st.columns([1] + [1]*SIZE)
            with row_cols[0]:
                clue_str = " ".join(str(n) for n in row_clues[r])
                st.markdown(
                    f"<div style='text-align:right;font-weight:bold;font-size:14px;"
                    f"color:#2c3e50;padding-right:6px;line-height:36px;'>{clue_str}</div>",
                    unsafe_allow_html=True)
            for c in range(SIZE):
                with row_cols[c+1]:
                    filled = grid[r][c]
                    label = "■" if filled else "□"
                    if st.button(label, key=f"no{r}{c}", use_container_width=True):
                        grid[r][c] = not grid[r][c]
                        st.session_state.nono_grid = grid
                        if grid == sol:
                            st.session_state.nono_won = True
                        st.rerun()

        st.markdown("---")
        if st.button("🔄 Learn Another Word", use_container_width=True):
            reset_for_new_word()


# ─── Stage: REVIEW — Memory Match ─────────────────────────────────────────────
elif st.session_state.stage == "review_memory":
    st.title("🃏 Memory Match — Your Words")
    st.markdown("Match each Chinese character with its English meaning!")

    cards  = st.session_state.review_memory_cards
    first  = st.session_state.review_memory_first
    second = st.session_state.review_memory_second

    if cards is None:
        go("input")
    else:
        n_cards = len(cards)
        cols_per_row = 4

        if second is not None:
            c1, c2 = cards[first], cards[second]
            if c1["chinese"] == c2["chinese"]:
                cards[first]["matched"] = True
                cards[second]["matched"] = True
                st.session_state.review_memory_first = None
                st.session_state.review_memory_second = None
                if all(c["matched"] for c in cards):
                    st.session_state.review_memory_won = True
            else:
                st.warning("No match! Click **Continue** to flip them back.")
                if st.button("Continue", type="primary"):
                    cards[first]["flipped"] = False
                    cards[second]["flipped"] = False
                    st.session_state.review_memory_first = None
                    st.session_state.review_memory_second = None
                    st.rerun()

        if st.session_state.review_memory_won:
            st.success("🎉 You matched all the pairs!")
            st.balloons()
            col_a, col_b = st.columns(2)
            with col_a:
                if st.button("🔄 Play again", use_container_width=True, type="primary"):
                    init_review_memory(load_learned_words())
                    st.rerun()
            with col_b:
                if st.button("🏠 Home", use_container_width=True):
                    go("input")

        for row_start in range(0, n_cards, cols_per_row):
            cols = st.columns(cols_per_row)
            for col_idx, card_idx in enumerate(range(row_start, min(row_start + cols_per_row, n_cards))):
                card = cards[card_idx]
                with cols[col_idx]:
                    if card["matched"]:
                        st.markdown(
                            f"<div style='background:#d4edda;border-radius:8px;padding:12px;"
                            f"text-align:center;min-height:70px;display:flex;align-items:center;"
                            f"justify-content:center;flex-direction:column;'>"
                            f"<span style='font-size:28px;color:#c0392b;'>{card['chinese']}</span>"
                            f"<small>{card['english']}</small></div>",
                            unsafe_allow_html=True)
                    elif card_idx in (first, second):
                        show = card["chinese"] if card_idx == first else card["english"]
                        st.markdown(
                            f"<div style='background:#fff3cd;border-radius:8px;padding:12px;"
                            f"text-align:center;font-size:22px;min-height:70px;"
                            f"display:flex;align-items:center;justify-content:center;'>"
                            f"{show}</div>",
                            unsafe_allow_html=True)
                    else:
                        if st.button("?", key=f"rm_{card_idx}", use_container_width=True):
                            if first is None:
                                st.session_state.review_memory_first = card_idx
                            elif second is None and card_idx != first:
                                st.session_state.review_memory_second = card_idx
                            st.rerun()

        st.markdown("---")
        if st.button("🏠 Quit", use_container_width=True):
            go("input")

# ─── Stage: SKY DROP ──────────────────────────────────────────────────────────
elif st.session_state.stage == "sky_drop":
    import json as _json
    import streamlit.components.v1 as components

    learned = load_learned_words()
    st.title("☁️ Sky Drop")
    if st.button("🏠 Home"):
        go("input")

    game_words = random.sample(learned, min(30, len(learned)))
    words_json = _json.dumps([
        {"chinese": w["chinese"], "pinyin": w["pinyin"], "english": w["english"]}
        for w in game_words
    ])

    game_html = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(180deg,#0f0c29 0%,#302b63 55%,#24243e 100%);
     color:white;font-family:Arial,sans-serif;height:600px;overflow:hidden;position:relative}
#hud{position:absolute;top:8px;left:12px;right:12px;display:flex;
     justify-content:space-between;align-items:center;font-size:17px;z-index:10}
#arena{position:absolute;top:40px;left:0;right:0;bottom:56px}
.tile{position:absolute;background:rgba(255,255,255,0.13);
      border:2px solid rgba(255,255,255,0.35);border-radius:10px;
      padding:5px 13px;text-align:center;transform:translateX(-50%);
      box-shadow:0 0 10px rgba(100,180,255,0.25);min-width:58px;pointer-events:none}
.tile .ch{font-size:30px;font-weight:bold;line-height:1.1}
.tile .py{font-size:11px;opacity:.75}
.tile.boom{border-color:#e74c3c;background:rgba(231,76,60,.7);
           box-shadow:0 0 22px #e74c3c;animation:explode .45s forwards}
@keyframes explode{0%{transform:translateX(-50%) scale(1);opacity:1}
                   60%{transform:translateX(-50%) scale(1.6);opacity:.8}
                   100%{transform:translateX(-50%) scale(0);opacity:0}}
#ground{position:absolute;bottom:56px;left:0;right:0;height:5px;
        background:#c0392b;box-shadow:0 0 12px #c0392b}
#glabel{position:absolute;bottom:62px;left:0;right:0;text-align:center;
        color:rgba(255,80,80,.8);font-size:10px;letter-spacing:3px}
#mic-bar{position:absolute;bottom:0;left:0;right:0;height:56px;
         background:rgba(0,0,0,.45);display:flex;align-items:center;padding:0 14px;gap:10px}
#dot{width:12px;height:12px;border-radius:50%;background:#555;flex-shrink:0}
#dot.on{background:#2ecc71;animation:pulse 1s infinite}
#dot.speak{background:#e74c3c;animation:pulse .3s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
#mic-txt{flex:1;font-size:13px;color:#aaa}
#heard{font-size:12px;color:#f1c40f;min-width:80px;text-align:right}
#over,#winover{display:none;position:absolute;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,.88);flex-direction:column;align-items:center;
      justify-content:center;gap:14px;z-index:50}
#over h1{color:#e74c3c;font-size:34px}
#winover h1{color:#2ecc71;font-size:34px}
#over .sc,#winover .sc{font-size:22px}
#over small,#winover small{color:#aaa;font-size:13px}
</style></head><body>
<div id="hud">
  <span id="hrt">❤️❤️❤️</span>
  <span id="sc">Score: 0</span>
  <span id="spd"></span>
</div>
<div id="arena"></div>
<div id="glabel">⚠ GROUND</div>
<div id="ground"></div>
<div id="mic-bar">
  <div id="dot"></div>
  <div id="mic-txt">Starting mic…</div>
  <div id="heard"></div>
</div>
<div id="over">
  <h1>💀 Game Over</h1>
  <div class="sc">Score: <b id="fscore">0</b></div>
  <small>Click 🏠 Home above to exit</small>
</div>
<div id="winover">
  <h1>🎉 You Win!</h1>
  <div class="sc">Score: <b id="win-score">0</b></div>
  <small>All words destroyed! Click 🏠 Home above.</small>
</div>
<script>
const WORDS = """ + words_json + """;
let tiles=[], score=0, lives=3, dead=false;
const spawnCounts={};  // chinese → times spawned
const MAX_SPAWNS=2;

const arena  = document.getElementById('arena');
const hrtEl  = document.getElementById('hrt');
const scEl   = document.getElementById('sc');
const spdEl  = document.getElementById('spd');
const dotEl  = document.getElementById('dot');
const txtEl  = document.getElementById('mic-txt');
const heardEl= document.getElementById('heard');
const overEl = document.getElementById('over');

function hud(){
  hrtEl.textContent = '❤️'.repeat(lives)+'🖤'.repeat(Math.max(0,3-lives));
  scEl.textContent  = 'Score: '+score;
  const s=1+Math.floor(score/5); spdEl.textContent = s>1?'🚀 x'+s:'';
}
function speed(){ return 0.3+Math.floor(score/5)*0.15; }

function allDone(){
  const canSpawn=WORDS.some(w=>(spawnCounts[w.chinese]||0)<MAX_SPAWNS);
  return !canSpawn && tiles.length===0;
}

function spawn(startY){
  const onScreen=new Set(tiles.map(t=>t.word.chinese));
  const pool=WORDS.filter(w=>!onScreen.has(w.chinese)&&(spawnCounts[w.chinese]||0)<MAX_SPAWNS);
  if(!pool.length) return;
  const w=pool[Math.floor(Math.random()*pool.length)];
  spawnCounts[w.chinese]=(spawnCounts[w.chinese]||0)+1;
  const shown=spawnCounts[w.chinese];
  const dots='●'.repeat(shown)+'○'.repeat(MAX_SPAWNS-shown);
  const x=15+Math.random()*70;
  const el=document.createElement('div');
  el.className='tile';
  el.innerHTML=`<div class="ch">${w.chinese}</div><div style="font-size:9px;opacity:.6;letter-spacing:2px">${dots}</div>`;
  el.style.left=x+'%';
  el.style.top=(startY||0)+'px';
  arena.appendChild(el);
  tiles.push({word:w, el, y:startY||0});
}

function destroy(tile){
  tile.el.classList.add('boom');
  tiles=tiles.filter(t=>t!==tile);
  setTimeout(()=>{
    tile.el.remove();
    if(dead) return;
    if(allDone()){ winGame(); return; }
    spawn(-10);
  }, 450);
}

// match: any CJK char from word.chinese appears in transcript
function matches(transcript, chinese){
  return [...chinese].some(c=>transcript.includes(c));
}

function checkSpeech(text){
  heardEl.textContent='🗣 '+text;
  for(const t of [...tiles]){
    if(matches(text, t.word.chinese)){
      destroy(t); score++; hud(); return;
    }
  }
}

// Animation loop
let last=0;
function tick(ts){
  if(dead) return;
  const dt=Math.min(ts-last, 100); last=ts;
  const h=arena.clientHeight;
  for(const t of [...tiles]){
    t.y += speed()*(dt/50);
    t.el.style.top=t.y+'px';
    if(t.y >= h-10){
      t.el.remove(); tiles=tiles.filter(x=>x!==t);
      lives=Math.max(0,lives-1); hud();
      if(lives<=0){ endGame(); return; }
      if(allDone()){ winGame(); return; }
      spawn(-10);
    }
  }
  while(tiles.length<3){
    const before=tiles.length; spawn(-10);
    if(tiles.length===before) break; // pool exhausted, stop
  }
  if(allDone()){ winGame(); return; }
  requestAnimationFrame(tick);
}

function endGame(){
  dead=true;
  if(recog){ try{recog.stop()}catch(e){} }
  document.getElementById('fscore').textContent=score;
  overEl.style.display='flex';
}

function winGame(){
  dead=true;
  if(recog){ try{recog.stop()}catch(e){} }
  document.getElementById('win-score').textContent=score;
  document.getElementById('winover').style.display='flex';
}

// Staggered initial spawn
for(let i=0;i<Math.min(3,WORDS.length);i++) setTimeout(()=>spawn(-(i*120)), i*1200);
hud();
requestAnimationFrame(tick);

// Web Speech API
let recog=null;
function startMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ txtEl.textContent='❌ Use Chrome for speech support'; return; }
  recog=new SR();
  recog.lang='zh-CN';
  recog.continuous=true;
  recog.interimResults=true;
  recog.onstart=()=>{ dotEl.className='on'; txtEl.textContent='🎤 Listening — say any word you see!'; };
  recog.onspeechstart=()=>{ dotEl.className='speak'; };
  recog.onspeechend=()=>{ dotEl.className='on'; };
  recog.onresult=(e)=>{
    for(let i=e.resultIndex;i<e.results.length;i++){
      // Use interim results for speed; final results for accuracy fallback
      const text=e.results[i][0].transcript.trim();
      if(text) checkSpeech(text);
    }
  };
  recog.onerror=(e)=>{
    dotEl.className='';
    txtEl.textContent='⚠ Mic error ('+e.error+') — retrying…';
    if(e.error!=='aborted'&&!dead) setTimeout(startMic,1200);
  };
  recog.onend=()=>{ if(!dead) setTimeout(startMic,300); };
  recog.start();
}
startMic();
</script></body></html>"""

    components.html(game_html, height=620, scrolling=False)
