#!/bin/bash
# UI Dark Mode Upgrade - Replace V2 files with originals
# Run this script from the project root directory

set -e  # Exit on any error

echo "🎨 Starting UI Dark Mode Upgrade..."

# 1. Replace component files
echo "📁 Replacing component files..."
mv src/components/layout/HeaderV2.astro src/components/layout/Header.astro
mv src/components/layout/FooterV2.astro src/components/layout/Footer.astro
mv src/components/ui/HeroSectionV2.astro src/components/ui/HeroSection.astro
mv src/components/ui/FeaturesSectionV2.astro src/components/ui/FeaturesSection.astro
mv src/components/ui/ThemeToggleV2.astro src/components/ui/ThemeToggle.astro

# 2. Replace homepage
echo "🏠 Replacing homepage..."
mv src/pages/index-v2.astro src/pages/index.astro

# 3. Update BaseLayout.astro imports
echo "📝 Updating BaseLayout imports..."
sed -i.bak 's|HeaderV2\.astro|Header.astro|g' src/layouts/BaseLayout.astro
sed -i.bak 's|FooterV2\.astro|Footer.astro|g' src/layouts/BaseLayout.astro

# 4. Update Header.astro imports
echo "📝 Updating Header imports..."
sed -i.bak 's|ThemeToggleV2|ThemeToggle|g' src/components/layout/Header.astro

# 5. Update index.astro imports
echo "📝 Updating homepage imports..."
sed -i.bak 's|HeroSectionV2|HeroSection|g' src/pages/index.astro
sed -i.bak 's|FeaturesSectionV2|FeaturesSection|g' src/pages/index.astro

# 6. Clean up backup files
echo "🧹 Cleaning up backup files..."
rm -f src/layouts/BaseLayout.astro.bak
rm -f src/components/layout/Header.astro.bak
rm -f src/pages/index.astro.bak

# 7. Remove any temporary files
echo "🗑️  Removing temporary files..."
rm -f tmp_rovodev_*

echo "✅ UI Dark Mode Upgrade Complete!"
echo ""
echo "🚀 Next steps:"
echo "   pnpm build"
echo "   pnpm preview"
echo "   Visit: http://localhost:4321%22"
echo ""
echo "🎨 Your new unified dark theme is now active!"