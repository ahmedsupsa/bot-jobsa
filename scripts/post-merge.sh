#!/bin/bash
set -e

if [ -f admin_frontend/package.json ]; then
  cd admin_frontend
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
  cd ..
fi

if [ -f worker/requirements.txt ]; then
  pip install -q -r worker/requirements.txt || true
fi
