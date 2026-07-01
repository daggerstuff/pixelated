import time

import numpy as np
import torch

from ai.pixel.research.quantum_emotional_states import QuantumEmotionState

EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "disgust"]
NUM_SIMULATIONS = 10000


def run_softmax_simulation():
    """Simulates emotion measurement using a standard softmax probability distribution."""
    start_time = time.time()

    # Create a random logit tensor
    logits = torch.randn(len(EMOTIONS))
    probabilities = torch.softmax(logits, dim=0)

    results = []
    for _ in range(NUM_SIMULATIONS):
        # Sample from the distribution
        sampled_index = int(torch.multinomial(probabilities, 1).item())
        results.append(EMOTIONS[sampled_index])

    end_time = time.time()
    return end_time - start_time


def run_quantum_simulation():
    """Simulates emotion measurement using the QuantumEmotionState class."""
    start_time = time.time()

    # Create a quantum state with random complex amplitudes
    amplitudes = np.random.rand(len(EMOTIONS)) + 1j * np.random.rand(len(EMOTIONS))
    q_state = QuantumEmotionState(EMOTIONS, amplitudes.tolist())

    results = []
    for _ in range(NUM_SIMULATIONS):
        # "Measure" the state
        measured_emotion = q_state.measure()
        results.append(measured_emotion)

    end_time = time.time()
    duration = end_time - start_time

    np.abs(q_state.amplitudes) ** 2
    return duration


if __name__ == "__main__":
    softmax_time = run_softmax_simulation()
    quantum_time = run_quantum_simulation()

    if softmax_time < quantum_time:
        pass
    else:
        pass
