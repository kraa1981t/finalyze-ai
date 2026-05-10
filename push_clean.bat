@echo off
SET GIT="C:\Program Files\Git\bin\git.exe"

echo Removing temp scripts from tracking...
%GIT% rm --cached create_repo.ps1 push_to_github.bat 2>nul

echo Adding safe gitignore...
echo create_repo.ps1 >> .gitignore
echo push_to_github.bat >> .gitignore

echo Committing clean state...
%GIT% add .gitignore
%GIT% commit -m "Remove scripts with secrets from tracking"

echo Pushing clean commit...
%GIT% push -u origin main

echo.
echo === PUSH COMPLETE ===
