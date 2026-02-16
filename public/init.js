// =============================================================================
// Initialization scripts — runs before the main module bundle
// Sets up the hamburger menu and service worker
// =============================================================================

// Hamburger menu toggle (mobile — opens options panel)
const hamburgerBtn = document.getElementById('hamburger-btn');
if (hamburgerBtn) {
  hamburgerBtn.addEventListener('click', function() {
    // On mobile, hamburger opens the options panel
    const optionsBtn = document.getElementById('options-btn');
    if (optionsBtn) optionsBtn.click();
  });
}

// Register service worker for PWA / offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
}
