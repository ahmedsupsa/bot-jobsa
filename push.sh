#!/bin/bash
git config user.name "ahmedsupsa"
git config user.email "239878168+ahmedsupsa@users.noreply.github.com"
git add .
MSG="${1:-update}"
git commit -m "$MSG" 2>/dev/null || echo "لا يوجد تغييرات جديدة"
git push origin main
