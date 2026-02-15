// =============================================================================
// Initialization scripts — runs before the main module bundle
// Sets up the hamburger menu and service worker
// =============================================================================

// Hamburger menu toggle (mobile sidebar)
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.querySelector('.left-sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
if (hamburgerBtn && sidebar && backdrop) {
  function toggleSidebar() {
    const isOpen = sidebar.classList.toggle('open');
    backdrop.classList.toggle('active', isOpen);
    hamburgerBtn.textContent = isOpen ? '✕' : '☰';
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
  }
  hamburgerBtn.addEventListener('click', toggleSidebar);
  backdrop.addEventListener('click', toggleSidebar);
  // Close sidebar when a button inside it is clicked (on mobile)
  sidebar.addEventListener('click', function(e) {
    if (window.innerWidth < 768 && (e.target.tagName === 'BUTTON' || e.target.closest('button'))) {
      setTimeout(toggleSidebar, 300);
    }
  });
}

// Register service worker for PWA / offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
}
