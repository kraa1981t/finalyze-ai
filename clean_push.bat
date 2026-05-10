@echo off
SET GIT=C:\Program Files\Git\cmd\git.exe
echo Removing cached secrets...
"%GIT%" rm --cached push_fix.bat 2>nul
"%GIT%" add .gitignore
"%GIT%" commit -m "Cleanup secret scripts"
echo Pushing...
"%GIT%" push "https://kraa1981t:%1@github.com/kraa1981t/finalyze-ai.git" main
