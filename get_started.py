import logging

import modal

app = modal.App("example-get-started")


@app.function()
def square(x):
    logging.info("This code is running on a remote worker!")
    return x**2


@app.local_entrypoint()
def main():
    logging.info("the square is %s", square.remote(42))
