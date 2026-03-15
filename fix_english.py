#!/usr/bin/env python3
"""
Re-score CC-CEDICT definitions to pick the most common/natural English meaning
for each character in characters.csv, then update the file in-place.
"""
import gzip, io, os, re, json, urllib.request, pandas as pd
from pathlib import Path

CSV_PATH = Path(__file__).parent / "characters.csv"
CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"

# ── patterns that make a definition a bad primary choice ──────────────────────
BAD_PRIMARY = re.compile(
    r"^(surname |old variant|variant of|see |used in |abbr\. for|abbr\.|"
    r"erhua variant|archaic|ancient|dialectal|\(bound form\)|\(suffix\)|\(prefix\))",
    re.IGNORECASE,
)

def score_definition(defn: str) -> int:
    """Lower score = better. Prefer short, clean, common meanings."""
    if BAD_PRIMARY.match(defn):
        return 100
    score = 0
    # prefer shorter definitions (less jargon)
    score += min(len(defn) // 20, 5)
    # penalise bracket-heavy entries (e.g. references to other entries)
    score += defn.count("[") * 3
    score += defn.count("(") * 1
    return score

def parse_cedict(gz_bytes: bytes) -> dict[str, list[str]]:
    """Parse gzipped CC-CEDICT and return {simplified: [def1, def2, ...]} for single chars."""
    result: dict[str, list[str]] = {}
    with gzip.open(io.BytesIO(gz_bytes)) as f:
        for raw in f:
            line = raw.decode("utf-8", errors="ignore").strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^\S+\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$", line)
            if not m:
                continue
            simplified = m.group(1)
            if len(simplified) != 1:          # single-character entries only
                continue
            defs = [d.strip() for d in m.group(3).split("/") if d.strip()]
            if simplified not in result:
                result[simplified] = []
            result[simplified].extend(defs)
    return result

def best_definition(defs: list[str]) -> str:
    """Pick the best English definition from a list."""
    if not defs:
        return ""
    ranked = sorted(defs, key=score_definition)
    return ranked[0]

# ── Claude fallback for anything still looking bad ─────────────────────────────
def claude_translate_batch(chars_needed: list[str]) -> dict[str, str]:
    """Ask Claude to provide the most common English meaning for a batch of characters."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key or not chars_needed:
        return {}
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    results = {}
    # Process in batches of 100
    for i in range(0, len(chars_needed), 100):
        batch = chars_needed[i:i+100]
        char_list = "\n".join(f"{c}" for c in batch)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            messages=[{
                "role": "user",
                "content": (
                    "For each Chinese character below, give its single most common everyday English meaning "
                    "(2-5 words max, no pinyin, no explanations, no 'surname', no 'variant of').\n"
                    "Reply as JSON: {\"char\": \"meaning\", ...}\n\n"
                    f"{char_list}"
                ),
            }],
        )
        try:
            raw = msg.content[0].text.strip()
            raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            results.update(json.loads(raw))
        except Exception as e:
            print(f"  Claude batch error: {e}")
        print(f"  Claude: processed {min(i+100, len(chars_needed))}/{len(chars_needed)}")
    return results

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Loading characters.csv …")
    df = pd.read_csv(CSV_PATH)

    print(f"Downloading CC-CEDICT …")
    with urllib.request.urlopen(CEDICT_URL, timeout=30) as r:
        gz_bytes = r.read()
    print(f"  Downloaded {len(gz_bytes):,} bytes. Parsing …")
    cedict = parse_cedict(gz_bytes)
    print(f"  Parsed {len(cedict):,} single-character entries.")

    new_english = []
    still_bad   = []   # characters where CC-CEDICT still gives a bad result

    for _, row in df.iterrows():
        char = row["character"]
        defs = cedict.get(char, [])
        best = best_definition(defs)

        # Flag as still-bad if the best is empty or matches bad patterns
        if not best or BAD_PRIMARY.match(best):
            still_bad.append(char)
            new_english.append(best)   # placeholder, will be overwritten
        else:
            new_english.append(best)

    print(f"\nCC-CEDICT resolved: {len(df) - len(still_bad)}/{len(df)}")
    print(f"Sending {len(still_bad)} chars to Claude for better translations …")

    claude_results = claude_translate_batch(still_bad)

    # Apply Claude overrides
    for idx, row in df.iterrows():
        char = row["character"]
        if char in claude_results and claude_results[char]:
            new_english[idx] = claude_results[char]

    df["english"] = new_english
    df.to_csv(CSV_PATH, index=False)
    print(f"\nDone. Updated {CSV_PATH}")

    # Quick sanity preview
    print("\nSample (first 30 rows):")
    print(df.head(30)[["rank","character","pinyin","english","level"]].to_string(index=False))

if __name__ == "__main__":
    main()
