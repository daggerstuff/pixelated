import os
from flask import Flask, render_template
from typing import Any

app = Flask(__name__)

# Sample languages data - this will be moved to languages.py later
languages: list[dict[str, Any]] = [
    {"name": "Python", "creator": "Guido van Rossum", "year": 1991},
    {"name": "JavaScript", "creator": "Brendan Eich", "year": 1995},
    {"name": "Java", "creator": "James Gosling", "year": 1995},
    {"name": "C#", "creator": "Microsoft", "year": 2000},
    {"name": "Ruby", "creator": "Yukihiro Matsumoto", "year": 1995},
]

@app.route("/")
def index() -> str:
    """Homepage that displays a list of programming languages."""
    return render_template("index.html", languages=languages)

@app.route("/language/<language_name>")
def language_detail(language_name: str) -> str | tuple[str, int]:
    """Detail page for a specific programming language.

    Args:
        language_name: Name of the programming language (case-insensitive)

    Returns:
        Rendered template if language found, or error message with 404 status
    """
    if not language_name or not language_name.strip():
        return "Language name is required", 400

    # Find the language by name (case-insensitive)
    language: dict[str, Any] | None = next(
        (lang for lang in languages if lang["name"].lower() == language_name.lower()),
        None,
    )

    if language:
        return render_template("language_detail.html", language=language)
    return "Language not found", 404

if __name__ == "__main__":
    # WARNING: debug=True should NEVER be used in production
    # as it exposes sensitive information through the debugger
    # Use environment variable for debug flag (defaults to False)
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(debug=debug_mode)
