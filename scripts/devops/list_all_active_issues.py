import json
import re

def main():
    with open("exports/current_linear_issues.json") as f:
        issues = json.load(f)
        
    active_statuses = {'Todo', 'In Progress', 'Triage', 'Backlog'}
    active = [i for i in issues if (i.get('state') or {}).get('name') in active_statuses]
    
    print(f"Total active issues: {len(active)}")
    
    # Sort active issues by project and key
    active_sorted = sorted(active, key=lambda x: (x.get('project', {}).get('name') or 'No Project', x.get('identifier', '')))
    
    out_lines = []
    for i in active_sorted:
        title = i.get('title') or ''
        identifier = i.get('identifier') or ''
        state = i.get('state', {}).get('name') or ''
        project = i.get('project', {}).get('name') or 'No Project'
        desc = i.get('description') or ''
        
        # Get sync metadata if any
        sync_block = re.search(r'<!-- pixelated-sync(.*?)-->', desc, re.DOTALL)
        meta_str = ""
        if sync_block:
            meta_str = " | Sync: " + ", ".join(
                [line.strip() for line in sync_block.group(1).split('\n') if ':' in line][:3]
            ).replace(chr(92), '')
            
        out_lines.append(f"{identifier} [{project}] ({state}): {title}{meta_str}")
        desc_preview = desc[:150].replace('\n', ' ')
        out_lines.append(f"  Description: {desc_preview}...")
        out_lines.append("")
        
    with open("exports/active_issues_list.txt", "w") as f:
        f.write("\n".join(out_lines))
        
    print("Saved active issues list to exports/active_issues_list.txt")

if __name__ == "__main__":
    main()
