# Spinpath

Spin a topic, learn it in context, say it out loud.

- **Learn**: pick a goal (AI engineer, web, data, security, ...). Each spin is a random concept you haven't learned yet; progress is tracked in your browser.
- **Speak**: debate motions, fresh articles from the past week, interview questions, and "explain it to..." drills.
- **Deep research**: research a topic, then speak.

Static site, no build step. `articles.json` is refreshed daily by a GitHub Action (`scripts/fetch-articles.mjs`).
`node scripts/build-standalone.mjs` produces a single-file `spinpath.html`.
