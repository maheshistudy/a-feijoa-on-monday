#!/usr/bin/env python3
"""Bundle the storybook into ONE self-contained HTML file (images embedded).
Run:  python3 build-single-file.py   ->  pip-storybook.html
Double-click the result, email it, put it on a USB stick, or drop it on any host."""
import base64, re, pathlib, mimetypes
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/style.css').read_text(encoding='utf-8')
js = ''.join((root / f).read_text(encoding='utf-8') + '\n' for f in ['js/audio.js', 'js/story.js', 'js/app.js'])

data = {}
for p in sorted((root / 'assets/img').glob('*')):
    if p.name == 'storyboard.jpg': continue
    mime = mimetypes.guess_type(p.name)[0]
    data[p.name] = f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()

def embed(text):
    for name, uri in data.items():
        text = text.replace(f'../assets/img/{name}', uri).replace(f'assets/img/{name}', uri)
    return text

html = re.sub(r'<link rel="manifest"[^>]*>\n?', '', html)
html = re.sub(r'<link rel="icon"[^>]*>\n?', '', html)
html = re.sub(r'<link rel="stylesheet" href="css/style\.css"\s*/?>', '<style>\n' + embed(css) + '\n</style>', html)
html = re.sub(r'<script src="js/[^"]+"></script>\n', '', html)
html = re.sub(r'<script>\s*if \(\'serviceWorker\'.*?</script>', '', html, flags=re.S)
html = html.replace('</body>', '<script>\n' + embed(js) + '\n</script>\n</body>')
html = embed(html)
out = root / 'pip-storybook.html'
out.write_text(html, encoding='utf-8')
print(f'wrote {out} ({out.stat().st_size // 1024} KB)')
