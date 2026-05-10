@echo off
SET GIT=C:\Program Files\Git\cmd\git.exe
SET TOKEN=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
SET REPO_URL=https://kraa1981t:%TOKEN%@github.com/kraa1981t/finalyze-ai.git

echo [1/3] Adding changes...
"%GIT%" add .

echo [2/3] Committing fixes...
"%GIT%" commit -m "Fix visibility in light mode by using semantic brand colors"

echo [3/3] Pushing to GitHub...
"%GIT%" push %REPO_URL% main

echo DONE!
