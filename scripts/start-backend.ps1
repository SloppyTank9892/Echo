Set-Location $PSScriptRoot\..\backend
if (-not (Test-Path .venv)) {
  python -m venv .venv
  .\.venv\Scripts\pip install -r requirements.txt
}
.\.venv\Scripts\uvicorn main:app --reload --host 127.0.0.1 --port 8000
