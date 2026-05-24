(() => {
  "use strict";

  const site = {
    whatsapp: "https://wa.me/2349034876746",
    getformAction: "https://getform.io/f/azyngdob",
    supabase: window.GROWVELT_SUPABASE || null,
    coursePrices: window.GROWVELT_COURSE_PRICES || { currency: "NGN", items: {} },
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

    return { ok: true, data: null };
  };

  const callEdgeFunction = async (name, body) => {
    const config = site.supabase;
    if (!config || !config.url || !config.anonKey) {
      throw new Error("Supabase config is missing");
    }

    const response = await fetch(`${config.url.replace(/\/$/, "")}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.details || data.error || `${name} failed`);
    }

    return data;
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

  const getCoursePrice = (course) => {
    const prices = site.coursePrices?.items || {};
    const amount = prices[course];
    if (amount === null || amount === undefined || amount === "") return null;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;

    return {
      amount: numericAmount,
      currency: site.coursePrices?.currency || "NGN",
    };
  };

  const formatCoursePrice = (price) => {
    if (!price) return "Price will be confirmed by our team";

    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: price.currency,
        maximumFractionDigits: 0,
      }).format(price.amount);
    } catch {
      return `${price.currency} ${price.amount.toLocaleString()}`;
    }
  };

  const initCoursePricing = () => {
    const form = document.getElementById("registrationForm");
    const courseSelect = form?.querySelector("#course");
    const preview = form?.querySelector("#coursePricePreview strong");
    const amountInput = form?.querySelector("#payment_amount");
    const currencyInput = form?.querySelector("#payment_currency");
    if (!form || !courseSelect || !preview) return;

    const updatePrice = () => {
      const price = getCoursePrice(courseSelect.value);
      preview.textContent = courseSelect.value ? formatCoursePrice(price) : "Select a course to see the price";

      if (amountInput) amountInput.value = price ? String(price.amount) : "";
      if (currencyInput) currencyInput.value = price ? price.currency : "";
    };

    courseSelect.addEventListener("change", updatePrice);
    updatePrice();
  };

  const renderPaymentPrompt = (form, registration) => {
    if (!registration?.registration_ref) return;

    const existing = form.querySelector(".payment-prompt");
    existing?.remove();

    const wrapper = document.createElement("div");
    wrapper.className = "payment-prompt";
    wrapper.innerHTML = `
      <h3>Registration received</h3>
      <p>Your registration has been saved. You can continue to Paystack now, or wait for our team to follow up by email.</p>
      <button type="button" class="paystack-button">Continue to Paystack</button>
      <p class="payment-note">Payment is processed securely by Paystack.</p>
    `;

    const button = wrapper.querySelector(".paystack-button");
    button.addEventListener("click", async () => {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Opening Paystack...";

      try {
        const transaction = await callEdgeFunction("create-paystack-transaction", {
          registrationRef: registration.registration_ref,
        });
        if (!transaction.authorizationUrl) throw new Error("Paystack payment link was not returned");
        window.location.href = transaction.authorizationUrl;
      } catch (error) {
        console.error(error);
        button.disabled = false;
        button.textContent = originalText;
        showFormMessage(form, "Paystack could not open right now. Please try again or wait for our email.", "error");
      }
    });

    form.appendChild(wrapper);
  };

  const notifyRegistration = async (registration) => {
    if (!registration?.email || !registration?.course) return false;

    try {
      await callEdgeFunction("send-registration-email", { registration });
      return true;
    } catch (error) {
      console.warn("Registration email notification failed", error);
      return false;
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

    if (table === "course_registrations" && !payload.registration_ref) {
      payload.registration_ref =
        window.crypto?.randomUUID?.() || `reg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

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

      let emailSent = false;
      if (table === "course_registrations" && savedToDatabase) {
        emailSent = await notifyRegistration(payload);
        renderPaymentPrompt(form, payload);
      }

      form.reset();
      form.querySelector("#course")?.dispatchEvent(new Event("change"));
      showFormMessage(
        form,
        table === "course_registrations"
          ? emailSent
            ? "Thank you. Your registration has been received. We have sent the next steps to your email."
            : "Thank you. Your registration has been received. We will email your next steps shortly."
          : "Thank you. Your submission has been received.",
        "success",
      );
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
    initCoursePricing();
    initFaqs();
    initTyping();
    initAboutSlideshow();
    initBeamer();
  });
})();
