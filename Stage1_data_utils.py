"""Utilities for normalizing Stage 1 training JSON rows into text format."""


def coerce_text(value):
    if value is None:
        return ""

    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    if isinstance(value, (list, tuple)):
        for item in value:
            candidate = coerce_text(item)
            if candidate:
                return candidate
        return ""
    if isinstance(value, dict):
        for key in ("content", "text", "prompt", "input", "output", "response", "completion"):
            if key in value:
                candidate = coerce_text(value.get(key))
                if candidate:
                    return candidate
        for candidate in value.values():
            nested = coerce_text(candidate)
            if nested:
                return nested
    return str(value).strip()


def extract_messages_pair(messages):
    if not isinstance(messages, (list, tuple)):
        return "", ""

    user_text = ""
    assistant_text = ""
    for item in messages:
        if not isinstance(item, dict):
            continue
        role = coerce_text(item.get("role")).lower()
        content = coerce_text(item.get("content"))
        if not content:
            continue
        if role == "user":
            user_text = content
        elif role == "assistant":
            assistant_text = content
    return user_text, assistant_text


def looks_like_metadata_json(value):
    text = coerce_text(value)
    return bool(text) and text.startswith("{") and text.endswith("}") and '"' in text


def build_prompt_text(raw_prompt):
    if raw_prompt is None:
        return ""

    if isinstance(raw_prompt, dict):
        if isinstance(raw_prompt.get("content"), str):
            return raw_prompt.get("content").strip()
        if isinstance(raw_prompt.get("text"), str):
            return raw_prompt.get("text").strip()

    if isinstance(raw_prompt, list):
        user_messages = [
            msg.get("content") for msg in raw_prompt
            if isinstance(msg, dict)
            and coerce_text(msg.get("role")).lower() == "user"
            and isinstance(msg.get("content"), str)
        ]
        if user_messages:
            return str(user_messages[-1]).strip()

    return coerce_text(raw_prompt)


def build_formatted_text(prompt_value, completion_value):
    prompt_text = build_prompt_text(prompt_value)
    completion_text = coerce_text(completion_value)

    if looks_like_metadata_json(completion_text):
        completion_text = "[metadata json block]"

    return (
        "### Instruction:\n"
        f"{prompt_text}\n\n"
        "### Output:\n"
        f"{completion_text}"
    )


def extract_prompt_and_completion(example):
    if not isinstance(example, dict):
        return coerce_text(example), ""

    direct_text = coerce_text(example.get("text"))
    if direct_text:
        return direct_text, ""

    prompt_message, completion_message = extract_messages_pair(example.get("messages"))
    if prompt_message and completion_message:
        return prompt_message, completion_message

    prompt_candidates = ("prompt", "instruction", "input")
    completion_candidates = ("response", "completion", "output", "label", "target")

    prompt_text = ""
    for key in prompt_candidates:
        if key in example:
            prompt_text = coerce_text(example[key])
            if prompt_text:
                break

    completion_text = ""
    for key in completion_candidates:
        if key in example:
            completion_text = coerce_text(example[key])
            if completion_text:
                break

    return prompt_text, completion_text


def to_text_field(example):
    prompt_text, completion_text = extract_prompt_and_completion(example)
    if completion_text:
        return {"text": build_formatted_text(prompt_text, completion_text)}
    return {"text": coerce_text(prompt_text)}


def _get_batched_value(examples, key, index):
    values = examples.get(key)
    if not isinstance(values, list):
        return values
    if index >= len(values):
        return None
    return values[index]


def to_text_field_batched(examples):
    keys = tuple(examples.keys())
    if not keys:
        return {"text": []}

    first_key = keys[0]
    batch_size = len(examples[first_key]) if isinstance(examples[first_key], list) else 0

    prompt_candidates = ("prompt", "instruction", "input")
    completion_candidates = ("response", "completion", "output", "label", "target")

    normalized_text = []
    for index in range(batch_size):
        direct_text = coerce_text(_get_batched_value(examples, "text", index))
        if direct_text:
            normalized_text.append(direct_text)
            continue

        prompt_message, completion_message = extract_messages_pair(
            _get_batched_value(examples, "messages", index)
        )
        if prompt_message and completion_message:
            normalized_text.append(build_formatted_text(prompt_message, completion_message))
            continue

        prompt_text = ""
        for key in prompt_candidates:
            candidate = _get_batched_value(examples, key, index)
            prompt_text = coerce_text(candidate)
            if prompt_text:
                break

        completion_text = ""
        for key in completion_candidates:
            candidate = _get_batched_value(examples, key, index)
            completion_text = coerce_text(candidate)
            if completion_text:
                break

        if completion_text:
            normalized_text.append(build_formatted_text(prompt_text, completion_text))
            continue

        normalized_text.append(coerce_text(prompt_text))

    return {"text": normalized_text}


def has_text(example):
    return bool(coerce_text(example.get("text")))
