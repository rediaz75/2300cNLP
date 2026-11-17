# LeadBeam: landing page

A static landing page (HTML, CSS and vanilla JS, with no build step) deployed on Netlify.

## Structure

```
public/                 ← Netlify publish directory
  index.html            ← the page (English copy inline for SEO)
  thanks.html           ← fallback success page for the form (no-JS)
  favicon.svg
  assets/css/styles.css
  assets/js/i18n.js     ← all English / Spanish copy
  assets/js/main.js     ← language & theme toggles, calculator, demo, booking modal
  word2vec/             ← Word2Vec Lab page  →  /word2vec/
    index.html, w2v.css, w2v.js
    model/              ← trained vectors (vocab.json, vectors.bin, meta.json)
    vendor/             ← plotly.js gl3d build (MIT), self-hosted
training/
  train_word2vec.py     ← trains the model and exports it to public/word2vec/model/
  requirements.txt
netlify.toml            ← publish dir + security headers
```

## Word2Vec Lab (`/word2vec/`)

An NLP class demo linked from the main nav ("Word2Vec Lab") and footer.

- **Model:** gensim Word2Vec, skip-gram with negative sampling, 100 dimensions, window ±5, 15 epochs,
  trained on 7.2M tokens of NLTK corpora (Brown, Gutenberg, Reuters, Web text, Inaugural, ABC, State of the Union, Movie reviews).
  The 20,000 most frequent words are shipped to the browser as int8 vectors (2 MB).
- **Nearest neighbors:** type a word (or up to 4, comma-separated) and see the 10 closest words by cosine similarity,
  computed in the browser. Results are shareable: `/word2vec/?w=car,money,war`.
- **3D map:** PCA projects the query words and their neighbors from 100-D to 3-D (plotly.js). It can also show
  "context" words (neighbors of neighbors) projected into the same space.
- **Analogies:** `A − B + C` (e.g. *france − paris + tokyo ≈ japan*).

Retrain (about 3 minutes on 4 cores):

```bash
pip install -r training/requirements.txt
python training/train_word2vec.py
```


## Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub**, then pick this repo, branch `main`.
2. Netlify reads `netlify.toml` (publish directory `public`, no build command), so leave the build settings blank.
3. Deploy.

### Booking form (Netlify Forms)

The "Book My Free Lead Audit" modal is a Netlify Form named **`lead-audit`**. After the first deploy:

- Make sure **Forms → Form detection** is enabled in the Netlify site settings (redeploy once if you enable it after the first deploy).
- Submissions appear under **Forms → lead-audit**. Add an email notification under **Forms → Form notifications** so you're alerted for each new lead.

Fields captured: name, phone, email, business, trade, missed calls/week, preferred language, SMS consent, chosen day & time, in-person preference, and the site language.

## Editing copy

All text lives in `public/assets/js/i18n.js` (`en` and `es`). The English strings are also inline in `index.html` so search engines see them. If you change a headline, update both.

## Still to fill in before launch

- Walkthrough video (placeholder in the "See It Work" section)
- `[X] years` in the founder bio (`bio` in i18n.js)
- Links for Privacy Policy, Terms, SMS Terms, Cookie Policy, Accessibility, Client Login, and "See my past web work". These are currently `#`. **The Privacy Policy and SMS Terms are needed for A2P 10DLC texting registration.**
- The brand is now **LeadBeam**, but the domain and email still use `leadtobooked.com`. When the new domain is ready, update the canonical, `og:url`, `og:image` and `twitter:image` URLs in `public/index.html` (and `og:image` in `public/word2vec/index.html`), plus the email address.
