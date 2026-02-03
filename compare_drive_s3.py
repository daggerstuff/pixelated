import os
import re

from rich.console import Console
from rich.table import Table

console = Console()


def parse_inventory(filename):
    inventory = []
    if not os.path.exists(filename):
        return inventory
    with open(filename, encoding="utf-8") as f:
        for line_raw in f:
            line = line_raw.strip()
            if not line:
                continue
            # rclone ls format: size path
            match = re.match(r"^\s*(\d+)\s+(.+)$", line)
            if match:
                size = int(match.group(1))
                path = match.group(2)
                filename_only = os.path.basename(path)
                inventory.append({"size": size, "path": path, "filename": filename_only})
    return inventory


def compare():
    console.print("[bold blue]Loading inventories...[/bold blue]")
    s3_inv = parse_inventory("s3_inventory.txt")
    gdrive_datasets = parse_inventory("gdrive_datasets_inventory.txt")
    gdrive_books = parse_inventory("gdrive_books_inventory.txt")
    gdrive_all_books = parse_inventory("gdrive_all_books_inventory.txt")
    gdrive_youtube = parse_inventory("gdrive_youtube_inventory.txt")
    gdrive_processed = parse_inventory("gdrive_processed_inventory.txt")

    # Create a lookup for S3 by (filename, size) and also just by filename
    s3_lookup_full = {(item["filename"], item["size"]) for item in s3_inv}
    s3_filenames = {item["filename"] for item in s3_inv}

    def check_missing(source_inv, source_name):
        missing = []
        for item in source_inv:
            # First try exact match (filename and size)
            if (item["filename"], item["size"]) not in s3_lookup_full:
                # If not found, check if filename exists at all
                if item["filename"] not in s3_filenames:
                    missing.append(item)
                else:
                    # Filename exists but size differs
                    item["status"] = "size_mismatch"
                    missing.append(item)

        if missing:
            console.print(f"\n[bold yellow]--- Missing from {source_name} ---[/bold yellow]")
            for item in missing:
                status = item.get("status", "not_found")
                color = "red" if status == "not_found" else "orange3"
                console.print(
                    f"[[{color}]{status}[/{color}]] {item['path']} ({item['size']} bytes)"
                )
        else:
            console.print(
                f"\n[bold green]--- {source_name}: All files found on S3! ---[/bold green]"
            )
        return missing

    console.print("\n[bold cyan]Starting comparison...[/bold cyan]")
    results = {}
    results["datasets"] = check_missing(gdrive_datasets, "GDrive Datasets")
    results["books_folder"] = check_missing(gdrive_books, "GDrive Books Folder")
    results["all_books"] = check_missing(gdrive_all_books, "All GDrive PDF/EPUB")
    results["youtube"] = check_missing(gdrive_youtube, "GDrive YouTube Transcriptions")
    results["processed"] = check_missing(gdrive_processed, "GDrive Processed Folder")

    # Summary
    console.print("\n")
    table = Table(title="Comparison Summary", show_header=True, header_style="bold magenta")
    table.add_column("Category", style="dim", width=30)
    table.add_column("Missing Files", justify="right")

    for key, missing in results.items():
        count = len(missing)
        style = "red" if count > 0 else "green"
        table.add_row(key, f"[{style}]{count}[/{style}]")

    console.print(table)


if __name__ == "__main__":
    compare()
