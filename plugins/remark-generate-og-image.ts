import type { SatoriOptions } from 'satori'
import type { BgType } from '../src/types'
import { readFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import chalk from 'chalk'
import satori from 'satori'
import { FEATURES } from '../src/config'
import { checkFileExistsInDir, unescapeHTML } from '../src/utils/common'
import type { ReactNode } from 'react'
import type { VFile } from 'vfile'

import type { VNode, RendererNode, RendererElement } from 'vue'
import { getCurrentFormattedTime } from '../src/utils/datetime'
import { ogImageMarkup } from './og-template/markup'

interface AstroFrontmatter {
  draft?: boolean
  redirect?: string
  title?: string
  ogImage?: boolean | string
  bgType?: BgType
}

interface AstroData {
  astro: {
    frontmatter: AstroFrontmatter
  }
}

const Inter = readFileSync('plugins/og-template/Inter-Regular-24pt.ttf')

const satoriOptions: SatoriOptions = {
  // debug: true,
  width: 1200,
  height: 630,
  fonts: [
    {
      name: 'Inter',
      weight: 400,
      style: 'normal',
      data: Inter,
    },
  ],
}

async function generateOgImage(
  authorOrBrand: string,
  title: string,
  bgType: BgType,
  output: string,
) {
  await mkdir(dirname(output), { recursive: true })

  console.log(
    `${chalk.black(getCurrentFormattedTime())} ${chalk.green(`Generating ${output}...`)}`,
  )

  try {
    const node = ogImageMarkup(authorOrBrand, title, bgType) as VNode<
      RendererNode,
      RendererElement
    >
    const unescapedNode = unescapeHTML(node) as ReactNode
    const svg = await satori(unescapedNode, satoriOptions)

    const compressedPngBuffer = Buffer.from(svg)

    writeFileSync(output, compressedPngBuffer)
  } catch (e) {
    console.error(
      `${chalk.black(getCurrentFormattedTime())} ${chalk.red(`[ERROR] Failed to generate og image for '${basename(output)}.'`)}`,
    )
    console.error(e)
  }
} /**
 * Used to generate {@link https://ogp.me/ Open Graph} images.
 *
 * @see https://github.com/vfile/vfile
 */
function remarkGenerateOgImage() {
  const { ogImage } = FEATURES

  if (!(Array.isArray(ogImage) && ogImage[0])) {
    return
  }

  const { authorOrBrand, fallbackTitle, fallbackBgType } = ogImage[1]

  return async function processFile(file: VFile & { data: AstroData }) {
    // regenerate fallback
    const fallbackExists = await checkFileExistsInDir(
      'public/og-images',
      'og-image.png',
    )
    if (!fallbackExists) {
      await generateOgImage(
        authorOrBrand,
        fallbackTitle,
        fallbackBgType,
        'public/og-images/og-image.png',
      )
    }

    // check filename
    const { basename: filename, extname, dirname: dirpath } = file
    if (!filename || !(filename.endsWith('.md') || filename.endsWith('.mdx'))) {
      return
    }

    // check draft & redirect
    const {
      draft,
      redirect,
      title,
      ogImage: pageOgImage,
      bgType: pageBgType,
    } = file.data.astro.frontmatter
    if (draft || redirect) {
      return
    }

    // check if it need to be skipped
    if (!title || !title.trim().length) {
      return
    }
    if (pageOgImage === false) {
      return
    }

    // check if it has been generated
    let nameWithoutExt = basename(filename, extname)
    if (nameWithoutExt === 'index' && dirpath) {
      nameWithoutExt = basename(dirpath)
    }

    const existingImage = await checkFileExistsInDir(
      'public/og-images',
      `${nameWithoutExt}.png`,
    )
    if (existingImage) {
      return
    }

    // check if it has been assigned & actually exists
    if (pageOgImage && pageOgImage !== true) {
      const assignedImageExists = await checkFileExistsInDir(
        'public/og-images',
        basename(pageOgImage),
      )
      if (assignedImageExists) {
        return
      }

      console.warn(
        `${chalk.black(getCurrentFormattedTime())} ${chalk.yellow(`[WARN] The '${pageOgImage}' specified in '${file.path}' was not found.`)}\n  ${chalk.bold('Hint:')} See ${chalk.cyan.underline('https://astro-antfustyle-theme.vercel.app/blog/about-open-graph-images/#configuring-og-images')} for more information on og image.`,
      )
      return
    }

    // get bgType
    const bgType = pageBgType || fallbackBgType

    // generate og images
    await generateOgImage(
      authorOrBrand,
      title.trim(),
      bgType,
      `public/og-images/${nameWithoutExt}.png`,
    )
  }
}

export default remarkGenerateOgImage
