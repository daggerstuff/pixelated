from flask import Flask, render_template

app = Flask(__name__)

# Sample languages data - this will be moved to languages.py later
languages = [
    {"name": "Python", "creator": "Guido van Rossum", "year": 1991},
    {"name": "JavaScript", "creator": "Brendan Eich", "year": 1995},
    {"name": "Java", "creator": "James Gosling", "year": 1995},
    {"name": "C#", "creator": "Microsoft", "year": 2000},
    {"name": "Ruby", "creator": "Yukihiro Matsumoto", "year": 1995},
]

@app.route('/')
def index():
    """Homepage that displays a list of programming languages."""
    return render_template('index.html', languages=languages)

@app.route('/language/<language_name>')
def language_detail(language_name):
    """Detail page for a specific programming language."""
    # Find the language by name (case-insensitive)
    language = next(
        (lang for lang in languages if lang['name'].lower() == language_name.lower()),
        None
    )

    if language:
        return render_template('language_detail.html', language=language)
    else:
        return "Language not found", 404

if __name__ == '__main__':
    app.run(debug=True)

