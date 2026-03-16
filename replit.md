# Learn Chinese App

A Chinese language learning application built with Streamlit that helps users learn Chinese characters through an interactive multi-stage process.

## Tech Stack

- **Language:** Python 3.12
- **Framework:** Streamlit
- **Database:** PostgreSQL (when `DATABASE_URL` is set) with automatic fallback to SQLite (`app.db`)
- **AI:** Anthropic Claude (for handwriting recognition and sentence generation)
- **Translation:** Google Translator via `deep-translator`
- **TTS:** gTTS (Google Text-to-Speech)
- **Speech Recognition:** Google Speech Recognition via `SpeechRecognition`

## Project Structure

- `app.py` - Main Streamlit application entry point (all features in one file)
- `characters.csv` - Dataset of 5,000 Chinese characters with Pinyin, meanings, frequency ranks
- `requirements.txt` - Python dependencies
- `build_characters.py` - Utility script to regenerate `characters.csv`
- `.streamlit/config.toml` - Streamlit server configuration (port 5000, 0.0.0.0)
- `app.db` - SQLite database (auto-generated at runtime)

## Features

- User authentication (login/register)
- Adaptive learning with 10 difficulty levels
- Translation, pronunciation, sentence generation, handwriting practice stages
- 7 mini-games as rewards: Sudoku, Sliding Puzzle, Memory Match, Lights Out, Minesweeper, Wordle, Nonogram

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for handwriting recognition and sentence generation features

## Running

```bash
streamlit run app.py --server.port 5000
```
