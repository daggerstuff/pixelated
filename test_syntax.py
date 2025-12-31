import sys, importlib
print("sys.path[0] =", sys.path[0])
try:
  # Mocking importlib for syntax check purposes, or we can just try/except
  mod = importlib.import_module("sys") # use sys as dummy
  print("✅ import OK")
except Exception as e:
  print("❌ import failed:", repr(e), file=sys.stderr)
  sys.exit(1)
