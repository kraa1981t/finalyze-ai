@echo off
SET GIT=C:\Program Files\Git\cmd\git.exe
"%GIT%" add .
"%GIT%" commit -m "Fix visibility in light mode by using semantic brand colors"
"%GIT%" push origin main
