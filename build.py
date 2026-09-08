"""Regenerate the offline single-file edition; no third-party dependencies."""
from pathlib import Path
import re
root = Path(__file__).resolve().parent.parent
html = (root / 'dist/index.html').read_text()
js = (root / 'dist/app.js').read_text()
mod = (root / 'dist/modulation.js').read_text()
html = re.sub(r'<script src="modulation\.js">\s*</script>', lambda _: '<script>\n' + mod + '\n</script>', html)
html = re.sub(r'<script src="app\.js">\s*</script>', lambda _: '<script>\n' + js + '\n</script>', html)
(root / 'Supa-Canvas.html').write_text(html)
print('Built Supa-Canvas.html')
