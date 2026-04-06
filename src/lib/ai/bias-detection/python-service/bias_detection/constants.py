"""
Constants for bias detection service, including bias-related term sets.
"""

# Gender bias term sets
MALE_TERMS = {
    "he", "him", "his", "man", "men", "boy", "boys", "male", "father", "son", "brother"
}

FEMALE_TERMS = {
    "she", "her", "hers", "woman", "women", "girl", "girls", "female", "mother", "daughter", "sister"
}

# Racial bias terms
RACIAL_TERMS = {
    "race", "racial", "ethnic", "ethnicity", "minority", "majority",
    "black", "white", "asian", "hispanic", "latino", "native",
}

# Age bias terms
AGE_TERMS = {
    "young", "old", "elderly", "senior", "youth", "teenager",
    "adult", "child", "children", "baby", "infant", "toddler", "adolescent",
}

# Cultural bias terms
CULTURAL_TERMS = {
    "culture", "cultural", "religion", "religious", "tradition",
    "traditional", "foreign", "immigrant", "native", "indigenous",
    "western", "eastern",
}

# Biased terms and their categories for detailed analysis
BIASED_TERMS_DICT = {
    "gender": ["mankind", "manpower", "chairman", "policeman", "fireman"],
    "racial": ["exotic", "articulate", "urban", "ghetto", "primitive"],
    "age": ["over the hill", "senior moment", "young blood", "old-fashioned"],
    "ability": ["crazy", "insane", "lame", "blind to", "deaf to"],
}

# Alternatives for biased terms
BIASED_TERM_ALTERNATIVES = {
    "mankind": "humanity",
    "manpower": "workforce",
    "chairman": "chairperson",
    "policeman": "police officer",
    "fireman": "firefighter",
    "crazy": "unusual",
    "insane": "extreme",
    "lame": "weak",
}
