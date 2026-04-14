import os
import subprocess

def commit(msg, files):
    subprocess.run(["git", "add"] + files, check=True)
    subprocess.run(["git", "commit", "-m", msg], check=True)

# 1. DIETER RAMS: Alignment is precision.
with open("src/styles/homepage.css", "r") as f:
    content = f.read()
content = content.replace(".pe-home-rail {", ".pe-home-rail {\n  margin: 0 auto;\n  max-width: 38rem;\n  text-align: center;\n  justify-items: center;")
with open("src/styles/homepage.css", "w") as f:
    f.write(content)
commit("Round 1 (Dieter Rams): Center-align rails and enforce section max-width", ["src/styles/homepage.css"])

# 2. JONY IVE: Hero font is clumsy.
with open("src/components/homepage/HeroContent.astro", "r") as f:
    content = f.read()
content = content.replace("font-size: clamp(2.45rem, 3.7vw, 4.25rem);", "font-size: 42px;")
with open("src/components/homepage/HeroContent.astro", "w") as f:
    f.write(content)
commit("Round 2 (Jony Ive): Hardcode Hero font to exact 42px per DESIGN.md", ["src/components/homepage/HeroContent.astro"])

# 3. MASSIMO VIGNELLI: The grid must be centered.
with open("src/components/homepage/IntroSection.astro", "r") as f:
    content = f.read()
content = content.replace("max-width: 34rem;", "max-width: 34rem; margin: 0 auto; text-align: center;")
content = content.replace("justify-items: start;", "justify-items: center;")
with open("src/components/homepage/IntroSection.astro", "w") as f:
    f.write(content)
commit("Round 3 (Massimo Vignelli): Center IntroSection lead and grid", ["src/components/homepage/IntroSection.astro"])

# 4. ZAHA HADID: Flow requires central gravity.
with open("src/components/mizu/CoreFeatures.astro", "r") as f:
    content = f.read()
content = content.replace("max-width: 38rem;", "max-width: 38rem; margin: 0 auto; text-align: center; justify-items: center;")
with open("src/components/mizu/CoreFeatures.astro", "w") as f:
    f.write(content)
commit("Round 4 (Zaha Hadid): Center CoreFeatures intro block", ["src/components/mizu/CoreFeatures.astro"])

# 5. PAULA SCHER: Type balance.
with open("src/components/mizu/CTA.astro", "r") as f:
    content = f.read()
content = content.replace("max-width: 38rem;", "max-width: 38rem; margin: 0 auto; text-align: center;")
with open("src/components/mizu/CTA.astro", "w") as f:
    f.write(content)
commit("Round 5 (Paula Scher): Center CTA layout content", ["src/components/mizu/CTA.astro"])

# 6. LE CORBUSIER: Human scale.
with open("src/styles/homepage.css", "r") as f:
    content = f.read()
content = content.replace(".pe-home-copy,", ".pe-home-copy {\n  margin: 0 auto !important;\n  text-align: center;\n}\n.pe-home-copy,")
with open("src/styles/homepage.css", "w") as f:
    f.write(content)
commit("Round 6 (Le Corbusier): Global centering for home copy elements", ["src/styles/homepage.css"])

# 7. MARGARET CALVERT: Clarity in signage.
with open("src/components/homepage/HeroContent.astro", "r") as f:
    content = f.read()
content = content.replace("justify-content: flex-start;", "justify-content: center;")
content = content.replace("text-align: left;", "text-align: center;") # if it exists
content = content.replace("max-width: 11ch;", "max-width: 11ch; margin: 0 auto;")
with open("src/components/homepage/HeroContent.astro", "w") as f:
    f.write(content)
commit("Round 7 (Margaret Calvert): Center Hero title and wrap", ["src/components/homepage/HeroContent.astro"])

# 8. STEFAN SAGMEISTER: Emotional resonance.
with open("src/components/homepage/HeroContent.astro", "r") as f:
    content = f.read()
content = content.replace("max-width: 34rem;", "max-width: 34rem; margin: 0 auto;")
with open("src/components/homepage/HeroContent.astro", "w") as f:
    f.write(content)
commit("Round 8 (Stefan Sagmeister): Center Hero subtitle and proof points", ["src/components/homepage/HeroContent.astro"])

# 9. DAVID CARSON: Purposeful centering.
with open("src/components/homepage/HeroContent.astro", "r") as f:
    content = f.read()
content = content.replace("justify-content: flex-start;", "justify-content: center;") # Repeat for catch-all
content = content.replace("align-items: center;", "align-items: center; justify-content: center;")
with open("src/components/homepage/HeroContent.astro", "w") as f:
    f.write(content)
commit("Round 9 (David Carson): Final alignment pass on Hero actions", ["src/components/homepage/HeroContent.astro"])

# 10. GHOST OF BRUTALISM: The system is now one.
with open("src/styles/homepage.css", "r") as f:
    content = f.read()
content = content.replace(".pe-home-shell {", ".pe-home-shell {\n  display: flex;\n  flex-direction: column;\n  align-items: center;")
with open("src/styles/homepage.css", "w") as f:
    f.write(content)
commit("Round 10 (Ghost of Brutalism): Enforce flex-centering on all shells", ["src/styles/homepage.css"])

# Final Push
subprocess.run(["git", "push"], check=False)
