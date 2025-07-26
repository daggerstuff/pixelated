#!/bin/bash
# Azure CLI Diagnostics and Solutions Script
# Comprehensive diagnosis and automated fixes for Azure CLI issues

echo "🔍 Azure CLI Diagnostics & Solutions"
echo "===================================="
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Working Directory: $(pwd)"
echo ""

# Function to check command availability
check_command() {
	local cmd=$1
	local name=$2
	if command -v "$cmd" >/dev/null 2>&1; then
		echo "✅ $name: Available at $(which $cmd)"
		return 0
	else
		echo "❌ $name: Not available"
		return 1
	fi
}

# Function to test Azure CLI functionality
test_azure_cli() {
	local az_path=$1
	if [ -f "$az_path" ] && [ -x "$az_path" ]; then
		if $az_path version >/dev/null 2>&1; then
			local version=$($az_path version --output tsv --query '"azureCli"' 2>/dev/null || echo 'unknown')
			echo "✅ Functional Azure CLI at $az_path (version: $version)"
			return 0
		else
			echo "❌ Non-functional Azure CLI at $az_path"
			return 1
		fi
	fi
	return 1
}

echo "🔍 System Information"
echo "--------------------"
echo "OS: $(uname -s) $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Home: $HOME"
echo "PATH: $PATH"
echo ""

echo "🔍 Environment Detection"
echo "-----------------------"
if [ -n "$AGENT_NAME" ]; then
	echo "✅ Azure DevOps Agent: $AGENT_NAME"
	echo "Agent OS: ${AGENT_OS:-Unknown}"

	if [[ $AGENT_NAME == *"Hosted Agent"* ]]; then
		echo "🏗️ Microsoft-hosted agent detected"
		AGENT_TYPE="microsoft-hosted"
	else
		echo "🔧 Self-hosted agent detected"
		AGENT_TYPE="self-hosted"
	fi
else
	echo "❌ Not running in Azure DevOps"
	AGENT_TYPE="local"
fi
echo ""

echo "🔍 Available Tools"
echo "-----------------"
check_command python3 "Python 3"
check_command pip3 "Pip3"
check_command uv "UV"
check_command pipx "Pipx"
check_command conda "Conda"
check_command docker "Docker"
check_command curl "Curl"
echo ""

echo "🔍 Azure CLI Detection"
echo "---------------------"
AZURE_CLI_FOUND=false

# Check common paths
AZURE_CLI_PATHS=(
	"/usr/bin/az"
	"/usr/local/bin/az"
	"/opt/az/bin/az"
	"/snap/bin/az"
	"$HOME/.local/bin/az"
)

for az_path in "${AZURE_CLI_PATHS[@]}"; do
	if test_azure_cli "$az_path"; then
		AZURE_CLI_FOUND=true
		WORKING_AZURE_CLI="$az_path"
		break
	fi
done

# Check PATH
if command -v az >/dev/null 2>&1; then
	if test_azure_cli "$(which az)"; then
		AZURE_CLI_FOUND=true
		WORKING_AZURE_CLI="$(which az)"
	fi
fi

if $AZURE_CLI_FOUND; then
	echo "🎉 Working Azure CLI found: $WORKING_AZURE_CLI"

	# Set pipeline variables if in Azure DevOps
	if [ -n "$AGENT_NAME" ]; then
		echo "##vso[task.setvariable variable=azCliInstalled]true"
		echo "##vso[task.setvariable variable=azCliPath]$(dirname $WORKING_AZURE_CLI)"
	fi

	exit 0
else
	echo "❌ No working Azure CLI found"
fi
echo ""

echo "🔧 Automated Solutions"
echo "======================"

# Solution 1: Try conda installation (common in Azure DevOps)
if check_command conda "Conda" >/dev/null 2>&1; then
	echo "🔄 Solution 1: Installing via Conda..."

	# Activate conda if available
	if [ -f "/home/vivi/miniconda3/etc/profile.d/conda.sh" ]; then
		source /home/vivi/miniconda3/etc/profile.d/conda.sh
		conda activate base 2>/dev/null || true
	fi

	if conda install -c conda-forge azure-cli -y; then
		echo "✅ Azure CLI installed via conda"
		if test_azure_cli "$(which az)"; then
			echo "🎉 Solution 1 successful!"
			exit 0
		fi
	fi
fi

# Solution 2: Try pipx installation
if check_command pipx "Pipx" >/dev/null 2>&1; then
	echo "🔄 Solution 2: Installing via Pipx..."

	if pipx install azure-cli; then
		export PATH="$HOME/.local/bin:$PATH"
		echo "✅ Azure CLI installed via pipx"
		if test_azure_cli "$HOME/.local/bin/az"; then
			echo "🎉 Solution 2 successful!"
			exit 0
		fi
	fi
fi

# Solution 3: Try virtual environment
if check_command python3 "Python3" >/dev/null 2>&1; then
	echo "🔄 Solution 3: Installing via Virtual Environment..."

	mkdir -p ~/.local/lib
	if python3 -m venv ~/.local/lib/azure-cli-venv; then
		if ~/.local/lib/azure-cli-venv/bin/pip install azure-cli; then
			# Create wrapper
			mkdir -p ~/.local/bin
			cat >~/.local/bin/az <<'EOF'
#!/bin/bash
exec ~/.local/lib/azure-cli-venv/bin/az "$@"
EOF
			chmod +x ~/.local/bin/az

			echo "✅ Azure CLI installed via virtual environment"
			if test_azure_cli "$HOME/.local/bin/az"; then
				echo "🎉 Solution 3 successful!"
				exit 0
			fi
		fi
	fi
fi

# Solution 4: Try Docker wrapper
if check_command docker "Docker" >/dev/null 2>&1; then
	echo "🔄 Solution 4: Setting up Docker wrapper..."

	mkdir -p ~/.local/bin
	cat >~/.local/bin/az <<'EOF'
#!/bin/bash
docker run --rm -v $(pwd):/workspace -v $HOME/.azure:/root/.azure -w /workspace mcr.microsoft.com/azure-cli:latest az "$@"
EOF
	chmod +x ~/.local/bin/az

	echo "✅ Azure CLI Docker wrapper created"
	if ~/.local/bin/az version >/dev/null 2>&1; then
		echo "🎉 Solution 4 successful!"
		exit 0
	fi
fi

echo ""
echo "❌ All automated solutions failed"
echo ""
echo "💡 Manual Solutions"
echo "==================="

case $AGENT_TYPE in
"microsoft-hosted")
	echo "🏗️ Microsoft-hosted agent recommendations:"
	echo "1. Azure CLI should be pre-installed - this is unexpected"
	echo "2. Use AzureCLI@2 task instead of script task"
	echo "3. Report this issue to Microsoft"
	;;
"self-hosted")
	echo "🔧 Self-hosted agent recommendations:"
	echo "1. Pre-install Azure CLI: sudo apt-get install azure-cli"
	echo "2. Use Docker: docker run mcr.microsoft.com/azure-cli:latest"
	echo "3. Install in agent setup script with sudo privileges"
	;;
"local")
	echo "💻 Local development recommendations:"
	echo "1. Install via package manager: sudo apt-get install azure-cli"
	echo "2. Use official installer: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
	echo "3. Use Docker: docker run mcr.microsoft.com/azure-cli:latest"
	;;
esac

echo ""
echo "🔗 Additional Resources:"
echo "- Azure CLI Installation Guide: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
echo "- Azure DevOps Tasks: https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/deploy/azure-cli"
echo "- Docker Image: https://hub.docker.com/_/microsoft-azure-cli"

exit 1
