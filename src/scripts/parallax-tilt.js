// Parallax Tilt Effect for Cards
// Implements a subtle 3D tilt effect that responds to mouse movement
// Based on the elegant card interactions seen in the Mizu theme

document.addEventListener('DOMContentLoaded', () => {
  // Select all cards that should have parallax tilt effect
  const cards = document.querySelectorAll('.card');

  cards.forEach(card => {
    // Get card dimensions
    const cardRect = card.getBoundingClientRect();
    const centerX = cardRect.left + cardRect.width / 2;
    const centerY = cardRect.top + cardRect.height / 2;

    // Add mouse move event listener
    card.addEventListener('mousemove', (e) => {
      // Calculate mouse position relative to card center
      const x = e.clientX - centerX;
      const y = e.clientY - centerY;

      // Calculate rotation angles (limited to prevent extreme tilts)
      const rotateX = (y / cardRect.height) * 10; // Max 10 degrees
      const rotateY = -(x / cardRect.width) * 10; // Max -10 degrees

      // Apply transform with perspective for 3D effect
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      // Add subtle scale increase for depth
      card.style.transform += ` scale(1.01)`;
    });

    // Reset transform on mouse leave
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
  });
});

// Add support for touch devices
// This prevents the effect from being too aggressive on mobile
if ('ontouchstart' in window) {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('touchmove', (e) => {
      e.preventDefault();

      // For touch, use a simpler version with fixed tilt
      const touch = e.touches[0];
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const x = touch.clientX - centerX;
      const y = touch.clientY - centerY;

      const rotateX = (y / rect.height) * 5; // Reduced to 5 degrees for touch
      const rotateY = -(x / rect.width) * 5; // Reduced to 5 degrees for touch

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
    });

    card.addEventListener('touchend', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
  });
}

// Add transition for smooth animations
const style = document.createElement('style');
style.textContent = `
.card {
  transition: transform 0.1s ease-out, box-shadow 0.2s ease-out;
}

.card:hover {
  box-shadow: var(--shadow-xl);
}
`;
document.head.appendChild(style);