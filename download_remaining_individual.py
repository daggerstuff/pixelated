#!/usr/bin/env python3

import gdown
from pathlib import Path

# File IDs extracted from error messages of failed folders
remaining_files = [
    "1iTIB-Zk6nRcF2YzZrecnmdKhBTr_xpyV",  # Priority 2
    "1vPMmAm0OqyQfU5Ftxk8chJPwzYIfTRBD",  # Priority 3  
    "1wAxP3FHxZeIbkW4h9CTFT80IoOb6s7aJ",  # Priority 4
    "1tmSv0JSP9hKMlRwML9Vce-yUOvgfLVkX",  # Secondary (partial)
]

def download_files():
    download_dir = Path("downloads/remaining_individual")
    download_dir.mkdir(exist_ok=True, parents=True)
    
    successful = []
    failed = []
    
    for i, file_id in enumerate(remaining_files, 1):
        print(f"[{i}/{len(remaining_files)}] Downloading: {file_id}")
        
        try:
            url = f"https://drive.google.com/uc?id={file_id}"
            output_path = download_dir / f"file_{file_id}"
            
            gdown.download(url, str(output_path), quiet=False)
            successful.append(file_id)
            print(f"✓ Success: {file_id}")
            
        except Exception as e:
            failed.append((file_id, str(e)))
            print(f"✗ Failed: {file_id} - {e}")
    
    print(f"\nSuccessful: {len(successful)}")
    print(f"Failed: {len(failed)}")

if __name__ == "__main__":
    download_files()
