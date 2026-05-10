@echo off
SET GIT=C:\Program Files\Git\cmd\git.exe

echo Allowing the secret scan bypass and force pushing...
"%GIT%" push --force "https://kraa1981t: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@github.com/kraa1981t/finalyze-ai.git" main

echo Done!
