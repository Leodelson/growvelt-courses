// ====== NAV MENU TOGGLE ======
function toggleMenu() {
  const navMenu = document.querySelector('.nav-menu');
  navMenu?.classList.toggle('active');
}

// ====== ACTIVE NAV LINK HIGHLIGHT ======
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-menu a");
  const currentUrl = window.location.href;

  navLinks.forEach(link => {
    link.classList.remove("active");
    if (currentUrl.includes(link.getAttribute("href"))) {
      link.classList.add("active");
    }
  });
});

// ====== TYPING EFFECT (for pages with #typing-text) ======
document.addEventListener("DOMContentLoaded", () => {
  const typingEl = document.getElementById("typing-text");
  if (!typingEl) return;

  const text = "Best Time is Now!";
  let i = 0, isDeleting = false;

  function typeEffect() {
    const speed = isDeleting ? 80 : 120;
    typingEl.textContent = text.substring(0, i);

    if (!isDeleting && i < text.length) i++;
    else if (isDeleting && i > 0) i--;
    else {
      isDeleting = !isDeleting;
      setTimeout(typeEffect, 1000);
      return;
    }

    setTimeout(typeEffect, speed);
  }

  typeEffect();
});

// ====== ABOUT / COURSES IMAGE SLIDESHOW ======
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.about-image');
  if (!container) return;

  const orig = container.querySelector('img');
  if (!orig) return;

  const extraSlides = [
    'images/technology-3435575_1280.jpg',
    'images/pexels-andrea-piacquadio-3769021.jpg'
  ];
  const slides = [orig.src, ...extraSlides];

  orig.style.visibility = 'hidden';
  orig.setAttribute('aria-hidden', 'true');

  container.style.position = container.style.position || 'relative';
  container.style.overflow = 'hidden';

  function makeImg() {
    const i = document.createElement('img');
    i.style.position = 'absolute';
    i.style.top = 0;
    i.style.left = 0;
    i.style.width = '100%';
    i.style.height = '100%';
    i.style.objectFit = 'cover';
    i.style.borderRadius = getComputedStyle(orig).borderRadius || '10px';
    i.style.boxShadow = getComputedStyle(orig).boxShadow || '0 0 12px rgba(0,0,0,0.1)';
    i.style.transition = 'opacity 2s ease-in-out';
    i.style.opacity = 0;
    i.alt = orig.alt || '';
    return i;
  }

  let imgA = makeImg();
  let imgB = makeImg();
  container.appendChild(imgA);
  container.appendChild(imgB);

  let current = 0;
  const intervalMs = 10000, fadeMs = 2000;

  slides.forEach(src => new Image().src = src);

  imgA.src = slides[0];
  imgA.style.opacity = 1;

  function nextSlide() {
    const next = (current + 1) % slides.length;
    imgB.src = slides[next];

    imgB.style.opacity = 1;
    imgA.style.opacity = 0;

    setTimeout(() => {
      const tmp = imgA;
      imgA = imgB;
      imgB = tmp;
      current = next;
    }, fadeMs + 20);
  }

  if (slides.length > 1) {
    setTimeout(() => {
      nextSlide();
      setInterval(nextSlide, intervalMs);
    }, 1000);
  }
});

// ====== NEWSLETTER FORM (for any form using showThankYou) ======
function showThankYou(event) {
  event.preventDefault();
  const form = event.target;

  fetch(form.action, {
    method: "POST",
    body: new FormData(form)
  })
    .then(() => {
      form.style.display = "none";
      document.getElementById("thank-you-msg")?.style.display = "block";
    })
    .catch(() => {
      alert("Something went wrong. Please try again.");
    });
}

// ====== CONTACT FORM (if present) ======
document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contactForm");
  const messageDiv = document.getElementById("formMessage");
  if (!contactForm || !messageDiv) return;

  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(contactForm);

    fetch(contactForm.action, { method: "POST", body: formData })
      .then((response) => {
        if (response.ok) {
          messageDiv.textContent = "✅ Message sent successfully!";
          messageDiv.style.color = "green";
          messageDiv.style.opacity = "0";
          messageDiv.style.transition = "opacity 1s ease-in";
          setTimeout(() => (messageDiv.style.opacity = "1"), 100);
          contactForm.reset();
          setTimeout(() => (messageDiv.style.opacity = "0"), 5000);
        } else {
          messageDiv.textContent = "❌ Something went wrong. Please try again.";
          messageDiv.style.color = "red";
        }
      })
      .catch(() => {
        messageDiv.textContent = "⚠️ Network error. Please check your connection.";
        messageDiv.style.color = "red";
      });
  });
});

// ====== BEAMER (active across all pages) ======
var beamer_config = {
  product_id: 'LWLxHVRG78518',
  user_id: "user's unique id",
};

(function() {
  const script = document.createElement('script');
  script.src = "https://app.getbeamer.com/js/beamer-embed.js";
  script.defer = true;
  document.body.appendChild(script);
})();
