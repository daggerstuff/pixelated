; (function () {
    try {
        // Minimal feature probe to satisfy lint; no side effects
        const supportsFetch = typeof window !== 'undefined' && 'fetch' in window
        if (supportsFetch) {
            // noop branch to keep variable used
            void 0
        }
    } catch (e) {
        // swallow
    }
})()
