"""Compatibility shim package.

Some tests import `services.integration_manager`. In the installed package layout
the services package lives under `mcp_server.services`. This shim re-exports
the submodules so tests that run with the repository root on PYTHONPATH will
find the modules.
"""

import importlib.util
import os
import sys
from importlib import import_module


def _load_submodule(name: str):
    # Prefer importing the module as part of the real package so that
    # relative imports inside the service modules (which expect
    # `mcp_server.services` as their package) resolve correctly.
    full = f"mcp_server.services.{name}"
    try:
        module = import_module(full)
    except Exception:
        # Fallback: load directly from the file system into the mcp_server
        # package name to preserve relative import behavior.
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        candidate = os.path.join(repo_root, "mcp_server", "services", f"{name}.py")
        if os.path.exists(candidate):
            mod_name = full
            if mod_name in sys.modules:
                return sys.modules[mod_name]
            spec = importlib.util.spec_from_file_location(mod_name, candidate)
            module = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = module
            spec.loader.exec_module(module)
        else:
            raise

    # Also expose the module under the short `services.<name>` name for
    # compatibility so imports like `import services.integration_manager`
    # still work.
    short_name = f"services.{name}"
    if short_name not in sys.modules:
        sys.modules[short_name] = module

    return module


def __getattr__(name: str):
    # Provide lazy access to known submodules: integration_manager, flask_integration, websocket_manager, etc.
    try:
        mod = _load_submodule(name)
        setattr(sys.modules[__name__], name, mod)
        return mod
    except Exception:
        raise AttributeError(f"module 'services' has no attribute '{name}'")


def __dir__():
    return list(globals().keys()) + ["integration_manager", "flask_integration", "websocket_manager"]


# Ensure Python's regular import machinery can find submodules under
# mcp_server/services when tests do `import services.foo`.
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
services_pkg_path = os.path.join(repo_root, "mcp_server", "services")
if services_pkg_path not in __path__:
    __path__.append(services_pkg_path)
