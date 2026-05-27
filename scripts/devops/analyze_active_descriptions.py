import json
import re

def main():
    with open("exports/current_linear_issues.json") as f:
        issues = json.load(f)
        
    active_statuses = {'Todo', 'In Progress', 'Triage', 'Backlog'}
    active = [i for i in issues if (i.get('state') or {}).get('name') in active_statuses]
    
    print(f"Total active issues: {len(active)}")
    
    mismatches = []
    boilerplates = []
    placeholders = []
    others = []
    
    for i in active:
        title = i.get('title') or ''
        desc = i.get('description') or ''
        
        # Check if description has boilerplate like ***X.X ...***
        match = re.search(r'\*\*\*(?:‡|†)?(\d+\.\d+.*?)\*\*\*', desc)
        if match:
            bp_task = match.group(1)
            boilerplates.append((title, bp_task, i.get('id')))
            # Check if title matches bp_task or if they are mismatched
            # Clean title and bp_task for comparison
            t_clean = re.sub(r'[^a-zA-Z0-9]', '', title).lower()
            bp_clean = re.sub(r'[^a-zA-Z0-9]', '', bp_task).lower()
            # If the task number or name isn't in the title
            if bp_clean not in t_clean and t_clean not in bp_clean:
                mismatches.append((title, bp_task, i.get('id')))
        elif 'Source plan:' in desc:
            placeholders.append((title, desc.split('Source plan:')[1].split('\n')[0].strip(), i.get('id')))
        else:
            others.append((title, desc[:100], i.get('id')))
            
    print(f"Total boilerplates: {len(boilerplates)}")
    print(f"Mismatches: {len(mismatches)}")
    print(f"Source plan placeholders: {len(placeholders)}")
    print(f"Others: {len(others)}")
    
    print("\n--- Example Mismatches (First 10) ---")
    for title, bp, _id in mismatches[:10]:
        print(f"Title: {title} | Boilerplate refers to: {bp}")
        
    print("\n--- Example Placeholders (First 10) ---")
    for title, sp, _id in placeholders[:10]:
        print(f"Title: {title} | Source plan: {sp}")

if __name__ == "__main__":
    main()
