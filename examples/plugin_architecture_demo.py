import requests
import json

API_URL = "http://127.0.0.1:8000/analyze"

def augment_prompt_with_emotion(user_prompt: str) -> str:
    try:
        response = requests.post(API_URL, json={"text": user_prompt})
        response.raise_for_status()  # Raise an exception for HTTP errors
        emotion_analysis = response.json()

        # Extract relevant emotional metrics
        deviation = emotion_analysis["meta_intelligence"]["deviation"]
        reflection_score = emotion_analysis["meta_intelligence"]["reflection_score"]
        
        # Simple augmentation strategy
        augmented_prompt = (
            f"User said: \"{user_prompt}\".\n"
            f"Emotional analysis: Deviation={deviation:.2f}, Reflection={reflection_score:.2f}.\n"
            f"Based on this, respond with appropriate empathy and context.\n"
        )
        return augmented_prompt

    except requests.exceptions.ConnectionError:
        return f"Error: Could not connect to the emotional analysis API at {API_URL}. Is the server running?"
    except requests.exceptions.HTTPError as e:
        return f"Error from API: {e} - {response.text}"
    except Exception as e:
        return f"An unexpected error occurred: {e}"

if __name__ == "__main__":
    test_prompt_1 = "I had a terrible day, everything went wrong."
    test_prompt_2 = "I\'m so excited about the new project!"

    print("--- Testing Prompt 1 ---")
    augmented_1 = augment_prompt_with_emotion(test_prompt_1)
    print(augmented_1)

    print("\n--- Testing Prompt 2 ---")
    augmented_2 = augment_prompt_with_emotion(test_prompt_2)
    print(augmented_2)
