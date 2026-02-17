/* ─────────────────────────────────────────────
   AutoReview AI — Interactive Behaviors
   Skill: scroll-experience (CSS-first motion)
   ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
    initTerminalAnimation()
    initPricingToggle()
    initScrollReveals()
    initMobileNav()
    initSmoothScroll()
})

/* ─── TERMINAL TYPING ANIMATION ─── */
function initTerminalAnimation() {
    const lines = document.querySelectorAll('.terminal-line')
    if (lines.length === 0) return

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return

                lines.forEach((line) => {
                    const delay = parseInt(line.dataset.delay, 10) || 0
                    setTimeout(() => {
                        line.classList.add('visible')
                    }, delay)
                })

                observer.unobserve(entry.target)
            })
        },
        { threshold: 0.3 }
    )

    const terminal = document.getElementById('terminalBody')
    if (terminal) {
        observer.observe(terminal)
    }
}

/* ─── PRICING TOGGLE (Monthly ↔ Annual) ─── */
function initPricingToggle() {
    const toggle = document.getElementById('billingToggle')
    const monthlyLabel = document.getElementById('toggleMonthly')
    const annualLabel = document.getElementById('toggleAnnual')
    const priceEls = document.querySelectorAll('.price-amount[data-monthly]')

    if (!toggle) return

    let isAnnual = false

    monthlyLabel.classList.add('active')

    function updatePrices() {
        priceEls.forEach((el) => {
            const value = isAnnual ? el.dataset.annual : el.dataset.monthly
            el.style.opacity = '0'
            el.style.transform = 'translateY(-8px)'

            setTimeout(() => {
                el.textContent = value
                el.style.opacity = '1'
                el.style.transform = 'translateY(0)'
            }, 150)
        })

        if (isAnnual) {
            toggle.classList.add('active')
            annualLabel.classList.add('active')
            monthlyLabel.classList.remove('active')
        } else {
            toggle.classList.remove('active')
            monthlyLabel.classList.add('active')
            annualLabel.classList.remove('active')
        }
    }

    toggle.addEventListener('click', () => {
        isAnnual = !isAnnual
        updatePrices()
    })

    monthlyLabel.addEventListener('click', () => {
        if (isAnnual) {
            isAnnual = false
            updatePrices()
        }
    })

    annualLabel.addEventListener('click', () => {
        if (!isAnnual) {
            isAnnual = true
            updatePrices()
        }
    })
}

/* ─── SCROLL REVEALS ─── */
function initScrollReveals() {
    const reveals = document.querySelectorAll('.reveal')
    if (reveals.length === 0) return

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible')
                    observer.unobserve(entry.target)
                }
            })
        },
        {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px',
        }
    )

    reveals.forEach((el) => observer.observe(el))
}

/* ─── MOBILE NAV ─── */
function initMobileNav() {
    const navToggle = document.getElementById('navToggle')
    const navLinks = document.getElementById('navLinks')

    if (!navToggle || !navLinks) return

    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open')
    })

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open')
        })
    })
}

/* ─── SMOOTH SCROLL ─── */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href')
            if (targetId === '#') return

            const target = document.querySelector(targetId)
            if (!target) return

            e.preventDefault()
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            })
        })
    })
}
