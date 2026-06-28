import re

with open('src/services/geminiService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace corrupted language rules line 657-658
old_657 = content.split('\n')[656]  # 0-indexed
old_658 = content.split('\n')[657]

new_657 = "${isAr ? `- ALL text fields (summary, detailedReasons impact) MUST be written in formal Arabic (\\u0639\\u0631\\u0628\\u064a) using professional financial terminology."
new_658 = "- Use terms like: \\u0627\\u0644\\u0632\\u062e\\u0645 \\u0627\\u0644\\u0627\\u062a\\u062c\\u0627\\u0647 \\u0627\\u0644\\u0645\\u0631\\u062a\\u0641\\u0639 \\u0644\\u062d\\u0638\\u0629 \\u0627\\u0644\\u0639\\u0631\\u0636 \\u0648\\u0627\\u0644\\u0637\\u0644\\u0628 \\u0627\\u0644\\u0646\\u0638\\u0627\\u0645\\u064a \\u0627\\u0644\\u0645\\u0647\\u0646\\u064a."

content = content.replace(old_657, new_657)
content = content.replace(old_658, new_658)

# Replace corrupted detailedReasons impacts (lines 678-687)
impacts = {
    "'\\u0627\\u0644\\u0632\\u062e\\u0645 \\u0645\\u062a\\u0648\\u0627\\u0632\\u0646 \\u0644\\u0627 \\u0642\\u0631\\u0627\\u0626\\u0637 \\u0645\\u0637\\u0644\\u0642\\u0629'": True,
}

# Actually, let's just do direct line replacements
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if i == 677:  # RSI
        new_lines.append('    {"check": "RSI", "value": "62.5", "status": "neutral", "impact": "${isAr ? \'\\u0627\\u0644\\u0632\\u062e\\u0645 \\u0645\\u062a\\u0648\\u0627\\u0632\\u0646 \\u0644\\u0627 \\u0642\\u0631\\u0627\\u0626\\u0637 \\u0645\\u0637\\u0644\\u0642\\u0629\' : \'Momentum balanced, no extreme reading\'}"},')
    elif i == 678:  # EMA
        new_lines.append('    {"check": "EMA Cross", "value": "bullish", "status": "positive", "impact": "${isAr ? \'\\u0627\\u0644\\u0645\\u062a\\u0646\\u0627\\u0633\\u0642 9 \\u0641\\u0648\\u0642 9 \\u0627\\u0644\\u0645\\u062a\\u0646\\u0627\\u0633\\u0642 21 \\u064a\\u062f\\u0639\\u0645 \\u0627\\u0644\\u0627\\u062a\\u062c\\u0627\\u0647 \\u0627\\u0644\\u0635\\u0627\\u0639\\u062f\' : \'9 EMA above 21 EMA supports upward bias\'}"},')
    elif i == 679:  # Trend Direction
        new_lines.append('    {"check": "Trend Direction", "value": "uptrend", "status": "positive", "impact": "${isAr ? \'\\u0627\\u0644\\u0633\\u0639\\u0631 \\u064a\\u0635\\u0646\\u0639 \\u0642\\u0645\\u0648\\u0627\\u062a \\u0623\\u0639\\u0644\\u0649 \\u0648\\u0646\\u0642\\u0627\\u0637 \\u0623\\u0639\\u0644\\u0649\' : \'Price making higher highs and higher lows\'}"},')
    elif i == 680:  # Trend Age
        new_lines.append('    {"check": "Trend Age Zone", "value": "mature (32c)", "status": "positive", "impact": "${isAr ? \'\\u0645\\u0646\\u0637\\u0642\\u0629 \\u0627\\u0644\\u0646\\u0636\\u062c \\u062a\\u0633\\u0645\\u062d \\u0628\\u0627\\u0644\\u062b\\u0642\\u0629 \\u0627\\u0644\\u0643\\u0627\\u0645\\u0644\\u0629\' : \'Mature zone allows full confidence\'}"},')
    elif i == 681:  # Volume
        new_lines.append('    {"check": "Volume Surge", "value": "true", "status": "positive", "impact": "${isAr ? \'\\u0627\\u0632\\u062f\\u062d\\u0627\\u0632 \\u0627\\u0644\\u062d\\u062c\\u0645 \\u064a\\u062a\\u0623\\u0643\\u062f \\u0627\\u0644\\u0643\\u0633\\u0631 \\u0627\\u0644\\u0645\\u0647\\u0646\\u064a\' : \'Volume spike confirms breakout momentum\'}"},')
    elif i == 682:  # Supply/Demand
        new_lines.append('    {"check": "Supply/Demand", "value": "demand 1.085", "status": "positive", "impact": "${isAr ? \'\\u0627\\u0644\\u0633\\u0639\\u0631 \\u064a\\u0633\\u062a\\u0648\\u064a \\u0639\\u0644\\u0649 \\u0645\\u0646\\u0637\\u0642\\u0629 \\u0637\\u0644\\u0628 \\u0642\\u0648\\u064a\\u0629\' : \'Price resting on strong demand zone\'}"},')
    elif i == 683:  # Micro
        new_lines.append('    {"check": "Micro Alignment", "value": "aligned", "status": "positive", "impact": "${isAr ? \'\\u0627\\u0644\\u0625\\u0637\\u0627\\u0631 \\u0627\\u0644\\u0632\\u0645\\u0646\\u064a \\u0627\\u0644\\u0635\\u063a\\u064a\\u0631 \\u064a\\u062a\\u0623\\u0643\\u062f \\u0627\\u0644\\u0627\\u062a\\u062c\\u0627\\u0647 \\u0627\\u0644\\u0631\\u0626\\u064a\\u0633\\u064a\' : \'Lower timeframe confirms macro direction\'}"},')
    elif i == 684:  # Fear&Greed
        new_lines.append('    {"check": "Fear&Greed", "value": "45/100", "status": "neutral", "impact": "${isAr ? \'\\u0645\\u0648\\u0627\\u0644\\u0641\\u0629 \\u0627\\u0644\\u0633\\u0648\\u0642 \\u0645\\u062a\\u0648\\u0627\\u0632\\u0646\\u0629 \\u0644\\u0627 \\u0642\\u0631\\u0627\\u0626\\u0637\' : \'Market sentiment balanced, no extreme\'}"},')
    elif i == 685:  # News
        new_lines.append('    {"check": "News Sentiment", "value": "2 positive", "status": "positive", "impact": "${isAr ? \'\\u062a\\u062f\\u0641\\u0639 \\u0623\\u062e\\u0628\\u0627\\u0631 \\u0645\\u0639\\u062f\\u064a\\u0629 \\u064a\\u062f\\u0639\\u0645 \\u0627\\u0644\\u0627\\u062a\\u062c\\u0627\\u0647\' : \'Favorable news flow supports direction\'}"},')
    elif i == 686:  # Economic
        new_lines.append('    {"check": "Economic Events", "value": "none", "status": "neutral", "impact": "${isAr ? \'\\u0644\\u0627 \\u062a\\u0648\\u062c\\u062f \\u0623\\u062d\\u062f\\u0627\\u062b \\u0627\\u0644\\u062a\\u0623\\u062b\\u064a\\u0631 \\u0627\\u0644\\u0639\\u0627\\u0644\\u064a\\u0629 \\u0627\\u0644\\u0642\\u0627\\u062f\\u0645\\u0629\' : \'No upcoming high-impact events\'}"},')
    else:
        new_lines.append(line)

content = '\n'.join(new_lines)

with open('src/services/geminiService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("geminiService.ts fixed!")

# Verify
with open('src/services/geminiService.ts', 'r', encoding='utf-8') as f:
    verify = f.read()
import re
remaining = len(re.findall(r'[\u2550-\u256C]', verify))
print(f"Remaining corrupted chars: {remaining}")
