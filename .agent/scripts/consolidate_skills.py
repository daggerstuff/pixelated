#!/usr/bin/env python3
"""
Categorize and consolidate skills by name patterns.
Groups similar skills, identifies duplicates, and recommends merges.
"""

import json
import re
from collections import defaultdict
from pathlib import Path

INDEX_FILE = Path("/home/vivi/pixelated/.agents/skills-index.md")
OUTPUT_MERGE_PLAN = Path("/home/vivi/pixelated/.agent/skill-merge-plan.json")


def extract_skills_from_index(filepath):
    """Extract skill entries from the markdown index."""
    content = filepath.read_text()
    skills = []

    # Pattern: - **skill-name** (metadata) > description > Path: ...
    pattern = r"- \*\*([^*]+)\*\*.*?Path: `([^`]+)`"
    matches = re.finditer(pattern, content, re.DOTALL)

    for match in matches:
        name = match.group(1).strip()
        path = match.group(2).strip()
        # Extract model and version if present
        meta_match = re.search(r"\(`([^`]+)` · v([^\n]+)\)", match.group(0))
        model = meta_match.group(1) if meta_match else "unspecified"
        version = meta_match.group(2) if meta_match else "unversioned"
        # Extract description
        desc_match = re.search(r"> ([^\n]+)", match.group(0))
        description = desc_match.group(1).strip() if desc_match else ""

        skills.append(
            {
                "name": name,
                "path": path,
                "model": model,
                "version": version,
                "description": description,
            }
        )

    return skills


