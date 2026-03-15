#!/usr/bin/env python3
"""
Use Claude to provide the most common learner-friendly English meaning
for every character in characters.csv, in batches of 80.
"""
import os, json, time, pandas as pd
from pathlib import Path

CSV_PATH = Path(__file__).parent / "characters.csv"

def translate_batch(client, batch: list[tuple[int, str, str]]) -> dict[str, str]:
    """batch = [(idx, char, pinyin), ...]  → {char: english}"""
    lines = "\n".join(f"{char} ({pinyin})" for _, char, pinyin in batch)
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        messages=[{
            "role": "user",
            "content": (
                "You are a Chinese language teacher. For each character+pinyin pair below, "
                "give the single most common, everyday English meaning a beginner learner should know. "
                "Rules:\n"
                "- 3-6 words maximum\n"
                "- No pinyin in the answer\n"
                "- No 'surname', 'variant of', 'see also', 'archaic'\n"
                "- For particles/grammar words, give a short functional label (e.g. '的: possessive particle', '了: completion marker')\n"
                "- For characters with multiple readings, use the most frequent reading's meaning\n"
                "Reply as a JSON object: {\"<char>\": \"<meaning>\", ...}\n\n"
                + lines
            ),
        }],
    )
    raw = msg.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)

def main():
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("No ANTHROPIC_API_KEY set.")
        return

    client = anthropic.Anthropic(api_key=api_key)

    print("Loading characters.csv …")
    df = pd.read_csv(CSV_PATH)
    total = len(df)
    new_english = list(df["english"])   # start with existing values

    batch_size = 80
    rows = list(df.iterrows())

    for start in range(0, total, batch_size):
        batch_rows = rows[start:start + batch_size]
        batch = [(idx, row["character"], row["pinyin"]) for idx, row in batch_rows]

        try:
            results = translate_batch(client, batch)
            for idx, char, _ in batch:
                if char in results and results[char].strip():
                    new_english[idx] = results[char].strip()
        except Exception as e:
            print(f"  Error at batch {start}: {e} — keeping existing values")

        done = min(start + batch_size, total)
        print(f"  {done}/{total} done")

    df["english"] = new_english
    df.to_csv(CSV_PATH, index=False)
    print(f"\nSaved to {CSV_PATH}")

    print("\nSample (first 30):")
    print(df.head(30)[["rank","character","pinyin","english","level"]].to_string(index=False))

if __name__ == "__main__":
    main()
