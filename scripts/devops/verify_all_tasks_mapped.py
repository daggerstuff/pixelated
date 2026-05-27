import csv
import re
import json

from parse_and_map_tasks import parse_md_all_tasks

def get_mappings():
    # Base mappings from CSV
    mappings = {}
    with open('.agent/internal/plans/asana-training-pipeline-tasks.csv') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            name = row[0]
            match = re.match(r'^(?:\*|†|‡)?(\d+\.\d+)', name)
            if match:
                num = match.group(1)
                pix = re.search(r'PIX-\d+', row[1])
                if pix:
                    mappings[num] = pix.group(0)
                    
    # Checkpoints mappings
    checkpoints = {
        '5.0': 'PIX-430',
        '17.0': 'PIX-454',
        '23.0': 'PIX-464',
        '26.0': 'PIX-470',
        '29.0': 'PIX-478',
        '32.0': 'PIX-484',
        '35.0': 'PIX-487'
    }
    mappings.update(checkpoints)
    return mappings

def main():
    md_path = '.agent/internal/plans/TRAINING-PIPELINE-TASKS-2026-04-29.md'
    tasks = parse_md_all_tasks(md_path)
    mappings = get_mappings()
    
    with open("exports/current_linear_issues.json") as f:
        linear_data = json.load(f)
    linear_keys = {d['identifier'] for d in linear_data}
    
    print(f"Total tasks from MD: {len(tasks)}")
    print(f"Total mapped tasks: {len(mappings)}")
    
    missing_mapping = []
    missing_linear = []
    
    for num, t in sorted(tasks.items(), key=lambda x: [int(v) for v in x[0].split('.')]):
        if num not in mappings:
            missing_mapping.append(num)
        else:
            pix_key = mappings[num]
            if pix_key not in linear_keys:
                missing_linear.append((num, pix_key))
                
    if missing_mapping:
        print("Tasks missing a mapping:", missing_mapping)
    else:
        print("All tasks have a mapping!")
        
    if missing_linear:
        print("Mapped keys missing from Linear:", missing_linear)
    else:
        print("All mapped keys exist in Linear!")

if __name__ == "__main__":
    main()
