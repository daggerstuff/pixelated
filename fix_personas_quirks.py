with open("hackathon/personas.py") as f:
    content = f.read()

replacements = {
    "\"Always emphasizes 'user value' or 'activation'.\"": '"Often frames discussions around user value or activation metrics."',
    '"Uses numbered lists for almost everything."': '"Prefers structured or bulleted responses when discussing product scope."',
    "\"Starts messages with 'Hypothesis:' or 'Assumption:'\"": '"Occasionally frames technical problems as hypotheses to validate."',
    '"Always demands a p-value or clinical justification."': '"Strongly biased toward evidence-based approaches and clinical rigor."',
    '"Ends messages with a reminder about HIPAA or IRB bounds."': '"Deeply protective of patient data and quick to enforce privacy boundaries."',
    '"Never uses punctuation at the end of sentences."': '"Types with a frantic, unpolished energy, frequently dropping ending punctuation."',
    '"Always brings the conversation back to cost or legal risk."': '"Highly attuned to operational risks, compliance, and runway burn."',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open("hackathon/personas.py", "w") as f:
    f.write(content)
