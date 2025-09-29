import sys
import os
import traceback

# Ensure we run from the repository root so that package imports resolve
# correctly. Put the repo root first on sys.path to avoid the script's
# directory shadowing package resolution.
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(repo_root)
sys.path[0] = repo_root

print('CWD:', os.getcwd())
print('PYTHONPATH env:', os.environ.get('PYTHONPATH'))
print('\nsys.path entries:')
for i, p in enumerate(sys.path[:20]):
    print(i, p)


def try_import(name):
    try:
        mod = __import__(name, fromlist=['*'])
        print(f"Imported {name} ->", getattr(mod, '__file__', None))
    except Exception:
        print(f"Failed to import {name}:")
        traceback.print_exc()


try_import('services')
try_import('services.integration_manager')
try_import('mcp_server.services')
try_import('mcp_server.services.integration_manager')

print('\nDone')
