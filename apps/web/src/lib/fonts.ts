// Centralized font imports — all layouts import from here to ensure
// consistent font loading and avoid duplicate <style> injection.
// Big Shoulders Display carries the drafting-sheet headline on public
// surfaces (condensed 600–800, uppercase); Instrument Sans Variable carries
// reading and interface text; IBM Plex Mono is the drafting spec voice
// (labels, dimensions, ticks); Spline Sans Mono remains app telemetry.
// Big Shoulders ships no `./*.css` export map entry, so the weight files are
// imported without an extension.
import '@fontsource/big-shoulders-display/latin-600'
import '@fontsource/big-shoulders-display/latin-700'
import '@fontsource/big-shoulders-display/latin-800'
import '@fontsource/instrument-serif'
import '@fontsource-variable/instrument-sans'
import '@fontsource-variable/spline-sans-mono'
import '@fontsource/ibm-plex-mono'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource-variable/literata'
