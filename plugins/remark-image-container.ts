/**
 * @description Register directive nodes in mdast.
 * @see https://github.com/remarkjs/remark-directive?tab=readme-ov-file#types
 */
import type { PhrasingContent, Root } from 'mdast'
import type { Directives } from 'mdast-util-directive'
import type { Node } from 'unist'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'

const IMAGE_DIR_REGEXP = /^image-(.*)/
const VALID_TAGS_FOR_IMG = new Set<string>([
  'div',
  'span',
  'section',
  'article',
  'main',
  'aside',
  'header',
  'footer',
  'nav',
  'fieldset',
  'form',
])

/**
 * Convert `:::image-*` into container elements for images.
 */
function remarkImageContainer() {
  const isDirectiveNode = (node: Node): node is Directives =>
    (node.type === 'containerDirective' ||
      node.type === 'leafDirective' ||
      node.type === 'textDirective') &&
    'name' in node &&
    'attributes' in node &&
    'children' in node &&
    'data' in node

  /**
   * @param {import('mdast').Root} tree
   *   Tree.
   * @param {import('vfile').VFile} file
   *   File.
   */
  return (tree: Root, file: VFile) => {
    visit(tree, (node: Node) => {
      if (!isDirectiveNode(node)) {
        return
      }

      const d = node

      if (d.name === 'image-figure') {
        /* image-figure */
        const data = d.data ?? (d.data = {})
        const attributes = d.attributes ?? {}
        const { children } = d

        // add figure node
        data.hName = 'figure'

        // handle figcaption text
        // priority: content inside [] of `:::image-figure[]{}`、`![]()`
        let content: PhrasingContent[]
        const firstChild = children[0]
        if (
          firstChild?.type === 'paragraph' &&
          firstChild.data?.directiveLabel &&
          firstChild.children[0]?.type === 'text'
        ) {
          content = firstChild.children
          children.shift()
        } else if (
          firstChild?.type === 'paragraph' &&
          firstChild.children[0]?.type === 'image' &&
          firstChild.children[0].alt
        ) {
          content = [
            {
              type: 'text',
              value: firstChild.children[0].alt,
            },
          ]
        } else {
          file.fail(
            'The figcaption text is missing in the `image-figure` directive. Specify it in the `[]` of `:::image-figure[]{}` or `![]()`.',
            d,
          )
        }

        // add figcaption node
        children.push({
          type: 'paragraph',
          data: {
            hName: 'figcaption',
            hProperties: attributes,
          },
          children: content,
        })
      } else if (d.name === 'image-a') {
        /* image-a */
        if (!d.attributes?.['href']) {
          file.fail(
            'Unexpectedly missing `href` in the `image-a` directive.',
            d,
          )
        }

        const data = d.data ?? (d.data = {})
        const attributes = d.attributes ?? {}

        data.hName = 'a'
        data.hProperties = attributes
      } else if (d.name.match(IMAGE_DIR_REGEXP)) {
        /* image-* */
        const match = IMAGE_DIR_REGEXP.exec(d.name)
        if (match?.[1] && VALID_TAGS_FOR_IMG.has(match[1])) {
          const data = d.data ?? (d.data = {})
          const attributes = d.attributes ?? {}

          data.hName = match[1]
          data.hProperties = attributes
        } else {
          file.fail('The `image-*` directive failed to match a valid tag.', d)
        }
      }
    })
  }
}

export default remarkImageContainer