def categorize_skill(name):
    """Categorize a skill by its name using keyword patterns."""
    name_lower = name.lower()

    # Category mapping (keyword -> category)
    category_patterns = [
        ("agent", "agent"),
        ("frontend", "frontend"),
        ("backend", "backend"),
        ("api", "api"),
        ("security", "security"),
        ("test", "testing"),
        ("testing", "testing"),
        ("devops", "devops"),
        ("cloud", "cloud"),
        ("aws", "cloud"),
        ("azure", "cloud"),
        ("gcp", "cloud"),
        ("docker", "devops"),
        ("kubernetes", "devops"),
        ("k8s", "devops"),
        ("ci/cd", "devops"),
        ("database", "database"),
        ("sql", "database"),
        ("postgres", "database"),
        ("mysql", "database"),
        ("mongodb", "database"),
        ("redis", "database"),
        ("data", "data"),
        ("ai", "ai"),
        ("ml", "ai"),
        ("machine learning", "ai"),
        ("deep learning", "ai"),
        ("neural", "ai"),
        ("llm", "ai"),
        ("gpt", "ai"),
        ("claude", "ai"),
        ("python", "language"),
        ("javascript", "language"),
        ("typescript", "language"),
        ("java", "language"),
        ("go", "language"),
        ("rust", "language"),
        ("c++", "language"),
        ("c#", "language"),
        ("kotlin", "language"),
        ("swift", "language"),
        ("ruby", "language"),
        ("php", "language"),
        ("perl", "language"),
        ("bash", "language"),
        ("shell", "language"),
        ("web", "web"),
        ("html", "web"),
        ("css", "web"),
        ("dom", "web"),
        ("browser", "web"),
        ("chrome", "web"),
        ("firefox", "web"),
        ("safari", "web"),
        ("mobile", "mobile"),
        ("ios", "mobile"),
        ("android", "mobile"),
        ("react native", "mobile"),
        ("flutter", "mobile"),
        ("game", "gaming"),
        ("unity", "gaming"),
        ("unreal", "gaming"),
        ("godot", "gaming"),
        ("graphics", "graphics"),
        ("3d", "graphics"),
        ("webgl", "graphics"),
        ("three.js", "graphics"),
        ("animation", "animation"),
        ("motion", "animation"),
        ("design", "design"),
        ("ui", "design"),
        ("ux", "design"),
        ("figma", "design"),
        ("sketch", "design"),
        ("adobe", "design"),
        ("write", "writing"),
        ("writing", "writing"),
        ("content", "writing"),
        ("copy", "writing"),
        ("blog", "writing"),
        ("article", "writing"),
        ("docs", "documentation"),
        ("documentation", "documentation"),
        ("readme", "documentation"),
        ("api-doc", "documentation"),
        ("markdown", "documentation"),
        ("git", "version-control"),
        ("github", "version-control"),
        ("gitlab", "version-control"),
        ("bitbucket", "version-control"),
        ("svn", "version-control"),
        ("monorepo", "version-control"),
        ("project", "project-management"),
        ("project-management", "project-management"),
        ("jira", "project-management"),
        ("trello", "project-management"),
        ("asana", "project-management"),
        ("notion", "project-management"),
        ("airtable", "project-management"),
        ("basecamp", "project-management"),
        ("calendly", "scheduling"),
        ("calendar", "scheduling"),
        ("scheduling", "scheduling"),
        ("automation", "automation"),
        ("rpa", "automation"),
        ("workflow", "automation"),
        ("integration", "integration"),
        ("api-integration", "integration"),
        ("webhook", "integration"),
        ("etl", "data"),
        ("pipeline", "data"),
        ("streaming", "data"),
        ("kafka", "data"),
        ("sql", "data"),
        ("analytics", "analytics"),
        ("metrics", "analytics"),
        ("dashboard", "analytics"),
        ("seo", "marketing"),
        ("marketing", "marketing"),
        ("ad", "marketing"),
        ("ads", "marketing"),
        ("campaign", "marketing"),
        ("social", "marketing"),
        ("email", "communication"),
        ("slack", "communication"),
        ("teams", "communication"),
        ("discord", "communication"),
        ("chat", "communication"),
        ("messaging", "communication"),
        ("sms", "communication"),
        ("twilio", "communication"),
        ("notification", "communication"),
        ("payment", "finance"),
        ("billing", "finance"),
        ("invoice", "finance"),
        ("subscription", "finance"),
        ("ecommerce", "ecommerce"),
        ("shopify", "ecommerce"),
        ("woocommerce", "ecommerce"),
        ("magento", "ecommerce"),
        ("crm", "crm"),
        ("sales", "crm"),
        ("hubspot", "crm"),
        ("salesforce", "crm"),
        ("zoho", "crm"),
        ("hr", "hr"),
        ("hris", "hr"),
        ("recruiting", "hr"),
        ("bamboohr", "hr"),
        ("greenhouse", "hr"),
        ("lever", "hr"),
        ("security", "security"),
        ("auth", "security"),
        ("authentication", "security"),
        ("authorization", "security"),
        ("encryption", "security"),
        ("firewall", "security"),
        ("vulnerability", "security"),
        ("penetration", "security"),
        ("pentest", "security"),
        ("bug bounty", "security"),
        ("crypto", "security"),
        ("blockchain", "blockchain"),
        ("smart contract", "blockchain"),
        ("web3", "blockchain"),
        ("nft", "blockchain"),
        ("defi", "blockchain"),
        ("iot", "iot"),
        ("embedded", "iot"),
        ("firmware", "iot"),
        ("sensor", "iot"),
        ("robotics", "robotics"),
        ("hardware", "hardware"),
        ("fpga", "hardware"),
        ("asic", "hardware"),
        ("electronics", "hardware"),
        ("pcb", "hardware"),
        ("mechanical", "mechanical"),
        ("cad", "mechanical"),
        ("cae", "mechanical"),
        ("simulation", "simulation"),
        ("fea", "simulation"),
        ("cfd", "simulation"),
        ("optimization", "optimization"),
        ("performance", "performance"),
        ("profiling", "performance"),
        ("benchmark", "performance"),
        ("load testing", "performance"),
        ("stress", "performance"),
        ("monitoring", "monitoring"),
        ("logging", "monitoring"),
        ("observability", "monitoring"),
        ("metrics", "monitoring"),
        ("alerting", "monitoring"),
        ("incident", "operations"),
        ("sre", "operations"),
        ("devops", "operations"),
        ("infrastructure", "operations"),
        ("terraform", "infrastructure"),
        ("ansible", "infrastructure"),
        ("pulumi", "infrastructure"),
        ("cloudformation", "infrastructure"),
        ("serverless", "serverless"),
        ("lambda", "serverless"),
        ("faas", "serverless"),
        ("edge", "edge"),
        ("cdn", "edge"),
        ("cloudflare", "edge"),
        ("fastly", "edge"),
        ("akamai", "edge"),
    ]

    for keyword, category in category_patterns:
        if keyword in name_lower:
            return category

    return "general"


