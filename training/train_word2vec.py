#!/usr/bin/env python3
"""
Train a Word2Vec model on classic NLTK corpora and export it for the browser.

    pip install -r training/requirements.txt
    python training/train_word2vec.py            # downloads corpora, trains, exports

Output (served by Netlify from public/word2vec/model/):
    vocab.json    list of words, most frequent first
    vectors.bin   int8 matrix [n_words x dim], each row L2-normalised then scaled by 127
    meta.json     training settings + corpus stats, shown on the page

The browser de-quantises the int8 rows and ranks words by cosine similarity,
so "10 closest words" on the page is exactly model.wv.most_similar(word, topn=10)
(up to quantisation error).
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from collections import Counter

import numpy as np
from gensim.models import Word2Vec

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, ".corpora")          # git-ignored download cache
OUT = os.path.join(ROOT, "public", "word2vec", "model")

NLTK_URL = "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/{}.zip"
CORPORA = ["brown", "gutenberg", "reuters", "webtext", "inaugural", "abc", "state_union", "movie_reviews"]

# Model hyper-parameters (classic skip-gram with negative sampling).
PARAMS = dict(vector_size=100, window=5, min_count=5, sg=1, negative=10, sample=1e-4, epochs=15, seed=42)
EXPORT_WORDS = 20000   # most frequent words shipped to the browser

TOKEN = re.compile(r"[a-z]+(?:'[a-z]+)?")
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n\s*\n")


def download(name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name + ".zip")
    if not os.path.exists(path):
        print(f"  downloading {name} …", flush=True)
        urllib.request.urlretrieve(NLTK_URL.format(name), path)
    return path


def sentences_from_corpus(name):
    """Yield lists of lowercase tokens, one per sentence."""
    with zipfile.ZipFile(download(name)) as z:
        for info in z.infolist():
            fn = info.filename
            if info.is_dir() or fn.split("/")[-1].startswith(("README", "LICENSE", "CONTENTS", "cats", "stopwords")):
                continue
            raw = z.read(info).decode("latin-1")
            if name == "brown":
                # Brown is POS-tagged: "The/at Fulton/np-tl County/nn-tl ..." -> keep the word part.
                raw = " ".join(tok.rsplit("/", 1)[0] for tok in raw.split())
                raw = re.sub(r"\s([.!?])\s", r" \1\n\n", raw)
            for chunk in SENT_SPLIT.split(raw):
                toks = TOKEN.findall(chunk.lower())
                if len(toks) >= 3:
                    yield toks


def main():
    t0 = time.time()
    print("Loading corpora:")
    sents, per_corpus = [], {}
    for c in CORPORA:
        before = sum(map(len, sents))
        sents.extend(sentences_from_corpus(c))
        per_corpus[c] = sum(map(len, sents)) - before
        print(f"  {c:14s} {per_corpus[c]:>10,} tokens")
    n_tokens = sum(per_corpus.values())
    print(f"Total: {len(sents):,} sentences, {n_tokens:,} tokens")

    print("Training Word2Vec", PARAMS, flush=True)
    model = Word2Vec(sentences=sents, workers=os.cpu_count() or 2, **PARAMS)
    wv = model.wv
    print(f"Vocabulary: {len(wv.index_to_key):,} words  ({time.time() - t0:.0f}s)")

    # Sanity checks printed for the log.
    for w in ["king", "money", "war", "love", "computer", "monday"]:
        if w in wv:
            print(f"  {w:10s} -> " + ", ".join(x for x, _ in wv.most_similar(w, topn=8)))
    try:
        print("  king - man + woman ->", [x for x, _ in wv.most_similar(positive=["king", "woman"], negative=["man"], topn=5)])
    except KeyError:
        pass

    # Export the most frequent words (gensim keeps index_to_key sorted by frequency).
    words = wv.index_to_key[:EXPORT_WORDS]
    mat = np.stack([wv[w] for w in words]).astype(np.float32)
    mat /= np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9
    q = np.clip(np.round(mat * 127), -127, 127).astype(np.int8)

    os.makedirs(OUT, exist_ok=True)
    q.tofile(os.path.join(OUT, "vectors.bin"))
    with open(os.path.join(OUT, "vocab.json"), "w") as f:
        json.dump(words, f, separators=(",", ":"))
    counts = Counter()
    for w in words:
        counts[w] = wv.get_vecattr(w, "count")
    meta = {
        "dim": PARAMS["vector_size"],
        "words": len(words),
        "full_vocab": len(wv.index_to_key),
        "tokens": n_tokens,
        "sentences": len(sents),
        "corpora": per_corpus,
        "params": {k: v for k, v in PARAMS.items() if k != "seed"},
        "algorithm": "skip-gram with negative sampling (gensim " + __import__("gensim").__version__ + ")",
        "quantization": "int8, rows L2-normalised x 127",
        "trained": time.strftime("%Y-%m-%d"),
    }
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"Exported {len(words):,} x {meta['dim']} to {OUT}  ({time.time() - t0:.0f}s total)")


if __name__ == "__main__":
    sys.exit(main())
