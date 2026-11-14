# Lead-to-Booked: landing page

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
netlify.toml            ← publish dir + security headers
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

- Founder photo (the striped placeholder in the "Founding Clients" section)
- Walkthrough video (placeholder in the "See It Work" section)
- `[X] years` in the founder bio (`bio` in i18n.js)
- Links for Privacy Policy, Terms, SMS Terms, Cookie Policy, Accessibility, Client Login, and "See my past web work". These are currently `#`. **The Privacy Policy and SMS Terms are needed for A2P 10DLC texting registration.**
- Update the canonical/OG URL in `index.html` if the domain isn't `leadtobooked.com`.
