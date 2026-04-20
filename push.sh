#!/bin/bash
git config user.name "ahmedsupsa"
git config user.email "239878168+ahmedsupsa@users.noreply.github.com"
git add .
MSG="${1:-update}"
git commit --allow-empty -m "$MSG"
git push origin main
