---
title: 'Reusable Snippets'
description: 'Reusable, custom snippets to keep content in sync'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
icon: 'recycle'
---


## Creating a custom snippet

**Pre-condition**: You must create your snippet file in the `snippets` directory.

  Any page in the `snippets` directory will be treated as a snippet and will not
  be rendered into a standalone page. If you want to create a standalone page
  from the snippet, import the snippet into another file and call it as a
  component.

### Default export

1. Add content to your snippet file that you want to re-use across multiple
   locations. Optionally, you can add variables that can be filled in via props
   when you import the snippet.

```bash
Hello world! This is my content I want to reuse across pages. My keyword of the
day is {word}.
```

  The content that you want to reuse must be inside the `snippets` directory in
  order for the import to work.

2. Import the snippet into your destination file.

```mdx destination-file.mdx
---
title: My title
description: My Description
---


## Header

Lorem impsum dolor sit amet.

```

### Reusable variables

1. Export a variable from your snippet file:

```mdx snippets/path/to/custom-variables.mdx


;
```

2. Import the snippet from your destination file and use the variable:

```mdx destination-file.mdx
---
title: My title
description: My Description
---


Hello, my name is {myName} and I like {myObject.fruit}.
```

### Reusable components

1. Inside your snippet file, create a component that takes in props by exporting
   your component in the form of an arrow function.

```mdx snippets/custom-component.mdx
)

;
```

  MDX does not compile inside the body of an arrow function. Stick to HTML
  syntax when you can or use a default export if you need to use MDX.

2. Import the snippet into your destination file and pass in the props

```mdx destination-file.mdx
---
title: My title
description: My Description
---


Lorem ipsum dolor sit amet.

```
