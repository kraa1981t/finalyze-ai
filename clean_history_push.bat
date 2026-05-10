@echo off
SET GIT=C:\Program Files\Git\cmd\git.exe

echo [1] Rewriting entire commit history to remove secrets...
"%GIT%" filter-branch --force --index-filter ""%GIT%" rm --cached --ignore-unmatch create_repo.ps1 push_to_github.bat force_push.bat push_clean.bat" --prune-empty --tag-name-filter cat -- --all

echo [2] Force pushing clean history to GitHub...
"%GIT%" push --force "https://kraa1981t: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@github.com/kraa1981t/finalyze-ai.git" main

echo.
if %ERRORLEVEL%==0 (
    echo ========================================
    echo SUCCESS! Code is live on GitHub:
    echo https://github.com/kraa1981t/finalyze-ai
    echo ========================================
) else (
    echo PUSH FAILED - check output above
)
