from pathlib import Path
import re

text = Path('/home/ubuntu/nephro/research/kidney-analysis-reference.js').read_text(errors='ignore')
patterns = [
    r'fetch\(',
    r'FileReader',
    r'(?:predict|diagnos|confidence|lesion|tumou?r|stone|cyst|mass|classification|report)',
]
for pattern in patterns:
    print(f'--- {pattern} ---')
    matches = list(re.finditer(pattern, text, flags=re.I))[:20]
    for match in matches:
        start = max(0, match.start() - 220)
        end = min(len(text), match.end() + 420)
        print(text[start:end].replace('\\n', ' ')[:700])
        print()
