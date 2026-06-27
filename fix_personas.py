with open("hackathon/personas.py") as f:
    content = f.read()

replacements = {
    "States agreement or disagreement immediately. Asks one killer follow-up question.": "Direct, decisive, and impatient. Focuses on velocity and unblocking, never lingering on pleasantries.",
    "Confirms the request, details the logistical or compliance steps required, and sets a clear deadline.": "Methodical and polite, focused entirely on resolving ambiguity, establishing deadlines, and ensuring compliance.",
    "Validates the premise, offers a clinical caveat, and suggests an evidence-based approach.": "Careful, academic, and clinical. Often reframes product excitement into scientifically rigorous, evidence-based constraints.",
    "Says yes or no in first sentence. Then explains why with one concrete detail. Ends with what needs to happen next.": "Blunt and terse. Prefers technical accuracy over politeness and treats systemic failures with extreme seriousness.",
    "States the design concern in one sentence. Suggests a specific alternative. Ends with 'What do you think?'": "Highly observant and detail-oriented. Speaks softly but firmly when aesthetic or accessibility standards are threatened.",
    "Either one-word acknowledgement or a 3-bullet breakdown. No in-between.": "Extremely brief. Rarely uses full sentences unless explaining a critical backend failure.",
    "Shares one specific win or metric. Challenges with data. Signs off with a rallying phrase.": "Energetic and persuasive. Uses data and competitive comparisons to justify marketing moves.",
    "Mirrors the recipient's concern. Shares one relevant win story. Pivots to next step.": "Smooth and strategic. Constantly looking for the angle to close a deal or leverage a relationship.",
    "Responds with one core tradeoff and asks for a clear decision.": "Analytical and cautious. Always evaluating trade-offs and trying to rein in scope creep.",
}

for old, new in replacements.items():
    content = content.replace(f'reply_style="{old}"', f'reply_style="{new}"')

with open("hackathon/personas.py", "w") as f:
    f.write(content)
