/* global document */
const backdrop = document.querySelector('.backdrop');
const sideDrawer = document.querySelector('.mobile-nav');
const menuToggle = document.querySelector('#side-menu-toggle');

function closeMenu() {
  if (!backdrop || !sideDrawer || !menuToggle) return;
  backdrop.style.display = 'none';
  sideDrawer.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

function openMenu() {
  if (!backdrop || !sideDrawer || !menuToggle) return;
  backdrop.style.display = 'block';
  sideDrawer.classList.add('open');
  menuToggle.setAttribute('aria-expanded', 'true');
}

if (backdrop && sideDrawer && menuToggle) {
  menuToggle.addEventListener('click', openMenu);
  document.querySelectorAll('[data-menu-close]').forEach((element) => {
    element.addEventListener('click', closeMenu);
  });
}
