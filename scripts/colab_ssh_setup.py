#!/usr/bin/env python3
"""
Colab SSH Tunnel Setup Helper

Run this script to get the code to paste into Colab,
then connect from this machine.
"""


def print_colab_setup():
    print("=" * 70)
    print("PASTE THIS CELL INTO YOUR COLAB NOTEBOOK")
    print("=" * 70)
    print()
    print("""# ============================================================
# COLAB SSH TUNNEL SETUP
# ============================================================

!pip install colab-ssh -q

from colab_ssh import launch_ssh_cloudflared
import getpass

print("\\n" + "="*60)
print("SSH TUNNEL SETUP")
print("="*60)
password = getpass.getpass("Set SSH password: ")
print("\\n")

# Launch SSH tunnel
launch_ssh_cloudflared(password=password)

print("\\n" + "="*60)
print("COPY THE SSH COMMAND ABOVE")
print("="*60)
""")
    print()
    print("=" * 70)
    print("STEPS:")
    print("=" * 70)
    print("1. Open your Colab notebook")
    print("2. Add a new code cell and paste the code above")
    print("3. Run the cell")
    print("4. Enter a password when prompted")
    print("5. Copy the SSH command Colab outputs")
    print("6. Paste it in your terminal HERE to connect")
    print()
    print("=" * 70)
    print("AFTER CONNECTING - Start training in tmux:")
    print("=" * 70)
    print("""
    # Install tmux (inside Colab via SSH)
    apt-get update && apt-get install -y tmux

    # Create a session
    tmux new -s train

    # Run your training
    python train.py

    # Detach: Ctrl+B then D
    # Reattach: tmux attach -t train
""")
    print("=" * 70)
    print("CLOUDFLARED LOCATION: ~/.local/bin/cloudflared")
    print("=" * 70)


if __name__ == "__main__":
    print_colab_setup()
