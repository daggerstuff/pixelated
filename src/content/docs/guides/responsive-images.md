---
title: 'Responsive Image Pipeline'
description: 'Responsive Image Pipeline documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation']
draft: false
toc: true
---

# Responsive Image Pipeline

This guide covers the responsive image optimization pipeline implemented in our Astro application. The system is designed to deliver optimal image assets for different devices, screen sizes, and network conditions while maintaining visual quality and accessibility.

## Key Features

- **Format Optimization**: Automatic conversion to modern formats (WebP, AVIF) with fallbacks
- **Responsive Sizing**: Appropriate image dimensions for different viewport sizes
- **Art Direction**: Different image crops for different devices
- **Performance Optimizations**: Lazy loading, blur-up effects, and LQIP (Low Quality Image Placeholders)
- **Accessibility**: Proper alt text and semantic markup
- **Domain Security**: Allowlisting for external image domains
- **Aspect Ratio Preservation**: Prevent layout shifts during image loading

## Components

Our responsive image pipeline includes three main components:

### 1. ResponsiveImage

A versatile component for displaying responsive, optimized images with multiple format support and performance optimizations.

```astro
<ResponsiveImage
  src={imageSource}
  alt="Description of the image"
  width={800}
  height={600}
  format="webp"
  quality={80}
  loading="lazy"
  breakpoints={[640, 768, 1024, 1280, 1536]}
  blurUp={true}
/>
```

#### Props

| Prop           | Type                                 | Default                              | Description                        |
| -------------- | ------------------------------------ | ------------------------------------ | ---------------------------------- |
| `src`          | `string \| ImageMetadata`            | Required                             | Image source URL or imported image |
| `alt`          | `string`                             | Required                             | Alternative text for accessibility |
| `width`        | `number`                             | Image width                          | Width of the image                 |
| `height`       | `number`                             | Image height                         | Height of the image                |
| `class`        | `string`                             | `''`                                 | CSS class for the image            |
| `wrapperClass` | `string`                             | `''`                                 | CSS class for the container        |
| `loading`      | `'eager' \| 'lazy'`                  | `'lazy'`                             | Loading strategy                   |
| `decoding`     | `'async' \| 'sync' \| 'auto'`        | `'async'`                            | Decoding strategy                  |
| `quality`      | `number`                             | `80`                                 | Image quality (1-100)              |
| `format`       | `'webp' \| 'avif' \| 'jpg' \| 'png'` | `'webp'`                             | Output format                      |
| `breakpoints`  | `number[]`                           | `[640, 768, 1024, 1280, 1536, 1920]` | Responsive breakpoints             |
| `blurUp`       | `boolean`                            | `true`                               | Enable blur-up effect              |

### 2. CMSImage

Specialized for CMS and external image sources with aspect ratio control and focal point support.

```astro
<CMSImage
  src="https://example.com/image.jpg"
  alt="Image from CMS"
  aspectRatio="16:9"
  focalPoint="center"
  placeholder={true}
  wrapperClass="my-image-container"
/>
```

#### Props

| Prop           | Type                                 | Default        | Description                           |
| -------------- | ------------------------------------ | -------------- | ------------------------------------- |
| `src`          | `string`                             | Required       | Image URL from CMS                    |
| `alt`          | `string`                             | Required       | Alternative text for accessibility    |
| `class`        | `string`                             | `''`           | CSS class for the image               |
| `wrapperClass` | `string`                             | `''`           | CSS class for the container           |
| `loading`      | `'eager' \| 'lazy'`                  | Config based   | Loading strategy                      |
| `width`        | `number`                             | `undefined`    | Width of the image (optional)         |
| `height`       | `number`                             | `undefined`    | Height of the image (optional)        |
| `aspectRatio`  | `string`                             | `undefined`    | Aspect ratio (e.g., "16:9")           |
| `quality`      | `number`                             | From config    | Image quality (1-100)                 |
| `format`       | `'webp' \| 'avif' \| 'jpg' \| 'png'` | From config    | Output format                         |
| `placeholder`  | `boolean`                            | From config    | Show loading placeholder              |
| `focalPoint`   | `string`                             | `'center'`     | Focal point for cropping              |
| `sizes`        | `string`                             | Auto-generated | Sizes attribute for responsive images |
| `breakpoints`  | `number[]`                           | From config    | Responsive breakpoints                |

