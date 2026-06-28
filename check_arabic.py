import os, re

issues = []
for root, dirs, files_list in os.walk('src'):
    for f in files_list:
        if f.endswith(('.tsx', '.ts')):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='replace') as fh:
                text = fh.read()
            lines = text.split('\n')
            for i, line in enumerate(lines):
                for m in re.finditer(r"'(\?{3,})'", line):
                    issues.append(f'{path}:{i+1}: {m.group(1)} -- {line.strip()[:100]}')

for issue in issues:
    print(f'CORRUPTED: {issue}')
if not issues:
    print('No corrupted Arabic found in any source file')
