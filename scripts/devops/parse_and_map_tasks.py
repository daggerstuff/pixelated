import re

def parse_md_all_tasks(md_path):
    with open(md_path, 'r') as f:
        content = f.read()
        
    # We will split by headers to process sections, but we also want to extract all tasks
    # (e.g. 1.0, 1.1, 1.2, 1.3, 2.0, 2.1 etc.)
    # Let's read line by line and keep track of state.
    lines = content.splitlines()
    tasks = {}
    current_parent_num = None
    current_parent_name = ""
    current_parent_lines = []
    
    # We want to match:
    # 1. Parent task headers: '### 1.0 Create shared training infrastructure' or '### *27.0 Implement GRPO trainer and reward function'
    # 2. Subtask lines: '- [ ] 1.1 Property test — token length stats correctness (Prop 6)'
    
    current_task_num = None
    current_task_name = ""
    current_task_lines = []
    
    for line in lines:
        # Check for header
        header_match = re.match(r'^###\s+(?:\*|†|‡)?(\d+\.\d+)\s+(.*)', line)
        if header_match:
            # Save previous task if any
            if current_task_num:
                tasks[current_task_num] = {
                    'num': current_task_num,
                    'name': current_task_name,
                    'body': '\n'.join(current_task_lines).strip()
                }
            
            current_parent_num = header_match.group(1)
            current_parent_name = header_match.group(2).strip()
            current_task_num = current_parent_num
            current_task_name = current_parent_name
            current_task_lines = []
            continue
            
        # Check for subtask line
        subtask_match = re.match(r'^\s*-\s*\[\s*\]\s+(?:\*|†|‡)?(\d+\.\d+)\s+(.*)', line)
        if subtask_match:
            # Save previous task
            if current_task_num:
                tasks[current_task_num] = {
                    'num': current_task_num,
                    'name': current_task_name,
                    'body': '\n'.join(current_task_lines).strip()
                }
            current_task_num = subtask_match.group(1)
            current_task_name = subtask_match.group(2).strip()
            current_task_lines = []
            continue
            
        # If we have a current task, append line to it
        if current_task_num:
            # If the line starts with '---' or '## ', it ends the section
            if line.strip() == '---' or line.strip().startswith('## '):
                # Save and reset
                tasks[current_task_num] = {
                    'num': current_task_num,
                    'name': current_task_name,
                    'body': '\n'.join(current_task_lines).strip()
                }
                current_task_num = None
            else:
                current_task_lines.append(line)
                
    # Save last task
    if current_task_num:
        tasks[current_task_num] = {
            'num': current_task_num,
            'name': current_task_name,
            'body': '\n'.join(current_task_lines).strip()
        }
        
    return tasks

def main():
    md_path = '.agent/internal/plans/TRAINING-PIPELINE-TASKS-2026-04-29.md'
    tasks = parse_md_all_tasks(md_path)
    print(f"Parsed {len(tasks)} tasks (parents + subtasks) from Markdown:")
    for num in sorted(tasks.keys(), key=lambda x: [int(v) for v in x.split('.')]):
        t = tasks[num]
        print(f"  {num}: {t['name']} (body lines: {len(t['body'].splitlines())})")

if __name__ == "__main__":
    main()