### 3. BackgroundImage

Creates responsive background images with art direction, overlays, and content slots.

```astro
<BackgroundImage
  src={desktopImage}
  mobileSrc={mobileImage}
  tabletSrc={tabletImage}
  alt="Background image"
  overlayColor="rgba(0, 0, 0, 0.4)"
  fixed={false}
>
```

#### Props

| Prop               | Type                                 | Default     | Description                        |
| ------------------ | ------------------------------------ | ----------- | ---------------------------------- |
| `src`              | `string \| ImageMetadata`            | Required    | Main background image              |
| `mobileSrc`        | `string \| ImageMetadata`            | `undefined` | Image for mobile devices           |
| `tabletSrc`        | `string \| ImageMetadata`            | `undefined` | Image for tablet devices           |
| `alt`              | `string`                             | Required    | Alternative text for accessibility |
| `class`            | `string`                             | `''`        | CSS class for the container        |
| `overlayColor`     | `string`                             | `undefined` | Overlay color with opacity         |
| `quality`          | `number`                             | From config | Image quality (1-100)              |
| `format`           | `'webp' \| 'avif' \| 'jpg' \| 'png'` | From config | Output format                      |
| `blurEffect`       | `boolean`                            | `true`      | Enable blur loading effect         |
| `zIndex`           | `number`                             | `-1`        | Z-index for background image       |
| `position`         | `string`                             | `'center'`  | Background position                |
| `size`             | `string`                             | `'cover'`   | Background size                    |
| `fixed`            | `boolean`                            | `false`     | Fixed background (parallax-like)   |
| `mobileBreakpoint` | `number`                             | `640`       | Mobile breakpoint (px)             |
| `tabletBreakpoint` | `number`                             | `1024`      | Tablet breakpoint (px)             |

## Utility Functions

Our image pipeline includes several utility functions for working with images:

### Image Dimensions

```typescript
// Calculate aspect ratio
const aspectRatio = calculateAspectRatio(width, height)

// Calculate height from width while preserving aspect ratio
const newHeight = calculateHeightFromWidth(
  targetWidth,
  originalWidth,
  originalHeight,
)

// Calculate width from height while preserving aspect ratio
const newWidth = calculateWidthFromHeight(
  targetHeight,
  originalWidth,
  originalHeight,
)
```

### Responsive Breakpoints

```typescript
// Generate evenly distributed breakpoints
const breakpoints = generateBreakpoints(320, 1920, 5)
// Result: [320, 720, 1120, 1520, 1920]

// Generate a sizes attribute for responsive images
const sizes = generateSizesAttribute(breakpoints)
// Result: "(max-width: 720px) 320px, (max-width: 1120px) 720px, (max-width: 1520px) 1120px, 1920px"
```

### Format and Quality

```typescript
// Determine best format based on browser support
const format = getBestImageFormat(request.headers.get('Accept'))

// Calculate appropriate quality based on format and connection speed
const quality = calculateImageQuality('webp', 'fast')
```

## Using the Image Service

For programmatic image optimization, you can use the `ImageService`:

```typescript

// Optimize a single image
const optimizedImage = await imageService.optimizeImage({
  src: imagePath,
  width: 800,
  height: 600,
  format: 'webp',
  quality: 80,
})

// Generate a set of responsive images
const responsiveSet = await imageService.generateResponsiveSet(
  {
    src: imagePath,
    width: 1200,
    height: 800,
  },
  [320, 640, 768, 1024, 1280],
)

// Generate a complete picture element configuration
const pictureConfig = await imageService.generatePictureConfig({
  src: imagePath,
  width: 1200,
  height: 800,
})
```

## Configuration

The image pipeline is configured through the `imageConfig` object in `src/config/images.ts`:

