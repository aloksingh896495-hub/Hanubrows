STUDY BROWSER – PWA
Files: index.html, style.css, app.js, manifest.webmanifest, sw.js, icons/ (7 PNGs)

HOW TO PUBLISH (free, HTTPS is required for "Install app"):
 1. Netlify: drag this whole folder onto https://app.netlify.com/drop
    (or GitHub Pages / Vercel / Cloudflare Pages: upload the folder as-is)
 2. Open the https:// link on your phone in Chrome -> menu -> "Install app" / "Add to Home screen"
    (or use the "Install" button inside the left side-bar)

When you change any file, edit CACHE='study-browser-v1' in sw.js (v2, v3...) so installed apps update.
Data (analytics, stopwatch, bookmarks, layout) is stored only on the user's device (localStorage).