def find_duplicates_and_overlaps(skills):
    """Identify potential duplicates and overlapping skills."""

    # Group by base name (remove suffixes like -patterns, -guide, -expert, etc.)
    def get_base_name(name):
        # Remove common suffixes
        suffixes = [
            "-patterns",
            "-guide",
            "-expert",
            "-specialist",
            "-developer",
            "-engineer",
            "-architect",
            "-master",
            "-pro",
            "-best-practices",
            "-implementation",
            "-setup",
            "-configuration",
            "-optimization",
            "-migration",
            "-testing",
            "-security",
            "-performance",
            "-automation",
        ]
        base = name.lower()
        for suffix in suffixes:
            if base.endswith(suffix):
                base = base[: -len(suffix)]
                break
        return base

    groups = defaultdict(list)
    for skill in skills:
        base = get_base_name(skill["name"])
        groups[base].append(skill)

    # Find groups with multiple entries (potential duplicates)
    duplicates = {base: group for base, group in groups.items() if len(group) > 1}
    return duplicates


def generate_consolidation_plan(skills, duplicates):
    """Generate a plan for consolidating skills."""
    categories = defaultdict(list)
    for skill in skills:
        cat = categorize_skill(skill["name"])
        categories[cat].append(skill)

    # Build consolidation recommendations
    plan = {
        "total_skills": len(skills),
        "categories": {},
        "duplicates": {},
        "merge_recommendations": [],
    }

    # Category stats
    for cat, cat_skills in sorted(categories.items(), key=lambda x: len(x[1]), reverse=True):
        plan["categories"][cat] = {
            "count": len(cat_skills),
            "skills": [s["name"] for s in cat_skills],
        }

    # Duplicate details
    for base, dup_skills in duplicates.items():
        plan["duplicates"][base] = {
            "count": len(dup_skills),
            "skills": [s["name"] for s in dup_skills],
            "paths": [s["path"] for s in dup_skills],
        }

    # Recommend merges: keep the most comprehensive, delete others
    for base, dup_list in duplicates.items():
        # Sort by description length (longer = more comprehensive)
        sorted_skills = sorted(dup_list, key=lambda s: len(s["description"]), reverse=True)
        keep = sorted_skills[0]
        to_delete = sorted_skills[1:]

        plan["merge_recommendations"].append(
            {
                "base": base,
                "keep": keep["name"],
                "keep_path": keep["path"],
                "delete": [s["name"] for s in to_delete],
                "delete_paths": [s["path"] for s in to_delete],
                "rationale": f"Keep '{keep['name']}' (longest description, most comprehensive).",
            }
        )

    return plan


def main():
    print("Loading skills index...")
    skills = extract_skills_from_index(INDEX_FILE)
    print(f"Extracted {len(skills)} skills")

    print("Categorizing skills...")
    # Add category to each skill
    for skill in skills:
        skill["category"] = categorize_skill(skill["name"])

    print("Finding duplicates and overlaps...")
    duplicates = find_duplicates_and_overlaps(skills)
    print(f"Found {len(duplicates)} groups of duplicate/overlapping skills")

    print("Generating consolidation plan...")
    plan = generate_consolidation_plan(skills, duplicates)

    # Save plan
    OUTPUT_MERGE_PLAN.write_text(json.dumps(plan, indent=2))
    print(f"Wrote merge plan to {OUTPUT_MERGE_PLAN}")

    # Print summary
    print("\n=== Consolidation Summary ===")
    print(f"Total skills: {plan['total_skills']}")
    print(f"Categories: {len(plan['categories'])}")
    for cat, info in sorted(plan["categories"].items(), key=lambda x: x[1]["count"], reverse=True)[:15]:
        print(f"  {cat}: {info['count']}")
    print(f"\nDuplicates/overlaps: {len(plan['duplicates'])} groups")
    print(f"Recommended merges: {len(plan['merge_recommendations'])}")
    total_to_delete = sum(len(m["delete"]) for m in plan["merge_recommendations"])
    print(f"Skills to delete after merging: {total_to_delete}")
    print(f"Estimated consolidation: {plan['total_skills']} → {plan['total_skills'] - total_to_delete}")

    return plan


if __name__ == "__main__":
    plan = main()
    exit(0)