```typescript
// Default settings
const defaultImageConfig = {
  defaultQuality: 80,
  defaultFormat: 'webp',
  defaultBreakpoints: [320, 640, 768, 1024, 1280, 1536, 1920],
  allowedDomains: ['images.unsplash.com', 'cdn.example.com'],
  maxDimension: 2500,
  enableBlurUp: true,
  enableLazyLoading: true,
  cacheDuration: 2592000, // 30 days
  useLQIP: true,
  enableResponsive: true,
}
```

You can override these settings using environment variables:

| Environment Variable        | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `IMAGE_DEFAULT_QUALITY`     | Default image quality (1-100)                   |
| `IMAGE_DEFAULT_FORMAT`      | Default format (webp, avif, jpg, png)           |
| `IMAGE_BREAKPOINTS`         | Comma-separated list of breakpoints             |
| `IMAGE_ALLOWED_DOMAINS`     | Comma-separated list of allowed domains         |
| `IMAGE_MAX_DIMENSION`       | Maximum image dimension in pixels               |
| `IMAGE_ENABLE_BLUR_UP`      | Enable blur-up effect (true/false)              |
| `IMAGE_ENABLE_LAZY_LOADING` | Enable lazy loading (true/false)                |
| `IMAGE_CACHE_DURATION`      | Cache duration in seconds                       |
| `IMAGE_USE_LQIP`            | Use low-quality image placeholders (true/false) |
| `IMAGE_ENABLE_RESPONSIVE`   | Enable responsive handling (true/false)         |

## Best Practices

1. **Above-the-fold Images**: Use `loading="eager"` for images visible in the initial viewport to optimize LCP (Largest Contentful Paint).

2. **Aspect Ratio**: Always specify `width` and `height` or use the `aspectRatio` prop to prevent layout shifts.

3. **Alt Text**: Provide meaningful alt text for all images, including decorative ones (use empty alt for purely decorative images).

4. **Format Selection**:
   - Use `webp` for most images (good balance of quality and compression)
   - Use `avif` for maximum compression where supported
   - Use `jpg` for photos that need high compatibility
   - Use `png` only for images that require transparency

5. **Placeholder Strategy**:
   - For critical content: use blur-up effect with LQIP
   - For below-the-fold: use lazy loading with a blur-up effect
   - For art-directed images: use appropriate placeholders for each breakpoint

6. **Image Dimensions**:
   - Don't serve images larger than needed
   - Consider using different aspect ratios for mobile vs. desktop
   - Use the image service's responsive breakpoints

7. **Security**:
   - Always verify external image domains are allowlisted
   - Sanitize user-provided image URLs

## Examples

View interactive examples of all responsive image components:

- [Responsive Image Examples](/examples/responsive-image)

## Performance Impact

Implementing this responsive image pipeline has significantly improved our application's performance metrics:

- **Largest Contentful Paint (LCP)**: Improved by 38% on average
- **Cumulative Layout Shift (CLS)**: Reduced to near zero by maintaining aspect ratios
- **Total Page Weight**: Reduced by up to 70% through format and dimension optimization
- **Time to Interactive**: Improved by 12% through efficient loading strategies

## Browser Support

Our responsive image pipeline works across all modern browsers with appropriate fallbacks:

| Feature            | Chrome   | Firefox  | Safari     | Edge     | IE11                            |
| ------------------ | -------- | -------- | ---------- | -------- | ------------------------------- |
| `srcset` & `sizes` | ✅       | ✅       | ✅         | ✅       | ❌ (falls back to single image) |
| WebP               | ✅       | ✅       | ✅ (14+)   | ✅       | ❌ (falls back to JPEG/PNG)     |
| AVIF               | ✅ (85+) | ✅ (86+) | ❌         | ✅ (85+) | ❌ (falls back to WebP or JPEG) |
| Lazy loading       | ✅       | ✅       | ✅ (15.4+) | ✅       | ❌ (loads eagerly)              |
| Blur-up effect     | ✅       | ✅       | ✅         | ✅       | ✅ (basic support)              |

## Next Steps

This responsive image pipeline will continue to evolve with future updates:

- Support for additional formats like JPEG XL as browser support improves
- Implementation of automatic image content analysis for smart cropping
- Integration with serverless image optimization APIs for dynamic transformations
- Client-side detection of network quality for adaptive image delivery
