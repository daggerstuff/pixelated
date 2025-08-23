# GitLab Runner Docker Configuration Fix

## Problem
Your GitLab runner is using a shell executor without Docker installed, causing pipeline failures.

## Solution 1: Install Docker on Shell Executor

SSH into your GitLab runner machine and install Docker:

```bash
# Update system
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add gitlab-runner user to docker group
sudo usermod -aG docker gitlab-runner

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Test Docker access
sudo -u gitlab-runner docker --version
```

## Solution 2: Reconfigure Runner to Use Docker Executor

Edit your runner configuration (`/etc/gitlab-runner/config.toml`):

```toml
[[runners]]
  name = "twostep"
  url = "https://git.pixelatedempathy.tech/"
  token = "your-token"
  executor = "docker"
  [runners.docker]
    image = "docker:24.0.5"
    privileged = true
    volumes = ["/var/run/docker.sock:/var/run/docker.sock", "/cache"]
    pull_policy = "if-not-present"
```

Then restart the runner:
```bash
sudo gitlab-runner restart
```

## Solution 3: Use GitLab.com Shared Runners

If you're using GitLab.com, enable shared runners in your project settings:
- Go to Settings > CI/CD > Runners
- Enable shared runners
- Disable your problematic runner temporarily

## Verification

After applying any solution, test with this simple pipeline:

```yaml
test-docker:
  image: docker:24.0.5
  services:
    - docker:24.0.5-dind
  script:
    - docker --version
    - docker run hello-world
```