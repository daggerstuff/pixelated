def configure(*args, **kwargs):
    pass


def info(*args, **kwargs):
    print(*args)


def error(*args, **kwargs):
    print(*args)


def done(*args, **kwargs):
    print(*args)


_stdout_console = Console()


def get_settings():
    return {}


def result_block(title, body):
    _stdout_console.rule(title)
    _stdout_console.print(body)


def print_json(data):
    _stdout_console.print_json(data=data)


def print_table(columns, rows, **kwargs):
    table = RichTable(*columns, **kwargs)
    for row in rows:
        table.add_row(*row)
    _stdout_console.print(table)


def warn(*args, **kwargs):
    _stdout_console.print("[yellow]Warning:[/yellow]", *args)
