## update and install some things we should probably have
apt-get update
apt-get install -y \
	curl \
	git \
	gnupg2 \
	jq \
	sudo \
	zsh \
	build-essential \
	libssl-dev \
	libffi-dev \
	python3-dev

# set-up and install fnm (Fast Node Manager)
curl -fsSL https://fnm.vercel.app/install | bash
export PATH="/root/.local/share/fnm:${PATH}"
eval "$(fnm env --use-on-cd)"
fnm install 22
fnm use 22
fnm default 22

# set-up and install pnpm
npm i -g npm
npm i -g pnpm
pnpm setup

# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="/root/.cargo/bin:${PATH}"

# Install Python 3.11 via uv
/root/.cargo/bin/uv python install 3.11

# setup and install oh-my-zsh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"
cp -R /root/.oh-my-zsh /home/"${USERNAME}"
cp /root/.zshrc /home/"${USERNAME}"
sed -i -e "s/\/root\/.oh-my-zsh/\/home\/${USERNAME}\/.oh-my-zsh/g" /home/"${USERNAME}"/.zshrc

# Add uv and cargo to user's zshrc
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> /home/"${USERNAME}"/.zshrc

chown -R "${USER_UID}":"${USER_GID}" /home/"${USERNAME}"/.oh-my-zsh /home/"${USERNAME}"/.zshrc
