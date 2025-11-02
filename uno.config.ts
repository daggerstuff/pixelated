import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno({
      // Enable all default rules
      preflight: true,
      rules: [
        // Handle class-variance-authority generated classes
        [/^class-variance-authority-(.+)$/, ([, c]) => ({ class: c })],
        // Handle Tailwind-like classes (which are actually UnoCSS classes)
        [/^text-([a-zA-Z0-9-]+)$/, ([, c]) => ({ color: c })],
        [/^bg-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'background-color': c })],
        [/^border-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'border-color': c })],
        [/^p-([a-zA-Z0-9-]+)$/, ([, c]) => ({ padding: c })],
        [/^px-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'padding-left': c, 'padding-right': c })],
        [/^py-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'padding-top': c, 'padding-bottom': c })],
        [/^pt-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'padding-top': c })],
        [/^pb-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'padding-bottom': c })],
        [/^pl-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'padding-left': c })],
        [/^pr-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'padding-right': c })],
        [/^m-([a-zA-Z0-9-]+)$/, ([, c]) => ({ margin: c })],
        [/^mx-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'margin-left': c, 'margin-right': c })],
        [/^my-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'margin-top': c, 'margin-bottom': c })],
        [/^mt-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'margin-top': c })],
        [/^mb-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'margin-bottom': c })],
        [/^ml-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'margin-left': c })],
        [/^mr-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'margin-right': c })],
        [/^w-([a-zA-Z0-9-]+)$/, ([, c]) => ({ width: c })],
        [/^h-([a-zA-Z0-9-]+)$/, ([, c]) => ({ height: c })],
        [/^max-w-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'max-width': c })],
        [/^max-h-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'max-height': c })],
        [/^min-w-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'min-width': c })],
        [/^min-h-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'min-height': c })],
        [/^flex-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'flex': c })],
        [/^grid-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'display': 'grid', 'grid-template-columns': c })],
        [/^gap-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'gap': c })],
        [/^rounded-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'border-radius': c })],
        [/^shadow-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'box-shadow': c })],
        [/^opacity-([a-zA-Z0-9-]+)$/, ([, c]) => ({ opacity: c })],
        [/^z-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'z-index': c })],
        [/^absolute$/, () => ({ position: 'absolute' })],
        [/^relative$/, () => ({ position: 'relative' })],
        [/^fixed$/, () => ({ position: 'fixed' })],
        [/^inset-([a-zA-Z0-9-]+)$/, ([, c]) => ({ inset: c })],
        [/^top-([a-zA-Z0-9-]+)$/, ([, c]) => ({ top: c })],
        [/^bottom-([a-zA-Z0-9-]+)$/, ([, c]) => ({ bottom: c })],
        [/^left-([a-zA-Z0-9-]+)$/, ([, c]) => ({ left: c })],
        [/^right-([a-zA-Z0-9-]+)$/, ([, c]) => ({ right: c })],
        [/^text-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'font-size': c })],
        [/^font-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'font-weight': c })],
        [/^leading-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'line-height': c })],
        [/^tracking-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'letter-spacing': c })],
        [/^italic$/, () => ({ 'font-style': 'italic' })],
        [/^normal-case$/, () => ({ 'text-transform': 'none' })],
        [/^uppercase$/, () => ({ 'text-transform': 'uppercase' })],
        [/^lowercase$/, () => ({ 'text-transform': 'lowercase' })],
        [/^capitalize$/, () => ({ 'text-transform': 'capitalize' })],
        [/^truncate$/, () => ({ 'overflow': 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' })],
        [/^whitespace-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'white-space': c })],
        [/^overflow-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'overflow': c })],
        [/^text-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'color': c })],
        [/^cursor-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'cursor': c })],
        [/^pointer-events-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'pointer-events': c })],
        [/^user-select-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'user-select': c })],
        [/^transform$/, () => ({ 'transform': 'translate(0, 0)' })],
        [/^transition-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'transition-property': c })],
        [/^duration-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'transition-duration': c })],
        [/^ease-([a-zA-Z0-9-]+)$/, ([, c]) => ({ 'transition-timing-function': c })],
        [/^hover:(.+)$/, ([, c]) => ({ '&:hover': { class: c } })],
        [/^focus:(.+)$/, ([, c]) => ({ '&:focus': { class: c } })],
        [/^active:(.+)$/, ([, c]) => ({ '&:active': { class: c } })],
        [/^disabled:(.+)$/, ([, c]) => ({ '&:disabled': { class: c } })],
        [/^group-hover:(.+)$/, ([, c]) => ({ '.group:hover &': { class: c } })],
        [/^peer-hover:(.+)$/, ([, c]) => ({ '.peer:hover ~ &': { class: c } })],
        [/^first:(.+)$/, ([, c]) => ({ '&:first-child': { class: c } })],
        [/^last:(.+)$/, ([, c]) => ({ '&:last-child': { class: c } })],
        [/^odd:(.+)$/, ([, c]) => ({ '&:nth-child(odd)': { class: c } })],
        [/^even:(.+)$/, ([, c]) => ({ '&:nth-child(even)': { class: c } })],
        [/^before:(.+)$/, ([, c]) => ({ '&::before': { class: c } })],
        [/^after:(.+)$/, ([, c]) => ({ '&::after': { class: c } })],
      ],
    }),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: false, // Suppress warnings for missing icons
      // Use CDN by default, fallback to local packages if available
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        // Custom validation for icon names
        custom: {
          // This will be used for invalid icon names
          'question': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>',
        }
      }
    }),
  ],
  shortcuts: {
    'btn': 'px-4 py-2 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50',
    'icon-btn': 'text-[0.9em] inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600',
  },
  rules: [
    [/^text-([a-zA-Z0-9-]+)$/, ([, c]) => ({ color: c })],
    [/^class-variance-authority-(.+)$/, ([, c]) => ({ class: c })],
  ],
})
