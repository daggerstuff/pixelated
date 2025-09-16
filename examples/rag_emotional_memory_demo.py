import requests
import json
import os
from typing import List, Dict, Any

API_URL = "http://127.0.0.1:8000/analyze"
LOG_FILE = "logs/pipeline_runs.jsonl"

def get_emotional_analysis(text: str) -> Dict[str, Any] | None:
    try:
        response = requests.post(API_URL, json={"text": text})
        response.raise_for_status()
        return response.json()
    except (requests.exceptions.ConnectionError, requests.exceptions.HTTPError) as e:
        print(f"Error calling API: {e}")
        return None

def load_past_interactions() -> List[Dict[str, Any]]:
    interactions = []
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            for line in f:
                interactions.append(json.loads(line))
    return interactions

def find_similar_emotional_context(query_analysis: Dict[str, Any], past_interactions: List[Dict[str, Any]], top_k: int = 2) -> List[Dict[str, Any]]:
    # For simplicity, we'll just compare reflection scores and deviation.
    # In a real RAG system, you'd use vector similarity (e.g., cosine similarity on emotion_features).
    
    query_reflection = query_analysis["meta_intelligence"]["reflection_score"]
    query_deviation = query_analysis["meta_intelligence"]["deviation"]

    scored_interactions = []
    for interaction in past_interactions:
        if "output" in interaction and "meta_intelligence" in interaction["output"]:
            past_reflection = interaction["output"]["meta_intelligence"]["reflection_score"]
            past_deviation = interaction["output"]["meta_intelligence"]["deviation"]
            
            # Simple distance metric
            score = abs(query_reflection - past_reflection) + abs(query_deviation - past_deviation)
            scored_interactions.append((score, interaction))
    
    scored_interactions.sort(key=lambda x: x[0]) # Sort by lowest score (most similar)
    return [item[1] for item in scored_interactions[:top_k]]

if __name__ == "__main__":
    # Ensure the API is running before executing this script
    print("--- RAG-style Emotional Memory Demo ---")

    # Example 1: Query for a positive emotion
    query_text_1 = "I am so happy today!"
    print(f"\nQuery: \"{query_text_1}\"")
    query_analysis_1 = get_emotional_analysis(query_text_1)
    
    if query_analysis_1:
        past_interactions = load_past_interactions()
        similar_contexts = find_similar_emotional_context(query_analysis_1, past_interactions)
        
        print("\n--- Retrieved Similar Contexts (for positive query) ---")
        if similar_contexts:
            for i, context in enumerate(similar_contexts):
                print(f"Context {i+1}:")
                print(f"  Input: {context['input']['text']}")
                print(f"  Reflection: {context['output']['meta_intelligence']['reflection_score']:.2f}")
                print(f"  Deviation: {context['output']['meta_intelligence']['deviation']:.2f}")
        else:
            print("No similar contexts found.")

    # Example 2: Query for a negative emotion
    query_text_2 = "I feel really down and sad."
    print(f"\nQuery: \"{query_text_2}\"")
    query_analysis_2 = get_emotional_analysis(query_text_2)
    
    if query_analysis_2:
        past_interactions = load_past_interactions()
        similar_contexts = find_similar_emotional_context(query_analysis_2, past_interactions)
        
        print("\n--- Retrieved Similar Contexts (for negative query) ---")
        if similar_contexts:
            for i, context in enumerate(similar_contexts):
                print(f"Context {i+1}:")
                print(f"  Input: {context['input']['text']}")
                print(f"  Reflection: {context['output']['meta_intelligence']['reflection_score']:.2f}")
                print(f"  Deviation: {context['output']['meta_intelligence']['deviation']:.2f}")
        else:
            print("No similar contexts found.")
