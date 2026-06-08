import logging
import re

logging.basicConfig(level=logging.INFO)

files = [
    "/home/vivi/pixelated/src/lib/hooks/journal-research/__tests__/useSession.test.tsx",
    "/home/vivi/pixelated/src/lib/hooks/journal-research/__tests__/useIntegration.test.tsx",
]

for file in files:
    try:
        with open(file) as f:
            content = f.read()
        # This regex fixes the getState return type to have `as any` correctly on the outside
        content = re.sub(
            r"\)\.getState = \(\) => \(\{([^}]+)\}\)(?! as any)",
            r").getState = () => ({\1} as any)",
            content,
            flags=re.MULTILINE,
        )
        content = content.replace("as any as any", "as any")
        with open(file, "w") as f:
            f.write(content)
        logging.info(f"Fixed {file}")
    except Exception as e:
        logging.error(f"Error processing {file}: {e}")
