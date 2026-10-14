import type { Locale } from "@/app/lib/i18n";

const en = {
  finder: {
    eyebrow: "START WITH A GOAL", title: "What would you like to be able to do?", intro: "Choose a direction, then explore a skill or tool that interests you.", label: "Choose a learning goal", tools: "Skills and tools to explore", note: "Search suggestions, not course listings. Availability depends on the published catalog.",
    goals: [
      { label: "Understand data", title: "Turn information into decisions.", copy: "Explore spreadsheets, databases, and visual reporting.", terms: ["Excel", "SQL", "Power BI", "Data analysis"] },
      { label: "Build for the web", title: "Bring an idea to the screen.", copy: "Explore the foundations of websites and web applications.", terms: ["HTML", "CSS", "JavaScript", "Web development"] },
      { label: "Reach an audience", title: "Give your ideas a wider reach.", copy: "Explore content, campaigns, and the skills behind digital marketing.", terms: ["Digital marketing", "SEO", "Content marketing", "Social media"] },
      { label: "Work smarter", title: "Make everyday work more effective.", copy: "Explore tools and approaches for planning, productivity, and collaboration.", terms: ["Project management", "Excel", "AI for work", "Productivity"] },
    ],
  },
  routine: { eyebrow: "MAKE TIME FOR YOURSELF", title: "A little time. A habit worth keeping.", intro: "You don’t need to plan your whole learning journey today. Pick a session length and see one way to make it part of your week.", label: "Suggested session length", minutes: "min", weekly: "minutes a week", frequency: "With three sessions a week", note: "A suggested routine. Adjust it to your course and your own pace.", steps: ["Revisit your notes", "Learn or practise", "Write down your next step"], session: "Your suggested session", features: ["Continue from your saved course progress", "Study in your browser, on desktop or mobile", "Review course activities before moving on"] },
  hiring: { eyebrow: "FOR EMPLOYERS", title: "Are you hiring?", intro: "Your next team member could be one introduction away. Take your opportunity to Growvelt Careers and start your hiring journey.", action: "Post a job on Growvelt Careers", note: "Opens Growvelt Careers in a new tab. Employer sign-in may be required." },
  partner: { eyebrow: "LET’S BUILD TOGETHER", title: "Have a bigger learning initiative in mind?", intro: "Bring us your training idea, community programme, or skills-development challenge. Let’s explore what a partnership could make possible.", action: "Let’s talk about a partnership", topics: ["Workforce development", "Academic collaboration", "Community learning"] },
};

