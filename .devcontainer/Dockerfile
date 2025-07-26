FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

HEALTHCHECK CMD ["true"]

WORKDIR /home/

COPY . .

RUN bash ./setup.sh

RUN echo 'export NVM_DIR="$HOME/.nvm"' >> "$HOME/.zshrc"
RUN echo '\n' >> "$HOME/.zshrc"
RUN echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm' >> "$HOME/.zshrc"

# Install uv (Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Add uv to PATH
ENV PATH="/root/.cargo/bin:$PATH"

# Install Python 3.11 via uv
RUN /root/.cargo/bin/uv python install 3.11

# Set up uv in shell profiles
RUN echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> "$HOME/.zshrc"
RUN echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> "$HOME/.bashrc"

# Set permissions for cargo directory
RUN chown -R vscode:vscode /root/.cargo || true
