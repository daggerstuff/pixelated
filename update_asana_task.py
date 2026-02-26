import os
import json
import logging

try:
    from composio_langchain import App, ComposioToolSet
except ImportError:
    import sys
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "composio_langchain"])
    from composio_langchain import App, ComposioToolSet

logging.basicConfig(level=logging.INFO)

# Hardcode the task GID we found
task_gid = "1213443555571415" # "Execute Stage 1 Foundation Training"
logging.info(f"Targeting task {task_gid}")

def get_job_url():
    import subprocess
    try:
        source_cmd = "source /home/vivi/pixelated/.env && ovhai --token $OVH_AI_TOKEN job get e58847b1-79f8-48cf-b139-008b56d033e0 --output json"
        result = subprocess.check_output(source_cmd, shell=True, text=True, executable='/bin/bash')
        job_data = json.loads(result)
        return job_data.get('status', {}).get('url', 'N/A')
    except Exception as e:
        logging.error(f"Failed to get job URL: {e}")
        return "https://e58847b1-79f8-48cf-b139-008b56d033e0.job.us-east-va.ai.cloud.ovh.us"

job_url = get_job_url()

toolset = ComposioToolSet(entity_id="edge")

# 1. Add a status comment
try:
    logging.info("Adding comment to task...")
    res = toolset.execute_action(
        action="ASANA_ADD_COMMENT_TO_TASK",
        params={
            "task_gid": task_gid,
            "text": f"Job submitted and properly configured to resume from step 2500.\n4x L40S GPU allocated.\nJob URL: {job_url}\nMonitoring script actively hooked."
        }
    )
    logging.info(f"Comment result: {res}")
except Exception as e:
    logging.error(f"Failed to add comment: {e}")

# 2. Update the status enum (Find the In Progress option)
try:
    logging.info("Updating task custom fields (Status -> In Progress)...")
    res = toolset.execute_action(
        action="ASANA_UPDATE_A_TASK",
        params={
            "task_gid": task_gid,
            "custom_fields": {
                "1213432372019772": "1213432372019774" # Status -> In Progress (yellow)
            }
        }
    )
    logging.info(f"Update result: {res}")
except Exception as e:
    logging.error(f"Failed to update status: {e}")

