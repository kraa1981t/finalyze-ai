@echo off
SET GIT="C:\Program Files\Git\bin\git.exe"
SET TOKEN=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
SET REPO_URL=https://kraa1981t:%TOKEN%@github.com/kraa1981t/finalyze-ai.git

echo [1/5] Initializing Git...
%GIT% init

echo [2/5] Setting Git identity...
%GIT% config user.email "albertaparks1t@gmail.com"
%GIT% config user.name "kraa1981t"

echo [3/5] Adding all files...
%GIT% add .

echo [4/5] Committing...
%GIT% commit -m "Initial deploy: Finalyze AI - Advanced Trading Analysis Platform"

echo [5/5] Pushing to GitHub...
%GIT% branch -M main
%GIT% remote add origin %REPO_URL%
%GIT% push -u origin main

echo.
echo === DONE! ===
echo Your code is live at: https://github.com/kraa1981t/finalyze-ai