export const homeDiscoveryCopy: Record<Locale, typeof en> = {
  en,
  fr: {
    finder: {
      eyebrow: "PARTEZ D’UN OBJECTIF", title: "Qu’aimeriez-vous savoir faire ?", intro: "Choisissez une direction, puis explorez une compétence ou un outil qui vous intéresse.", label: "Choisir un objectif d’apprentissage", tools: "Compétences et outils à explorer", note: "Suggestions de recherche, pas une liste de cours. La disponibilité dépend du catalogue publié.",
      goals: [
        { label: "Comprendre les données", title: "Transformez l’information en décisions.", copy: "Explorez les tableurs, les bases de données et les rapports visuels.", terms: ["Excel", "SQL", "Power BI", "Data analysis"] },
        { label: "Créer pour le web", title: "Donnez vie à une idée à l’écran.", copy: "Explorez les bases des sites et applications web.", terms: ["HTML", "CSS", "JavaScript", "Web development"] },
        { label: "Toucher un public", title: "Donnez plus de portée à vos idées.", copy: "Explorez le contenu, les campagnes et les compétences du marketing numérique.", terms: ["Digital marketing", "SEO", "Content marketing", "Social media"] },
        { label: "Mieux travailler", title: "Rendez le travail quotidien plus efficace.", copy: "Explorez les outils de planification, de productivité et de collaboration.", terms: ["Project management", "Excel", "AI for work", "Productivity"] },
      ],
    },
    routine: { eyebrow: "PRENEZ DU TEMPS POUR VOUS", title: "Un peu de temps. Une habitude à garder.", intro: "Pas besoin de planifier tout votre parcours aujourd’hui. Choisissez une durée de séance et découvrez une façon de l’intégrer à votre semaine.", label: "Durée de séance suggérée", minutes: "min", weekly: "minutes par semaine", frequency: "Avec trois séances par semaine", note: "Une routine suggérée, à adapter à votre cours et à votre rythme.", steps: ["Relisez vos notes", "Apprenez ou pratiquez", "Notez votre prochaine étape"], session: "Votre séance suggérée", features: ["Reprenez votre cours depuis la progression enregistrée", "Étudiez dans votre navigateur, sur ordinateur ou mobile", "Revoyez les activités du cours avant de continuer"] },
    hiring: { eyebrow: "POUR LES EMPLOYEURS", title: "Vous recrutez ?", intro: "Votre prochain collaborateur est peut-être à une rencontre près. Partagez votre opportunité sur Growvelt Careers et commencez votre recrutement.", action: "Publier une offre sur Growvelt Careers", note: "Ouvre Growvelt Careers dans un nouvel onglet. Une connexion employeur peut être nécessaire." },
    partner: { eyebrow: "CONSTRUISONS ENSEMBLE", title: "Une initiative d’apprentissage plus vaste ?", intro: "Parlez-nous de votre idée de formation, de votre programme communautaire ou de votre défi de développement des compétences. Explorons ce qu’un partenariat pourrait permettre.", action: "Parlons d’un partenariat", topics: ["Développement des équipes", "Collaboration académique", "Apprentissage communautaire"] },
  },
  es: {
    finder: {
      eyebrow: "EMPIEZA CON UN OBJETIVO", title: "¿Qué te gustaría saber hacer?", intro: "Elige una dirección y explora una habilidad o herramienta que te interese.", label: "Elegir un objetivo de aprendizaje", tools: "Habilidades y herramientas para explorar", note: "Sugerencias de búsqueda, no una lista de cursos. La disponibilidad depende del catálogo publicado.",
      goals: [
        { label: "Entender los datos", title: "Transforma la información en decisiones.", copy: "Explora hojas de cálculo, bases de datos e informes visuales.", terms: ["Excel", "SQL", "Power BI", "Data analysis"] },
        { label: "Crear para la web", title: "Lleva una idea a la pantalla.", copy: "Explora los fundamentos de los sitios y las aplicaciones web.", terms: ["HTML", "CSS", "JavaScript", "Web development"] },
        { label: "Llegar a un público", title: "Da más alcance a tus ideas.", copy: "Explora contenido, campañas y las habilidades del marketing digital.", terms: ["Digital marketing", "SEO", "Content marketing", "Social media"] },
        { label: "Trabajar mejor", title: "Haz más eficaz tu trabajo diario.", copy: "Explora herramientas de planificación, productividad y colaboración.", terms: ["Project management", "Excel", "AI for work", "Productivity"] },
      ],
    },
    routine: { eyebrow: "RESERVA TIEMPO PARA TI", title: "Un poco de tiempo. Un hábito que vale la pena.", intro: "No necesitas planificar todo tu aprendizaje hoy. Elige cuánto durará tu sesión y descubre una forma de integrarla en tu semana.", label: "Duración sugerida de la sesión", minutes: "min", weekly: "minutos por semana", frequency: "Con tres sesiones por semana", note: "Una rutina sugerida. Adáptala a tu curso y a tu propio ritmo.", steps: ["Repasa tus notas", "Aprende o practica", "Anota tu próximo paso"], session: "Tu sesión sugerida", features: ["Continúa desde el progreso guardado de tu curso", "Estudia en tu navegador, en ordenador o móvil", "Revisa las actividades del curso antes de continuar"] },
    hiring: { eyebrow: "PARA EMPLEADORES", title: "¿Estás contratando?", intro: "Tu próximo compañero de equipo podría estar a una presentación de distancia. Lleva tu oportunidad a Growvelt Careers y empieza tu proceso de contratación.", action: "Publicar una oferta en Growvelt Careers", note: "Abre Growvelt Careers en otra pestaña. Puede requerir acceso como empleador." },
    partner: { eyebrow: "CONSTRUYAMOS JUNTOS", title: "¿Tienes una iniciativa de aprendizaje más grande?", intro: "Cuéntanos tu idea de formación, programa comunitario o reto de desarrollo de habilidades. Exploremos lo que una colaboración podría hacer posible.", action: "Hablemos de una colaboración", topics: ["Desarrollo de equipos", "Colaboración académica", "Aprendizaje comunitario"] },
  },
};
