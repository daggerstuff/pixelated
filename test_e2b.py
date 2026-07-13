from e2b import Sandbox


def test_notebook():
    try:
        print("Starting E2B Sandbox...")
        with Sandbox.create() as sandbox:
            print("Sandbox started.")

            # Read notebook content
            with open("ai/training/ready_packages/platforms/amd_rocm/amd_unsloth_finetuning.ipynb", "rb") as f:
                content = f.read()

            # Upload to sandbox
            sandbox.files.write("/home/user/amd_unsloth_finetuning.ipynb", content)

            # Install jupyter
            print("Installing dependencies...")
            proc = sandbox.commands.run("pip install jupyter nbconvert nbformat")

            # Execute notebook
            print("Executing notebook...")
            result = sandbox.commands.run(
                "jupyter nbconvert --to notebook --execute /home/user/amd_unsloth_finetuning.ipynb"
            )

            print(f"Exit code: {result.exit_code}")
            print(f"Stdout:\n{result.stdout}")
            if result.stderr:
                print(f"Stderr:\n{result.stderr}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_notebook()
