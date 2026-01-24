#!/bin/bash
echo "--- DIAGNOSTICS START ---"
echo "Kernel: $(uname -r)"
echo "Modules on disk:"
ls -l /lib/modules/$(uname -r)/modules.dep

echo "Attempting to load nvidia module..."
sudo modprobe nvidia -v 2>&1
MODPROBE_EXIT=$?

if [ $MODPROBE_EXIT -eq 0 ]; then
    echo "Module loaded successfully."
else
    echo "Module load failed with code $MODPROBE_EXIT"
    echo "Checking dmesg for nvidia..."
    dmesg | grep -i nvidia | tail -n 5
fi

echo "Checking nvidia-smi..."
nvidia-smi

echo "Restarting service..."
sudo systemctl restart nvidia-cdi-refresh.service
systemctl status nvidia-cdi-refresh.service
