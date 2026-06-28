import os, re, sys

# Find all corrupted Arabic strings in source files
for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith(('.tsx', '.ts')) and f != 'i18n.ts':
            path = os.path.join(root, f)
            with open(path, 'rb') as fh:
                raw = fh.read()
            
            # Check for BOM
            if raw[:3] == b'\xef\xbb\xbf':
                print(f"BOM: {path}")
            
            text = raw.decode('utf-8', errors='replace')
            lines = text.split('\n')
            
            for i, line in enumerate(lines):
                # Look for box drawing characters in string literals
                has_corruption = False
                for ch in line:
                    cp = ord(ch)
                    if 0x2550 <= cp <= 0x256C or 0x2580 <= cp <= 0x259F:
                        has_corruption = True
                        break
                
                if has_corruption:
                    # Show hex of the corrupted portion
                    corrupted_bytes = []
                    in_string = False
                    for j, ch in enumerate(line):
                        cp = ord(ch)
                        if 0x2550 <= cp <= 0x256C or 0x2580 <= cp <= 0x259F:
                            corrupted_bytes.append(f"{cp:04X}")
                    
                    # Get surrounding context
                    stripped = line.strip()
                    # Replace non-ASCII with ?
                    safe = ''
                    for ch in stripped:
                        if ord(ch) < 128:
                            safe += ch
                        else:
                            safe += '?'
                    
                    print(f"{path}:{i+1} ({len(corrupted_bytes)} corr chars): {safe[:120]}")
