import json
import subprocess

# Get kubeconfig
try:
    kubeconfig = subprocess.check_output(
        ["az", "aks", "get-credentials", "--resource-group", "pixelated-azure-resources", "--name", "pixelated-aks-cluster", "--file", "-"],
        encoding='utf-8'
    )
except subprocess.CalledProcessError as e:
    print(f"Error fetching kubeconfig: {e}")
    exit(1)

# Create JSON structure
data = {
    "name": "pixelated-aks-connection",
    "type": "kubernetes",
    "url": "https://pixelated--pixelated-azure--b12579-742dv07a.hcp.eastus.azmk8s.io:443",
    "authorization": {
        "scheme": "Kubernetes",
        "parameters": {
            "kubeconfig": kubeconfig
        }
    }
}

# Write to file
with open("filled-k8s-connection.json", "w") as f:
    json.dump(data, f, indent=2)

print("Successfully created filled-k8s-connection.json")

