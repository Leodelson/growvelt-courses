(() => {
  "use strict";

  const site = {
    whatsapp: "https://wa.me/2349034876746",
    getformAction: "https://getform.io/f/azyngdob",
    supabase: window.GROWVELT_SUPABASE || null,
  };

  const ready = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  };

  const toast = (message, type = "success") => {
    if (window.Toastify) {
      window.Toastify({
        text: message,
        duration: 4500,
        close: true,
        gravity: "top",
        position: "right",
        style: {
          background: type === "error" ? "#b91c1c" : "#3b0764",
          color: "#fff",
        },
      }).showToast();
      return;
    }

    const note = document.createElement("div");
    note.className = `site-toast site-toast-${type}`;
    note.textContent = message;
    document.body.appendChild(note);
    window.setTimeout(() => note.remove(), 4500);
  };

  const sanitizeFormData = (form) => {
    const formData = new FormData(form);
    const payload = {};

    formData.forEach((value, key) => {
      if (key.startsWith("_") || key === "g-recaptcha-response") return;
      payload[key] = typeof value === "string" ? value.trim() : value;
    });

    payload.source_page = window.location.pathname.split("/").pop() || "index.html";
    payload.created_at = new Date().toISOString();
    return payload;
  };

  const inferTableName = (form) => {
    if (form.dataset.supabaseTable) return form.dataset.supabaseTable;
    if (form.id === "registrationForm") return "course_registrations";
    if (form.id === "contactForm" || form.classList.contains("contact-form")) return "course_contacts";
    if (form.id === "partnerForm") return "partner_requests";
    if (form.classList.contains("newsletter-form")) return "newsletter_subscribers";
    return "course_leads";
  };

  const saveFallbackLead = (table, payload) => {
    try {
      const key = "growvelt_courses_pending_leads";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      current.push({ table, payload });
      localStorage.setItem(key, JSON.stringify(current.slice(-50)));
    } catch (error) {
      console.warn("Local lead queue failed", error);
    }
  };

  const submitToSupabase = async (table, payload) => {
    const config = site.supabase;
    if (!config || !config.url || !config.anonKey) return false;

    const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Supabase insert failed: ${response.status}`);
    }

    return true;
  };

  const submitToGetform = async (form) => {
    const action = form.getAttribute("action") || site.getformAction;
    if (!action) return false;

    const response = await fetch(action, {
      method: "POST",
      body: new FormData(form),
    });

    if (!response.ok) throw new Error(`Form fallback failed: ${response.status}`);
    return true;
  };

  const showFormMessage = (form, message, type = "success") => {
    const explicitMessage = form.querySelector("#formMessage") || document.getElementById("formMessage");
    const thankYouId = form.id === "partnerForm" ? "partner-thank-you" : "thank-you-msg";
    const thankYou = document.getElementById(thankYouId);

    if (explicitMessage) {
      explicitMessage.textContent = message;
      explicitMessage.className = `form-message form-message-${type}`;
      explicitMessage.style.opacity = "1";
    } else if (thankYou && type === "success") {
      thankYou.textContent = message;
      thankYou.style.display = "block";
    } else {
      toast(message, type);
    }
  };

  const handleManagedSubmit = async (event) => {
    event.preventDefault();

    const form = event.target;
    const table = inferTableName(form);
    const payload = sanitizeFormData(form);
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    const originalLabel = submitButton?.textContent;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (payload._gotcha) return;

    if (submitButton) {
      submitButton.disabled = true;
      if (submitButton.tagName === "BUTTON") submitButton.textContent = "Sending...";
    }

    try {
      const savedToDatabase = await submitToSupabase(table, payload);
      if (!savedToDatabase) {
        saveFallbackLead(table, payload);
        await submitToGetform(form);
      }

      form.reset();
      showFormMessage(form, "Thank you. Your submission has been received.", "success");
    } catch (error) {
      console.error(error);
      saveFallbackLead(table, payload);
      showFormMessage(form, "We could not send this right now. Please try again or contact us on WhatsApp.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        if (submitButton.tagName === "BUTTON" && originalLabel) submitButton.textContent = originalLabel;
      }
    }
  };

  window.showThankYou = handleManagedSubmit;
  window.showPartnerThankYou = handleManagedSubmit;

  window.toggleMenu = () => {
    const navMenu = document.querySelector(".nav-menu");
    const toggle = document.querySelector(".nav-toggle");
    const hamburger = document.querySelector(".hamburger");
    const isOpen = navMenu?.classList.toggle("active") || false;

    hamburger?.classList.toggle("open", isOpen);
    toggle?.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen);
  };

  const initNavigation = () => {
    const navMenu = document.querySelector(".nav-menu");
    const toggle = document.querySelector(".nav-toggle");
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    document.addEventListener(
      "click",
      (event) => {
        const navToggle = event.target.closest(".nav-toggle");
        if (navToggle) {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.toggleMenu();
          return;
        }

        const dropButton = event.target.closest(".dropdown > .dropbtn");
        if (dropButton && window.matchMedia("(max-width: 768px)").matches) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const parent = dropButton.closest(".dropdown");
          const expanded = !parent?.classList.contains("open");
          parent?.classList.toggle("open", expanded);
          dropButton.setAttribute("aria-expanded", String(expanded));
        }
      },
      true
    );

    document.querySelectorAll(".nav-menu a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      const linkPage = href.split("#")[0].split("/").pop() || "index.html";
      link.classList.toggle("active", linkPage === currentPage);

      link.addEventListener("click", () => {
        navMenu?.classList.remove("active");
        document.querySelector(".hamburger")?.classList.remove("open");
        toggle?.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      });
    });

    document.querySelectorAll(".dropdown > .dropbtn").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
  };

  const initForms = () => {
    document.querySelectorAll("form").forEach((form) => {
      const isManaged =
        form.classList.contains("newsletter-form") ||
        form.classList.contains("contact-form") ||
        form.id === "contactForm" ||
        form.id === "registrationForm" ||
        form.id === "partnerForm";

      if (!isManaged) return;
      form.dataset.managedByMain = "true";
    });

    document.addEventListener(
      "submit",
      (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.dataset.managedByMain !== "true") return;
        event.stopImmediatePropagation();
        handleManagedSubmit(event);
      },
      true
    );
  };

  const initFaqs = () => {
    document.querySelectorAll(".faq-question").forEach((question) => {
      question.setAttribute("type", "button");
      question.addEventListener("click", () => {
        const answer = question.nextElementSibling;
        if (!answer) return;

        const isOpen = answer.style.display === "block";
        document.querySelectorAll(".faq-answer").forEach((item) => {
          item.style.display = "none";
        });
        answer.style.display = isOpen ? "none" : "block";
      });
    });
  };

  const initTyping = () => {
    const typingEl = document.getElementById("typing-text");
    if (!typingEl) return;

    if (typingEl.dataset.inlineTyping === "true") return;

    const text = "Best Time to Start is Now!";
    let index = 0;
    let deleting = false;

    const tick = () => {
      typingEl.textContent = text.slice(0, index);
      if (!deleting && index < text.length) index += 1;
      else if (deleting && index > 0) index -= 1;
      else deleting = !deleting;
      const pause = index === text.length && !deleting ? 1800 : 0;
      window.setTimeout(tick, pause || (deleting ? 120 : 210));
    };

    tick();
  };

  const initAboutSlideshow = () => {
    const container = document.querySelector(".about-image");
    const original = container?.querySelector("img");
    if (!container || !original || container.dataset.slideshowReady) return;

    container.dataset.slideshowReady = "true";
    const slides = [
      original.getAttribute("src"),
      "images/technology-3435575_1280.jpg",
      "images/pexels-andrea-piacquadio-3769021.jpg",
    ].filter(Boolean);

    if (slides.length < 2) return;

    original.style.transition = "opacity 800ms ease";
    let current = 0;
    window.setInterval(() => {
      current = (current + 1) % slides.length;
      original.style.opacity = "0";
      window.setTimeout(() => {
        original.src = slides[current];
        original.style.opacity = "1";
      }, 500);
    }, 7000);
  };

  const initBeamer = () => {
    if (document.querySelector('script[src*="beamer-embed.js"]')) return;

    window.beamer_config = window.beamer_config || {
      product_id: "LWLxHVRG78518",
      user_id: "anonymous",
    };

    const script = document.createElement("script");
    script.src = "https://app.getbeamer.com/js/beamer-embed.js";
    script.defer = true;
    document.body.appendChild(script);
  };

  ready(() => {
    initNavigation();
    initForms();
    initFaqs();
    initTyping();
    initAboutSlideshow();
    initBeamer();
  });
})();
