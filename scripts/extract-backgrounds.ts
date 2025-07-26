import fs from 'fs'
import path from 'path'

const base64File = path.join(process.cwd(), 'plugins/og-template/base64.ts')
const outputDir = path.join(process.cwd(), 'public/images/backgrounds')

// Read the file content
const content = fs.readFileSync(base64File, 'utf-8')

// Find all base64 image data
const base64Regex = /['"]data:image\/([a-z]+);base64,([^'"]+)['"]/g
let match
const images = new Map()

while ((match = base64Regex.exec(content)) !== null) {
  const [, imageType, data] = match

  // Find the associated key by looking before this match
  const keyMatch = content
    .slice(Math.max(0, match.index - 50), match.index)
    .match(/(\w+):\s*$/)
  if (!keyMatch) {
    continue
  }

  const key = keyMatch[1]
  const fileName = `${key}.${imageType}`
  const filePath = path.join(outputDir, fileName)

  // Save the image
  try {
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
    console.log(`Saved ${fileName}`)
    images.set(key, fileName)
  } catch (error) {
    console.error(`Error saving ${fileName}:`, error)
  }
}

// Create the new TypeScript file
const newFileContent = `type BackgroundBase64 = Record<BgType, string>;

const backgroundBase64: BackgroundBase64 = {
${Array.from(images.entries())
  .map(([key, file]) => `  ${key}: '/images/backgrounds/${file}'`)
  .join(',\n')}
} as const;

export default backgroundBase64;
`

fs.writeFileSync(base64File + '.new', newFileContent)
console.log('Created new TypeScript file')
