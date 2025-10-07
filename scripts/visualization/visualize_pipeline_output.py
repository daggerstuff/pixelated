import json
import os
import matplotlib.pyplot as plt
import numpy as np

def visualize_latest_run():
    log_file = 'logs/pipeline_runs.jsonl'
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(log_file):
        print(f"Log file not found at {log_file}")
        # Create a dummy log file for demonstration purposes
        dummy_data = {
            "output": {
                "flow_dynamics": {
                    "velocity": [[0.1, 0.2, -0.1]],
                    "acceleration": [[0.05, -0.02, 0.03]]
                },
                "meta_intelligence": {
                    "deviation": 0.5,
                    "reflection_score": 0.8
                }
            }
        }
        with open(log_file, 'w') as f:
            f.write(json.dumps(dummy_data) + '\n')

    with open(log_file, 'r') as f:
        latest_run = f.readlines()[-1]
    
    data = json.loads(latest_run)
    output_data = data['output']

    # Plot 1: Flow Dynamics
    flow = output_data['flow_dynamics']
    velocity = np.array(flow['velocity'])
    acceleration = np.array(flow['acceleration'])
    
    plt.figure(figsize=(10, 5))
    # We take the norm for simplicity to have a 1D plot over the sequence
    plt.plot(np.linalg.norm(velocity, axis=1), label='Velocity Norm')
    plt.plot(np.linalg.norm(acceleration, axis=1), label='Acceleration Norm')
    plt.title('Emotional Flow Dynamics')
    plt.xlabel('Time Step')
    plt.ylabel('Magnitude')
    plt.legend()
    plt.grid(True)
    plt.savefig(os.path.join(output_dir, 'flow_dynamics.png'))
    plt.close()

    # Plot 2: Meta Intelligence
    meta = output_data['meta_intelligence']
    metrics = {
        'Deviation': meta['deviation'],
        'Reflection Score': meta['reflection_score']
    }
    
    plt.figure(figsize=(6, 5))
    plt.bar(metrics.keys(), metrics.values(), color=['skyblue', 'lightgreen'])
    plt.title('Meta-Emotional Intelligence')
    plt.ylabel('Score')
    plt.ylim(0, 1)
    plt.savefig(os.path.join(output_dir, 'meta_intelligence.png'))
    plt.close()

    print(f"Visualizations saved to {output_dir}")

if __name__ == "__main__":
    visualize_latest_run()
