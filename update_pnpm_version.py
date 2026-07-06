def main():
    log_file = "/home/vivi/.gemini/antigravity-cli/brain/abc5c9f8-86cf-4cc2-8476-488b6c78043a/.system_generated/tasks/task-21.log"
    with open(log_file) as f:
        lines = f.readlines()

    for line in lines:
        filepath = line.strip()
        if not filepath.startswith("/home/vivi"):
            continue

        try:
            with open(filepath, encoding="utf-8") as f:
                content = f.read()

            if "11.9.0" in content:
                new_content = content.replace("11.9.0", "11.10.0")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
        except Exception as e:
            print(f"Failed to update {filepath}: {e}")


if __name__ == "__main__":
    main()
