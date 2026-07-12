with open("scripts/deploy/validate_deployment.py", "r") as f:
    content = f.read()

import_block = "import asyncio\nimport logging\nimport os\nimport sys\nfrom datetime import datetime, timezone\nfrom typing import Any\n\nimport aiofiles\nimport aiohttp\nimport psutil\nimport psycopg2\nimport redis\n"
content = content.replace("import asyncio\nimport logging\nimport os\nimport sys\nfrom datetime import datetime, timezone\nfrom typing import Any\n\nimport aiofiles\nimport aiohttp\n", import_block)

with open("scripts/deploy/validate_deployment.py", "w") as f:
    f.write(content)
