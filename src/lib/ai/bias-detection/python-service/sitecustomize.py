import os
import sys
import warnings


if "pytest" in os.path.basename(sys.argv[0]):
    warnings.filterwarnings("ignore", message=r"\s*Eventlet is deprecated.*", category=Warning)
    try:
        from langchain_core._api.deprecation import LangChainPendingDeprecationWarning
    except Exception:
        warnings.filterwarnings(
            "ignore",
            message=r"The default value of `allowed_objects` will change in a future version.*",
            category=Warning,
        )
    else:
        warnings.filterwarnings(
            "ignore",
            message=r"The default value of `allowed_objects` will change in a future version.*",
            category=LangChainPendingDeprecationWarning,
        )
