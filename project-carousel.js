const carousel = document.querySelector('#project-carousel');

if (carousel) {
  const track = carousel.querySelector('.project-carousel-track');
  const slides = [...carousel.querySelectorAll('.project-slide')];
  const dots = [...carousel.querySelectorAll('.project-carousel-dots button')];
  const pauseButton = carousel.querySelector('.project-carousel-pause');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentSlide = 0;
  let paused = reducedMotion.matches;

  function showSlide(index) {
    currentSlide = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    slides.forEach((slide, slideIndex) => {
      slide.setAttribute('aria-hidden', String(slideIndex !== currentSlide));
    });
    dots.forEach((dot, dotIndex) => {
      dot.setAttribute('aria-current', String(dotIndex === currentSlide));
    });
  }

  function updatePauseButton() {
    pauseButton.textContent = paused ? 'Play' : 'Pause';
    pauseButton.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
  }

  carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => showSlide(currentSlide - 1));
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => showSlide(currentSlide + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    updatePauseButton();
  });

  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showSlide(currentSlide - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showSlide(currentSlide + 1);
    }
  });

  window.setInterval(() => {
    if (paused || document.hidden) return;
    showSlide(currentSlide + 1);
  }, 5000);

  updatePauseButton();
  showSlide(0);
}
