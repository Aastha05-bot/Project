# CyberSafe Nepal — File Structure

```
cybersafe/
├── index.html          # page shell, loads CSS/JS
├── css/
│   └── style.css        # all styles
├── js/
│   ├── characters.js     # CHAR_INFO registry + avatarHTML()
│   └── app.js            # map view, story engine, activities, boot()
├── data/
│   └── topics.json       # all 4 lessons: scenes, dialogue, quiz/activity content
└── assets/
    └── avatars/           # put maya.jpg, aarav.png, sita.jpg here
```

## Running it

`app.js` loads `data/topics.json` with `fetch()`, which browsers block over
`file://`. Serve the folder locally instead of double-clicking `index.html`:

```bash
cd cybersafe
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server — `npx serve`, VS Code's "Live Server", etc. — works too.)

## Notes

- `assets/avatars/` is empty — the original file referenced `maya.jpg`,
  `aarav.png`, and `sita.jpg` as CSS background-images but those files weren't
  in the upload. Drop them into that folder (with matching names) and the
  avatars will pick them up automatically; until then the avatar circles will
  just render as empty white circles.
- Editing a lesson's dialogue, quiz questions, or fill-in-the-blank items only
  requires editing `data/topics.json` — no HTML/JS changes needed.
- All interactive logic (typewriter effect, scene carousel, quiz, password
  strength meter, fill-in-the-blank) lives in `js/app.js`, unchanged from the
  original single-file version other than pulling `TOPICS` out into JSON.
