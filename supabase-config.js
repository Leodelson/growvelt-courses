// Separate Supabase project config for courses.growvelt.com.
// Replace these blank values after running supabase-schema.sql.
window.GROWVELT_SUPABASE = {
  url: "https://qtcpjcaoptdunuefwvgc.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Y3BqY2FvcHRkdW51ZWZ3dmdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzA3ODcsImV4cCI6MjA5NTE0Njc4N30.odP6ipEbOjKRFRvCiTtf5oDSGMabF5enbGjMR6zOv9s",
};

// Public display prices only. Keep this in sync with the COURSE_PRICES_JSON
// Supabase Edge Function secret before accepting payments.
window.GROWVELT_COURSE_PRICES = {
  currency: "NGN",
  items: {
    "Data Analysis": 360000,
    "Data Analysis with Excel": 105000,
    "Excel for Data Analysis": 105000,
    "Business Analysis": 230000,
    "Data Science": 480000,
    "Power BI for Business Analysis": 110000,
    "SQL for Data Analytics": 120000,
    "Python for Data Analysis": 130000,
    Python: 120000,
    "R for Data Analysis": 120000,
    "Web Development": 360000,
    Cybersecurity: 250000,
    "Social Media Marketing": 180000,
    "Graphics Design": 150000,
    "Basic Computer Literacy": 50000,
    "Microsoft Word": 10000,
    "Microsoft PowerPoint": 10000,
    "Google Drive": 70000,
    Other: null,
  },
};
