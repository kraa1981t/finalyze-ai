import os, re

def read_file(path):
    with open(path, 'rb') as f:
        raw = f.read()
    # Remove BOM if present
    if raw[:3] == b'\xef\xbb\xbf':
        raw = raw[3:]
    return raw.decode('utf-8', errors='replace')

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def has_box_drawing(text):
    for ch in text:
        cp = ord(ch)
        if 0x2550 <= cp <= 0x256C or 0x2580 <= cp <= 0x259F:
            return True
    return False

# ===== Fix App.tsx =====
print("Fixing App.tsx...")
content = read_file('src/App.tsx')

# All corrupted inline Arabic strings in App.tsx
app_fixes = {
    "`\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a ${symbols}`": "`\\u062a\\u0646\\u0628\\u064a\\u0647 \\u0641\\u0631\\u0635\\u0629 \\u062c\\u062f\\u064a\\u062f\\u0629: ${symbols}`",
}

# Actually, let's just find all lines with box-drawing and replace the Arabic portions
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if not has_box_drawing(line):
        new_lines.append(line)
        continue
    
    # This line has corruption - we need to fix it
    # Extract the corrupted string content between quotes
    original_line = line
    
    # Check for lang === 'ar' ? 'CORRUPTED' : 'English' pattern
    # Pattern 1: ternary with single quotes
    m = re.search(r"lang\s*===\s*'ar'\s*\?\s*'([^']+)'", line)
    if m:
        corrupted = m.group(1)
        # Determine correct text based on surrounding English
        eng_m = re.search(r":\s*'([^']+)'", line[m.end():])
        if eng_m:
            english = eng_m.group(1)
            correct = get_arabic_for(english, corrupted)
            if correct:
                line = line.replace(corrupted, correct)
    
    new_lines.append(line)

# This approach is too complex for a generic script. Let me just do direct replacements.
# Read the actual content and do byte-level fixes.

print("Using direct replacement approach...")

# App.tsx - replace specific corrupted strings
app_fixes_direct = [
    # L249: setNewSignalAlert alert
    ('setNewSignalAlert(lang === \'ar\' ? `' + '\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a\u256a ${symbols}`',
     None),  # Need to find exact corrupted form
]

# Let me just show all corrupted lines for manual fixing
content = read_file('src/App.tsx')
lines = content.split('\n')
for i, line in enumerate(lines):
    if has_box_drawing(line):
        # Replace corruption chars with * for display
        safe = ''
        for ch in line:
            cp = ord(ch)
            if 0x2550 <= cp <= 0x256C or 0x2580 <= cp <= 0x259F:
                safe += '*'
            else:
                safe += ch
        print(f"App.tsx:{i+1}: {safe.strip()[:160]}")

print("\n" + "="*80)

# AnalysisResultView.tsx
print("\nFixing AnalysisResultView.tsx...")
content = read_file('src/components/AnalysisResultView.tsx')
lines = content.split('\n')
for i, line in enumerate(lines):
    if has_box_drawing(line):
        safe = ''
        for ch in line:
            cp = ord(ch)
            if 0x2550 <= cp <= 0x256C or 0x2580 <= cp <= 0x259F:
                safe += '*'
            else:
                safe += ch
        print(f"AnalysisResultView.tsx:{i+1}: {safe.strip()[:160]}")

print("\n" + "="*80)

# geminiService.ts
print("\ngeminiService.ts...")
content = read_file('src/services/geminiService.ts')
lines = content.split('\n')
for i, line in enumerate(lines):
    if has_box_drawing(line):
        safe = ''
        for ch in line:
            cp = ord(ch)
            if 0x2550 <= cp <= 0x256C or 0x2580 <= cp <= 0x259F:
                safe += '*'
            else:
                safe += ch
        print(f"geminiService.ts:{i+1}: {safe.strip()[:160]}")
