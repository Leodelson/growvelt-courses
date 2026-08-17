(() => {
  "use strict";

  const config = window.GROWVELT_SUPABASE || {};
  const supabaseFactory = window.supabase?.createClient;
  const client = config.url && config.anonKey && supabaseFactory
    ? supabaseFactory(config.url, config.anonKey)
    : null;

  const ready = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  };

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  const showMessage = (element, message, type = "success") => {
    if (!element) return;
    element.textContent = message;
    element.className = `form-message form-message-${type}`;
    element.style.opacity = "1";
  };

  const notify = (message, type = "success") => {
    if (window.Toastify) {
      window.Toastify({
        text: message,
        duration: 4200,
        close: true,
        gravity: "top",
        position: "right",
        style: {
          background: type === "error" ? "#b91c1c" : "#4b0082",
          color: "#fff",
        },
      }).showToast();
      return;
    }

    const note = document.createElement("div");
    note.className = `site-toast site-toast-${type}`;
    note.textContent = message;
    document.body.appendChild(note);
    window.setTimeout(() => note.remove(), 4200);
  };

  const setButtonLoading = (button, isLoading, loadingText = "Please wait...") => {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.classList.add("is-loading");
      button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>${loadingText}</span>`;
      return;
    }

    button.disabled = false;
    button.classList.remove("is-loading");
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  };

  const setAuthBusy = (buttons, activeButton, isBusy, loadingText) => {
    buttons.forEach((button) => {
      if (button === activeButton) {
        setButtonLoading(button, isBusy, loadingText);
      } else {
        button.disabled = isBusy;
      }
    });
  };

  const dashboardForRole = (role) => {
    if (role === "admin") return "admin-dashboard.html";
    if (role === "instructor") return "instructor-dashboard.html";
    return "learner-dashboard.html";
  };

  const getCleanPath = (page) => {
    if (window.location.hostname === "localhost" || window.location.protocol === "file:") return page;
    return page.replace(/\.html$/, "");
  };

  const getSession = async () => {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data?.session || null;
  };

  const upsertProfile = async (user, fullName) => {
    if (!client || !user?.id) return null;

    const profile = {
      id: user.id,
      full_name: fullName || user.user_metadata?.full_name || "",
      email: user.email || "",
      onboarding_status: "complete",
    };

    const { data, error } = await client
      .from("profiles")
      .upsert(profile, { onConflict: "id" })
      .select("id, full_name, email, account_type, onboarding_status")
      .single();

    if (error) throw error;
    return data;
  };

  const requestInstructorApplication = async (user, shouldApply) => {
    if (!client || !user?.id || !shouldApply) return null;

    const { data: existing, error: existingError } = await client
      .from("instructor_profiles")
      .select("id, user_id, approval_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data, error } = await client
      .from("instructor_profiles")
      .insert({ user_id: user.id })
      .select("id, user_id, approval_status")
      .single();

    if (error) throw error;
    return data;
  };

  const fetchProfile = async (user) => {
    if (!client || !user?.id) return null;

    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, email, account_type, onboarding_status")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const hasAdminCapability = async () => {
    if (!client) return false;
    const { data, error } = await client.rpc("is_growvelt_learning_admin");
    if (error) {
      console.warn("Admin capability check failed", error);
      return false;
    }
    return data === true;
  };

  const hasApprovedInstructorCapability = async () => {
    if (!client) return false;
    const { data, error } = await client.rpc("is_approved_growvelt_instructor");
    if (error) {
      console.warn("Instructor capability check failed", error);
      return false;
    }
    return data === true;
  };

  const formatPrice = (course) => {
    if (course.is_free) return "Free";
    const amount = Number(course.price_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return "Price on request";

    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: course.price_currency || "NGN",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${course.price_currency || "NGN"} ${amount.toLocaleString()}`;
    }
  };

  const fallbackCourseImage = (course) => {
    const title = `${course.title || ""} ${course.category || ""}`.toLowerCase();
    if (title.includes("science")) return "images/Data Science.png";
    if (title.includes("social")) return "images/Social Media.png";
    if (title.includes("graphic")) return "images/illustrator.png";
    if (title.includes("web")) return "images/Building Dashboard Classes.png";
    if (title.includes("cyber")) return "images/technology-7111798_1280.jpg";
    return "images/Data Analysis.png";
  };

  const courseDetailsUrl = (course) => {
    const slug = course.slug || String(course.id || "");
    return `course-details.html?slug=${encodeURIComponent(slug)}`;
  };

  const courseLearnUrl = (course) => {
    const slug = course.slug || String(course.id || "");
    return `course-learn.html?slug=${encodeURIComponent(slug)}`;
  };

  const registrationUrl = (course) => {
    return `registration.html?course=${encodeURIComponent(course.title || "")}`;
  };

  const slugify = (value) => {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
  };

  const createCourseCard = (course) => {
    const card = document.createElement("div");
    card.className = "course-card";

    const image = document.createElement("img");
    image.src = course.thumbnail_url || fallbackCourseImage(course);
    image.alt = course.title || "Growvelt Learning course";

    const info = document.createElement("div");
    info.className = "course-info";

    const title = document.createElement("h3");
    title.textContent = course.title || "Growvelt Learning Course";

    const summary = document.createElement("p");
    summary.textContent = course.summary || "Practical course designed to help learners build job-ready skills.";

    const meta = document.createElement("p");
    meta.className = "course-live-meta";
    meta.textContent = [course.category, course.level, formatPrice(course)].filter(Boolean).join(" | ");

    const footer = document.createElement("div");
    footer.className = "course-footer";

    const details = document.createElement("a");
    details.href = courseDetailsUrl(course);
    details.className = "enroll-btn";
    details.textContent = "View Details";

    const enroll = document.createElement("a");
    enroll.href = registrationUrl(course);
    enroll.className = "enroll-btn";
    enroll.textContent = "Enroll Now";

    footer.append(details, enroll);
    info.append(title, summary, meta, footer);
    card.append(image, info);
    return card;
  };

  const bindCatalogSearch = () => {
    const searchInput = document.getElementById("courseSearch");
    const searchButton = document.getElementById("searchBtn");
    const courseContainer = document.querySelector("[data-course-catalog]");
    if (!searchInput || !courseContainer) return;

    const filterCourses = () => {
      const query = searchInput.value.trim().toLowerCase();
      const cards = Array.from(courseContainer.querySelectorAll(".course-card"));
      let visible = 0;

      cards.forEach((card) => {
        const matches = !query || (card.textContent || "").toLowerCase().includes(query);
        card.hidden = !matches;
        visible += matches ? 1 : 0;
      });

      const noResults = document.querySelector(".courses-no-results");
      if (noResults) noResults.hidden = visible > 0;
    };

    searchInput.addEventListener("input", filterCourses);
    searchButton?.addEventListener("click", filterCourses);
    filterCourses();
  };

  const initCourseCatalog = async () => {
    const container = document.querySelector("[data-course-catalog]");
    const status = document.querySelector("[data-course-catalog-status]");
    if (!container) return;

    if (!client) {
      if (status) status.textContent = "Showing default course list.";
      return;
    }

    try {
      const { data, error } = await client
        .from("learning_courses")
        .select("id,title,slug,summary,level,category,thumbnail_url,price_amount,price_currency,is_free,is_limited_time_free,status,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(24);

      if (error) throw error;
      if (!data?.length) {
        if (status) status.textContent = "Showing default course list until published courses are added in Supabase.";
        bindCatalogSearch();
        return;
      }

      container.replaceChildren(...data.map(createCourseCard));
      if (status) status.textContent = `Showing ${data.length} published Growvelt Learning course${data.length === 1 ? "" : "s"} from Supabase.`;
      bindCatalogSearch();
    } catch (error) {
      console.warn("Course catalog load failed", error);
      if (status) status.textContent = "Showing default course list because live courses could not load.";
      bindCatalogSearch();
    }
  };

  const setCourseDetailText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  };

  const renderModules = async (course) => {
    const list = document.querySelector("[data-course-modules]");
    if (!list || !client || !course?.id) return;

    const { data: modules, error: moduleError } = await client
      .from("course_modules")
      .select("id,title,position")
      .eq("course_id", course.id)
      .order("position", { ascending: true });

    if (moduleError || !modules?.length) return;

    const { data: lessons } = await client
      .from("lessons")
      .select("module_id,title,is_preview,position")
      .eq("course_id", course.id)
      .eq("is_preview", true)
      .order("position", { ascending: true });

    const articles = modules.map((module, index) => {
      const article = document.createElement("article");
      const label = document.createElement("span");
      const title = document.createElement("h3");
      const summary = document.createElement("p");
      const previewLessons = (lessons || []).filter((lesson) => lesson.module_id === module.id);

      label.textContent = `Module ${String(index + 1).padStart(2, "0")}`;
      title.textContent = module.title;
      summary.textContent = previewLessons.length
        ? `Preview lessons: ${previewLessons.map((lesson) => lesson.title).join(", ")}`
        : "Lessons will appear here when previews are published.";

      article.append(label, title, summary);
      return article;
    });

    list.replaceChildren(...articles);
  };

  const enrollInCourse = async (course) => {
    if (!client || !course?.id) return { ok: false, message: "Course enrollment is not ready yet." };

    const session = await getSession();
    if (!session?.user) {
      localStorage.setItem("growvelt_learning_pending_enrollment_slug", course.slug || "");
      window.location.href = getCleanPath("auth.html");
      return { ok: false, message: "Redirecting to sign in." };
    }

    let profile = await fetchProfile(session.user).catch(() => null);
    if (!profile) {
      profile = await upsertProfile(session.user, session.user.user_metadata?.full_name || session.user.email).catch(() => null);
    }

    if (!course.is_free) {
      window.location.href = registrationUrl(course);
      return { ok: false, message: "Paid-course enrollment requires verified payment. Redirecting to registration..." };
    }

    const { error } = await client.rpc("enroll_in_free_learning_course", { p_course_id: course.id });

    if (error) throw error;
    localStorage.removeItem("growvelt_learning_pending_enrollment_slug");
    return { ok: true, message: "You are enrolled. Opening your learner dashboard..." };
  };

  const bindEnrollmentButton = (course) => {
    const button = document.querySelector("[data-course-enroll]");
    const status = document.querySelector("[data-course-detail-status]");
    if (!button || !course?.id) return;

    if (!course.is_free) {
      button.textContent = "Register for course";
      button.href = registrationUrl(course);
      return;
    }

    button.textContent = "Enroll free";
    button.href = "#enroll";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const original = button.textContent;
      button.textContent = "Enrolling...";
      button.setAttribute("aria-busy", "true");

      try {
        const result = await enrollInCourse(course);
        if (status) status.textContent = result.message;
        if (result.ok) {
          window.setTimeout(() => {
            window.location.href = courseLearnUrl(course);
          }, 900);
        }
      } catch (error) {
        if (status) status.textContent = error.message || "Enrollment failed. Please try again.";
        button.textContent = original;
      } finally {
        button.removeAttribute("aria-busy");
      }
    });
  };

  const renderLearnerEnrollments = async (profile) => {
    const wrapper = document.querySelector("[data-learner-enrollments]");
    if (!wrapper || !client || !profile?.id) return;

    try {
      const { data, error } = await client
        .from("enrollments")
        .select("id,status,enrolled_at,learning_courses(id,title,slug,summary,thumbnail_url,category,level)")
        .eq("learner_id", profile.id)
        .order("enrolled_at", { ascending: false })
        .limit(12);

      if (error) throw error;

      const title = document.createElement("h3");
      title.textContent = "Enrolled courses";
      setText("[data-dashboard-enrolled-count]", String(data?.length || 0));

      if (!data?.length) {
        setText("[data-dashboard-progress-average]", "0%");
        const empty = document.createElement("p");
        empty.textContent = "Your active courses will appear here after you enroll.";
        wrapper.replaceChildren(title, empty);
        return;
      }

      const enrollmentIds = data.map((enrollment) => enrollment.id);
      const { data: progressRows } = await client
        .from("lesson_progress")
        .select("enrollment_id,progress_percent,completed_at")
        .in("enrollment_id", enrollmentIds);

      const completedCount = (progressRows || []).filter((row) => row.completed_at || Number(row.progress_percent) >= 100).length;
      const average = data.length ? Math.min(100, Math.round((completedCount / (data.length * 6)) * 100)) : 0;
      setText("[data-dashboard-progress-average]", `${average}%`);

      const list = document.createElement("div");
      list.className = "enrollment-list";

      data.forEach((enrollment) => {
        const course = enrollment.learning_courses;
        if (!course) return;

        const item = document.createElement("article");
        item.className = "enrollment-item";

        const image = document.createElement("img");
        image.src = course.thumbnail_url || fallbackCourseImage(course);
        image.alt = course.title || "Enrolled course";

        const copy = document.createElement("div");
        const heading = document.createElement("h4");
        const summary = document.createElement("p");
        const meta = document.createElement("span");
        const link = document.createElement("a");

        heading.textContent = course.title || "Growvelt Learning Course";
        summary.textContent = course.summary || "Continue your Growvelt Learning course.";
        meta.textContent = `${course.category || "Course"} | ${course.level || "Flexible"} | ${enrollment.status}`;
        link.href = courseLearnUrl(course);
        link.textContent = "Continue";
        link.className = "text-link";

        copy.append(heading, summary, meta, link);
        item.append(image, copy);
        list.append(item);
      });

      wrapper.replaceChildren(title, list);
    } catch (error) {
      console.warn("Enrollment load failed", error);
    }
  };

  const calculateProgress = (lessons, progressRows) => {
    const total = lessons.length;
    if (!total) return { completed: 0, total: 0, percent: 0 };

    const completed = progressRows.filter((row) => row.completed_at || Number(row.progress_percent) >= 100).length;
    return {
      completed,
      total,
      percent: Math.round((completed / total) * 100),
    };
  };

  const updateProgressUi = (lessons, progressRows) => {
    const progress = calculateProgress(lessons, progressRows);
    const bar = document.querySelector("[data-learning-progress-bar]");
    const text = document.querySelector("[data-learning-progress-text]");

    if (bar) bar.style.width = `${progress.percent}%`;
    if (text) text.textContent = `${progress.percent}%`;
    return progress;
  };

  const setLearningStatus = (message, type = "neutral") => {
    const status = document.querySelector("[data-learning-room-status]");
    if (!status) return;
    status.textContent = message;
    status.className = type === "success" ? "dashboard-status dashboard-status-success" : "dashboard-status";
  };

  const renderLearningLessons = (enrollment, lessons, progressRows) => {
    const list = document.querySelector("[data-learning-lessons]");
    if (!list) return;

    if (!lessons.length) {
      list.innerHTML = "<p>No lessons have been published for this course yet.</p>";
      return;
    }

    const completedIds = new Set(
      progressRows
        .filter((row) => row.completed_at || Number(row.progress_percent) >= 100)
        .map((row) => row.lesson_id),
    );

    const items = lessons.map((lesson) => {
      const item = document.createElement("article");
      item.className = "lesson-item";
      item.dataset.lessonId = String(lesson.id);

      const copy = document.createElement("div");
      const title = document.createElement("h4");
      const meta = document.createElement("span");
      const content = document.createElement("p");
      const button = document.createElement("button");

      title.textContent = lesson.title;
      meta.textContent = `${lesson.lesson_type || "lesson"} | ${lesson.duration_minutes || 0} min`;
      content.textContent = lesson.content || "Lesson content will be added by the instructor.";
      button.type = "button";
      button.className = completedIds.has(lesson.id) ? "lesson-complete-button is-complete" : "lesson-complete-button";
      button.textContent = completedIds.has(lesson.id) ? "Completed" : "Mark Complete";
      button.dataset.lessonComplete = String(lesson.id);
      button.disabled = completedIds.has(lesson.id);

      copy.append(title, meta, content);
      item.append(copy, button);
      return item;
    });

    list.replaceChildren(...items);

    list.querySelectorAll("[data-lesson-complete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const lessonId = Number(button.dataset.lessonComplete);
        const original = button.textContent;
        button.textContent = "Saving...";
        button.disabled = true;

        try {
          const { error } = await client
            .from("lesson_progress")
            .upsert(
              {
                enrollment_id: enrollment.id,
                lesson_id: lessonId,
                progress_percent: 100,
                completed_at: new Date().toISOString(),
              },
              { onConflict: "enrollment_id,lesson_id" },
            );

          if (error) throw error;

          const progressRows = await fetchLessonProgress(enrollment.id);
          updateProgressUi(lessons, progressRows);
          button.textContent = "Completed";
          button.classList.add("is-complete");
          setLearningStatus("Progress saved.", "success");
          notify("Lesson marked complete.");
        } catch (error) {
          console.warn("Progress save failed", error);
          button.textContent = original;
          button.disabled = false;
          setLearningStatus(error.message || "Progress could not be saved.");
        }
      });
    });
  };

  const fetchLessonProgress = async (enrollmentId) => {
    const { data, error } = await client
      .from("lesson_progress")
      .select("lesson_id,progress_percent,completed_at")
      .eq("enrollment_id", enrollmentId);

    if (error) throw error;
    return data || [];
  };

  const initLearningRoom = async () => {
    const room = document.querySelector("[data-learning-room]");
    if (!room || !client) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    if (!slug) {
      setLearningStatus("Choose a course from your learner dashboard.");
      return;
    }

    const session = await getSession();
    if (!session?.user) {
      localStorage.setItem("growvelt_learning_pending_enrollment_slug", slug);
      window.location.href = getCleanPath("auth.html");
      return;
    }

    const profile = await fetchProfile(session.user).catch(() => null);
    const learnerId = profile?.id || session.user.id;

    try {
      const { data: course, error: courseError } = await client
        .from("learning_courses")
        .select("id,title,slug,summary,thumbnail_url,status")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (courseError) throw courseError;
      if (!course) {
        setLearningStatus("This course is not published yet.");
        return;
      }

      const { data: enrollment, error: enrollmentError } = await client
        .from("enrollments")
        .select("id,status,enrolled_at")
        .eq("learner_id", learnerId)
        .eq("course_id", course.id)
        .maybeSingle();

      if (enrollmentError) throw enrollmentError;
      if (!enrollment) {
        setLearningStatus("You need to enroll before opening this course.");
        window.setTimeout(() => {
          window.location.href = courseDetailsUrl(course);
        }, 900);
        return;
      }

      setText("[data-learn-title]", course.title);
      setText("[data-learn-heading]", course.title);
      document.title = `${course.title} | Growvelt Learning`;

      const { data: lessons, error: lessonError } = await client
        .from("lessons")
        .select("id,module_id,title,lesson_type,content,duration_minutes,position")
        .eq("course_id", course.id)
        .order("position", { ascending: true });

      if (lessonError) throw lessonError;

      const progressRows = await fetchLessonProgress(enrollment.id);
      updateProgressUi(lessons || [], progressRows);
      renderLearningLessons(enrollment, lessons || [], progressRows);
      setLearningStatus("Course loaded. Mark lessons complete as you learn.", "success");
    } catch (error) {
      console.warn("Learning room load failed", error);
      setLearningStatus(error.message || "The learning room could not load.");
    }
  };

  const initCourseDetail = async () => {
    const detail = document.querySelector("[data-course-detail]");
    if (!detail || !client) return;

    const status = document.querySelector("[data-course-detail-status]");
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    try {
      let query = client
        .from("learning_courses")
        .select("id,title,slug,summary,description,level,category,thumbnail_url,price_amount,price_currency,is_free,status,published_at")
        .eq("status", "published");

      query = slug
        ? query.eq("slug", slug).maybeSingle()
        : query.order("published_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();

      const { data: course, error } = await query;
      if (error) throw error;
      if (!course) {
        if (status) status.textContent = "Showing sample course preview until this course is published in Supabase.";
        return;
      }

      document.title = `${course.title} | Growvelt Learning`;
      setCourseDetailText("[data-course-title]", course.title);
      setCourseDetailText("[data-course-summary]", course.description || course.summary);
      setCourseDetailText("[data-course-category]", course.category ? `Category: ${course.category}` : "Growvelt Learning");
      setCourseDetailText("[data-course-level]", course.level ? `Level: ${course.level}` : "Level: Flexible");
      setCourseDetailText("[data-course-price]", formatPrice(course));

      const image = document.querySelector("[data-course-image]");
      if (image) {
        image.src = course.thumbnail_url || fallbackCourseImage(course);
        image.alt = course.title || "Growvelt Learning course preview";
      }

      const enroll = document.querySelector("[data-course-enroll]");
      if (enroll) enroll.href = registrationUrl(course);

      if (status) status.textContent = "Loaded from published Supabase course data.";
      detail.dataset.courseSlug = course.slug || "";
      bindEnrollmentButton(course);

      const pendingSlug = localStorage.getItem("growvelt_learning_pending_enrollment_slug");
      if (pendingSlug && pendingSlug === (course.slug || "")) {
        const session = await getSession();
        if (session?.user) {
          const result = await enrollInCourse(course);
          if (status) status.textContent = result.message;
        }
      }
      await renderModules(course);
    } catch (error) {
      console.warn("Course detail load failed", error);
      if (status) status.textContent = "Showing sample course preview because live course data could not load.";
    }
  };

  const initAuthPage = async () => {
    const form = document.querySelector("[data-learning-auth-form]");
    if (!form || !client) {
      if (form) showMessage(form.querySelector("[data-auth-message]"), "Supabase Auth is not available on this page.", "error");
      return;
    }

    const message = form.querySelector("[data-auth-message]");
    const submitButtons = form.querySelectorAll("[data-auth-action]");
    const googleButton = form.querySelector("[data-google-auth]");
    const allAuthButtons = Array.from(submitButtons);
    if (googleButton) allAuthButtons.push(googleButton);
    const session = await getSession();

    if (session?.user) {
      setAuthBusy(allAuthButtons, googleButton || submitButtons[0], true, "Signing you in...");
      const pendingIntent = localStorage.getItem("growvelt_learning_pending_learning_intent");
      const existingProfile = await fetchProfile(session.user).catch(() => null);
      const profile = existingProfile || await upsertProfile(
        session.user,
        session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
      ).catch(() => null);
      if (profile) {
        await requestInstructorApplication(session.user, pendingIntent === "instructor" || session.user.user_metadata?.learning_intent === "instructor").catch(() => null);
        localStorage.removeItem("growvelt_learning_pending_learning_intent");
      }
      showMessage(
        message,
        `Signed in as ${session.user.email}. Redirecting...`,
      );
      const pendingSlug = localStorage.getItem("growvelt_learning_pending_enrollment_slug");
      window.setTimeout(() => {
        window.location.href = pendingSlug
          ? `course-details.html?slug=${encodeURIComponent(pendingSlug)}`
          : dashboardForRole(profile?.account_type || "learner");
      }, 700);
      return;
    }

    form.addEventListener("submit", (event) => event.preventDefault());

    googleButton?.addEventListener("click", async () => {
      const learningIntent = form.learning_intent.value || "learner";
      localStorage.setItem("growvelt_learning_pending_learning_intent", learningIntent);
      setAuthBusy(allAuthButtons, googleButton, true, "Opening Google...");
      showMessage(message, "Opening Google sign-in...");

      const redirectTo = new URL("auth.html", window.location.href);
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.href,
        },
      });

      if (error) {
        showMessage(message, error.message || "Google sign-in failed.", "error");
        notify(error.message || "Google sign-in failed.", "error");
        setAuthBusy(allAuthButtons, googleButton, false);
      }
    });

    submitButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.authAction;
        const fullName = form.full_name.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value;
        const learningIntent = form.learning_intent.value || "learner";

        if (!email || !password || (action === "signup" && !fullName)) {
          showMessage(message, "Please enter your name, email, and password.", "error");
          return;
        }

        setAuthBusy(allAuthButtons, button, true, action === "signin" ? "Signing in..." : "Creating...");

        try {
          let result;
          if (action === "signin") {
            result = await client.auth.signInWithPassword({ email, password });
          } else {
            result = await client.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: fullName,
                  learning_intent: learningIntent,
                },
              },
            });
          }

          if (result.error) throw result.error;

          const session = result.data?.session || await getSession();
          const user = session?.user || result.data?.user;

          if (user && session) {
            const existingProfile = action === "signin" ? await fetchProfile(user).catch(() => null) : null;
            const profile = existingProfile || await upsertProfile(user, fullName);
            await requestInstructorApplication(user, learningIntent === "instructor");
            showMessage(message, "Account ready. Redirecting to your dashboard...");
            window.setTimeout(() => {
              const pendingSlug = localStorage.getItem("growvelt_learning_pending_enrollment_slug");
              window.location.href = pendingSlug
                ? `course-details.html?slug=${encodeURIComponent(pendingSlug)}`
                : dashboardForRole(profile?.account_type || "learner");
            }, 800);
          } else {
            showMessage(message, "Check your email to confirm your account, then sign in.");
          }
        } catch (error) {
          showMessage(message, error.message || "Authentication failed. Please try again.", "error");
          notify(error.message || "Authentication failed. Please try again.", "error");
        } finally {
          setAuthBusy(allAuthButtons, button, false);
        }
      });
    });
  };

  const initDashboard = async () => {
    const dashboard = document.querySelector("[data-dashboard-role]");
    if (!dashboard || !client) return;

    const role = dashboard.dataset.dashboardRole;
    const status = document.querySelector("[data-dashboard-status]");
    const session = await getSession();

    if (!session?.user) {
      if (status) {
        status.innerHTML = 'You are not signed in yet. <a href="auth.html">Sign in to continue</a>.';
      }
      return;
    }

    let profile = await fetchProfile(session.user).catch(() => null);
    if (!profile) {
      profile = await upsertProfile(session.user, session.user.email).catch(() => null);
    }

    setText("[data-user-name]", profile?.full_name || session.user.email || "Growvelt learner");
    setText("[data-user-email]", session.user.email || "");
    setText("[data-user-role]", profile?.account_type || "learner");

    if (status) {
      status.textContent = `Signed in as ${session.user.email}`;
      status.className = "dashboard-status dashboard-status-success";
    }

    if (profile?.account_type && profile.account_type !== role && role !== "learner") {
      const target = dashboardForRole(profile.account_type);
      if (status) {
        status.innerHTML = `This account is a ${profile.account_type}. <a href="${target}">Open the right dashboard</a>.`;
      }
    }

    document.querySelectorAll("[data-sign-out]").forEach((button) => {
      button.addEventListener("click", async () => {
        await client.auth.signOut();
        window.location.href = "auth.html";
      });
    });

    await renderLearnerEnrollments(profile || { id: session.user.id });
    await initInstructorStudio(profile || { id: session.user.id, account_type: role });
    await initAdminDashboard(profile || { id: session.user.id, account_type: role });
  };

  const renderInstructorCourses = async (profile) => {
    const wrapper = document.querySelector("[data-instructor-courses]");
    if (!wrapper || !client || !profile?.id) return;

    try {
      const { data, error } = await client
        .from("learning_courses")
        .select("id,title,slug,summary,category,level,status,created_at,price_amount,price_currency,is_free")
        .eq("instructor_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      setText("[data-instructor-course-count]", String(data?.length || 0));
      setText("[data-instructor-pending-count]", String((data || []).filter((course) => course.status === "pending_review").length));

      const title = document.createElement("h3");
      title.textContent = "Your submitted courses";

      if (!data?.length) {
        const empty = document.createElement("p");
        empty.textContent = "Your course drafts and pending approvals will appear here.";
        wrapper.replaceChildren(title, empty);
        return;
      }

      const list = document.createElement("div");
      list.className = "instructor-course-list";

      data.forEach((course) => {
        const item = document.createElement("article");
        item.className = "instructor-course-item";

        const copy = document.createElement("div");
        const heading = document.createElement("h4");
        const summary = document.createElement("p");
        const meta = document.createElement("span");
        const status = document.createElement("strong");

        heading.textContent = course.title;
        summary.textContent = course.summary || "No summary yet.";
        meta.textContent = [course.category, course.level, formatPrice(course)].filter(Boolean).join(" | ");
        status.textContent = course.status.replace(/_/g, " ");
        status.className = `course-status course-status-${course.status}`;

        copy.append(heading, summary, meta);
        item.append(copy, status);
        list.append(item);
      });

      wrapper.replaceChildren(title, list);
    } catch (error) {
      console.warn("Instructor courses load failed", error);
    }
  };

  const initInstructorStudio = async (profile) => {
    const form = document.querySelector("[data-instructor-course-form]");
    if (!form || !client || !profile?.id) return;

    const message = form.querySelector("[data-instructor-course-message]");
    const instructorApproval = await getInstructorApprovalStatus(profile);
    const canSubmitCourse = await hasAdminCapability() || await hasApprovedInstructorCapability();

    setText("[data-instructor-approval-status]", instructorApproval.replace(/_/g, " "));
    await renderInstructorCourses(profile);

    if (!canSubmitCourse) {
      form.querySelectorAll("input, textarea, select, button").forEach((control) => {
        control.disabled = true;
      });
      showMessage(
        message,
        instructorApproval === "rejected"
          ? "Your instructor application was not approved. Please contact Growvelt Learning support before submitting courses."
          : "Your instructor account is pending admin approval. Course submission will unlock after approval.",
        instructorApproval === "rejected" ? "error" : "success",
      );
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const title = String(formData.get("title") || "").trim();
      const slugBase = slugify(title);
      const submitButton = form.querySelector('button[type="submit"]');

      if (!title || !slugBase) {
        showMessage(message, "Please enter a valid course title.", "error");
        return;
      }

      setButtonLoading(submitButton, true, "Submitting...");

      try {
        const priceAmount = Number(formData.get("price_amount") || 0);
        const isFree = formData.get("is_free") === "on";
        const payload = {
          instructor_id: profile.id,
          title,
          slug: `${slugBase}-${Date.now().toString(36)}`,
          summary: String(formData.get("summary") || "").trim(),
          description: String(formData.get("description") || "").trim(),
          category: String(formData.get("category") || "").trim(),
          level: String(formData.get("level") || "").trim(),
          thumbnail_url: String(formData.get("thumbnail_url") || "").trim() || null,
          price_amount: isFree ? 0 : Number.isFinite(priceAmount) ? priceAmount : null,
          price_currency: String(formData.get("price_currency") || "NGN"),
          is_free: isFree,
          is_limited_time_free: false,
          status: "pending_review",
        };

        const { error } = await client.from("learning_courses").insert(payload);
        if (error) throw error;

        form.reset();
        showMessage(message, "Course submitted for admin review.", "success");
        notify("Course submitted for admin review.");
        await renderInstructorCourses(profile);
      } catch (error) {
        showMessage(message, error.message || "Course could not be submitted.", "error");
        notify(error.message || "Course could not be submitted.", "error");
      } finally {
        setButtonLoading(submitButton, false);
      }
    });
  };

  const getInstructorApprovalStatus = async (profile) => {
    if (!client || !profile?.id) return "pending";

    const { data, error } = await client
      .from("instructor_profiles")
      .select("approval_status")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (error) {
      console.warn("Instructor approval status load failed", error);
      return "pending";
    }

    return data?.approval_status || "pending";
  };

  const renderAdminInstructors = async () => {
    const wrapper = document.querySelector("[data-admin-instructors]");
    if (!wrapper || !client) return;

    try {
      const { data, error } = await client
        .from("instructor_profiles")
        .select("id,user_id,headline,bio,approval_status,created_at")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setText("[data-admin-pending-instructors]", String(data?.length || 0));

      const title = document.createElement("h3");
      title.textContent = "Instructor approvals";

      if (!data?.length) {
        const empty = document.createElement("p");
        empty.textContent = "No pending instructor applications right now.";
        wrapper.replaceChildren(title, empty);
        return;
      }

      const list = document.createElement("div");
      list.className = "admin-approval-list";

      data.forEach((item) => {
        const row = document.createElement("article");
        row.className = "admin-approval-item";
        const copy = document.createElement("div");
        const heading = document.createElement("h4");
        const meta = document.createElement("p");
        const status = document.createElement("strong");
        const actions = document.createElement("div");
        const approve = document.createElement("button");
        const reject = document.createElement("button");

        actions.className = "approval-actions";
        approve.type = "button";
        approve.textContent = "Approve";
        approve.dataset.adminApproveInstructor = String(item.user_id);
        reject.type = "button";
        reject.textContent = "Reject";
        reject.className = "danger-action";
        reject.dataset.adminRejectInstructor = String(item.user_id);

        heading.textContent = item.headline || "Instructor application";
        meta.textContent = item.bio || `User ID: ${item.user_id}`;
        status.textContent = item.approval_status.replace(/_/g, " ");
        status.className = `course-status course-status-${item.approval_status}`;
        copy.append(heading, meta);
        actions.append(approve, reject);
        row.append(copy, status, actions);
        list.append(row);
      });

      wrapper.replaceChildren(title, list);
      bindAdminApprovalActions();
    } catch (error) {
      console.warn("Admin instructors load failed", error);
    }
  };

  const bindAdminApprovalActions = () => {
    document.querySelectorAll("[data-admin-approve-instructor], [data-admin-reject-instructor]").forEach((button) => {
      if (button.dataset.adminActionBound) return;
      button.dataset.adminActionBound = "true";

      button.addEventListener("click", async () => {
        const applicationUserId = button.dataset.adminApproveInstructor || button.dataset.adminRejectInstructor;
        const approved = Boolean(button.dataset.adminApproveInstructor);
        setButtonLoading(button, true, approved ? "Approving..." : "Rejecting...");

        try {
          const { error } = await client.rpc("review_instructor_application", {
            p_application_user_id: applicationUserId,
            p_decision: approved ? "approved" : "rejected",
          });

          if (error) throw error;
          notify(approved ? "Instructor approved." : "Instructor application rejected.");
          await renderAdminInstructors();
        } catch (error) {
          notify(error.message || "Instructor action failed.", "error");
          setButtonLoading(button, false);
        }
      });
    });

    document.querySelectorAll("[data-admin-approve-course], [data-admin-reject-course]").forEach((button) => {
      if (button.dataset.adminActionBound) return;
      button.dataset.adminActionBound = "true";

      button.addEventListener("click", async () => {
        const id = button.dataset.adminApproveCourse || button.dataset.adminRejectCourse;
        const approved = Boolean(button.dataset.adminApproveCourse);
        setButtonLoading(button, true, approved ? "Approving..." : "Rejecting...");

        try {
          const { error } = await client
            .from("learning_courses")
            .update({
              status: approved ? "published" : "draft",
              published_at: approved ? new Date().toISOString() : null,
            })
            .eq("id", id)
            .eq("status", "pending_review");

          if (error) throw error;
          notify(approved ? "Course approved and published." : "Course returned to draft.");
          await renderAdminCourseApprovals();
        } catch (error) {
          notify(error.message || "Admin action failed.", "error");
          setButtonLoading(button, false);
        }
      });
    });
  };

  const renderAdminCourseApprovals = async () => {
    const wrapper = document.querySelector("[data-admin-course-approvals]");
    if (!wrapper || !client) return;

    try {
      const { data, error } = await client
        .from("learning_courses")
        .select("id,title,slug,summary,category,level,status,created_at,price_amount,price_currency,is_free")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setText("[data-admin-pending-courses]", String(data?.length || 0));

      const title = document.createElement("h3");
      title.textContent = "Course approvals";

      if (!data?.length) {
        const empty = document.createElement("p");
        empty.textContent = "No pending courses right now.";
        wrapper.replaceChildren(title, empty);
        return;
      }

      const list = document.createElement("div");
      list.className = "admin-approval-list";

      data.forEach((course) => {
        const row = document.createElement("article");
        row.className = "admin-approval-item";
        const copy = document.createElement("div");
        const heading = document.createElement("h4");
        const summary = document.createElement("p");
        const meta = document.createElement("span");
        const actions = document.createElement("div");
        const approve = document.createElement("button");
        const reject = document.createElement("button");

        actions.className = "approval-actions";
        approve.type = "button";
        approve.textContent = "Approve";
        approve.dataset.adminApproveCourse = String(course.id);
        reject.type = "button";
        reject.textContent = "Reject";
        reject.className = "danger-action";
        reject.dataset.adminRejectCourse = String(course.id);

        heading.textContent = course.title;
        summary.textContent = course.summary || "No summary provided.";
        meta.textContent = [course.category, course.level, formatPrice(course)].filter(Boolean).join(" | ");
        copy.append(heading, summary, meta);
        actions.append(approve, reject);
        row.append(copy, actions);
        list.append(row);
      });

      wrapper.replaceChildren(title, list);
      bindAdminApprovalActions();
    } catch (error) {
      console.warn("Admin course approvals load failed", error);
    }
  };

  const initAdminDashboard = async (profile) => {
    const adminShell = document.querySelector('[data-dashboard-role="admin"]');
    if (!adminShell || !client || !profile?.id) return;

    if (!await hasAdminCapability()) {
      notify("Admin access required.", "error");
      return;
    }

    await renderAdminInstructors();
    await renderAdminCourseApprovals();

    const { count } = await client
      .from("course_registrations")
      .select("id", { count: "exact", head: true });
    if (Number.isFinite(count)) setText("[data-admin-registrations]", String(count));
  };

  ready(() => {
    initAuthPage();
    initDashboard();
    initCourseCatalog();
    initCourseDetail();
    initLearningRoom();
  });
})();
