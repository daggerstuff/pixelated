import React from 'react'
const { createElement } = React
const startTransition = React.startTransition || ((cb) => cb())

import { createRoot, hydrateRoot } from 'react-dom/client'
import StaticHtml from './static-html.js'

function isAlreadyHydrated(element) {
  for (const key in element) {
    if (key.startsWith('__reactContainer')) {
      return key
    }
  }
}

function createReactElementFromDOMElement(element) {
  let attrs = {}
  for (const attr of element.attributes) {
    attrs[attr.name] = attr.value
  }
  // If the element has no children, we can create a simple React element
  if (element.firstChild === null) {
    return createElement(element.localName, attrs)
  }

  return createElement(
    element.localName,
    attrs,
    Array.from(element.childNodes)
      .map((c) => {
        if (c.nodeType === Node.TEXT_NODE) {
          return c.data
        } else if (c.nodeType === Node.ELEMENT_NODE) {
          return createReactElementFromDOMElement(c)
        } else {
          return undefined
        }
      })
      .filter((a) => !!a),
  )
}

function getChildren(childString, experimentalReactChildren) {
  if (experimentalReactChildren && childString) {
    let children = []
    let template = document.createElement('template')
    template.innerHTML = childString
    for (let child of template.content.children) {
      children.push(createReactElementFromDOMElement(child))
    }
    return children
  } else if (childString) {
    return createElement(StaticHtml, { value: childString })
  } else {
    return undefined
  }
}

export default (element) =>
  (Component, props, { default: children, ...slotted }, { client }) => {
    if (!element.hasAttribute('ssr')) {
      return
    }
    const renderOptions = {
      identifierPrefix: element.getAttribute('prefix'),
    }
    for (const [key, value] of Object.entries(slotted)) {
      props[key] = createElement(StaticHtml, { value, name: key })
    }

    const componentEl = createElement(
      Component,
      props,
      getChildren(children, element.hasAttribute('data-react-children')),
    )

    // Reuse the existing root if available to avoid aggressive warnings and unnecessary re-mounting
    if (element._astroReactRoot) {
      const root = element._astroReactRoot
      startTransition(() => {
        root.render(componentEl)
      })
      return
    }

    const rootKey = isAlreadyHydrated(element)
    // HACK: delete internal react marker for nested components to suppress aggressive warnings
    // This handles cases where the root was not stored (legacy or external) but the marker exists.
    if (rootKey) {
      delete element[rootKey]
    }
    if (client === 'only') {
      return startTransition(() => {
        const root = createRoot(element)
        root.render(componentEl)
        element._astroReactRoot = root
        element.addEventListener(
          'astro:unmount',
          () => {
            root.unmount()
            delete element._astroReactRoot
          },
          {
            once: true,
          },
        )
      })
    }
    startTransition(() => {
      const root = hydrateRoot(element, componentEl, renderOptions)
      root.render(componentEl)
      element._astroReactRoot = root
      element.addEventListener(
        'astro:unmount',
        () => {
          root.unmount()
          delete element._astroReactRoot
        },
        {
          once: true,
        },
      )
    })
  }
