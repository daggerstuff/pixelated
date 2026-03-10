// Plum animation code
const COUNT = 150

function createPlums() {
  const plumContainer = document.getElementById('plum-animation')
  if (!plumContainer) {
    return
  }

  for (let i = 0; i < COUNT; i++) {
    const plum = document.createElement('div')
    plum.className = 'plum'
    plum.style.left = `${Math.random() * 100}%`
    plum.style.top = `${Math.random() * 100}%`
    plum.style.animationDelay = `${Math.random() * 30}s`
    plum.style.animationDuration = `${Math.random() * 20 + 10}s`
    plumContainer.appendChild(plum)
  }
}

document.addEventListener('DOMContentLoaded', createPlums)
