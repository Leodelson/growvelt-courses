export const reviewUi = {
  en: { backHub:"← Back to admin reviews",backInstructors:"← Back to instructor reviews",backCourses:"← Back to course reviews",information:"Application details",decision:"Review decision",overview:"Course overview",rights:"Rights declaration",curriculum:"Curriculum",findArea:"Find an admin workspace",findProvider:"Search providers, handles or contacts",group:"Workspace group",all:"All groups",reviewGroup:"Review requests",businessGroup:"Business operations",growthGroup:"Promotions & agreements",sort:"Sort by",original:"Default order",name:"Name",newest:"Newest submission",oldest:"Oldest submission",results:"Results",reset:"Reset filters",none:"No matching items",tryAgain:"Try another search or reset the filters.",noDate:"Date unavailable" },
  fr: { backHub:"← Retour aux examens",backInstructors:"← Retour aux candidatures",backCourses:"← Retour aux cours à examiner",information:"Détails de la candidature",decision:"Décision d’examen",overview:"Présentation du cours",rights:"Déclaration de droits",curriculum:"Programme",findArea:"Rechercher un espace administrateur",findProvider:"Rechercher fournisseurs, identifiants ou contacts",group:"Groupe d’espaces",all:"Tous les groupes",reviewGroup:"Demandes d’examen",businessGroup:"Opérations commerciales",growthGroup:"Promotions et accords",sort:"Trier par",original:"Ordre par défaut",name:"Nom",newest:"Soumission la plus récente",oldest:"Soumission la plus ancienne",results:"Résultats",reset:"Réinitialiser les filtres",none:"Aucun résultat",tryAgain:"Essayez une autre recherche ou réinitialisez les filtres.",noDate:"Date indisponible" },
  es: { backHub:"← Volver a revisiones",backInstructors:"← Volver a solicitudes",backCourses:"← Volver a revisiones de cursos",information:"Datos de la solicitud",decision:"Decisión de revisión",overview:"Resumen del curso",rights:"Declaración de derechos",curriculum:"Plan de estudios",findArea:"Buscar un espacio de administración",findProvider:"Buscar proveedores, identificadores o contactos",group:"Grupo de espacios",all:"Todos los grupos",reviewGroup:"Solicitudes de revisión",businessGroup:"Operaciones comerciales",growthGroup:"Promociones y acuerdos",sort:"Ordenar por",original:"Orden predeterminado",name:"Nombre",newest:"Envío más reciente",oldest:"Envío más antiguo",results:"Resultados",reset:"Restablecer filtros",none:"No hay coincidencias",tryAgain:"Prueba otra búsqueda o restablece los filtros.",noDate:"Fecha no disponible" },
};
export function reviewDate(value:string|null|undefined, locale:"en"|"fr"|"es", fallback=reviewUi[locale].noDate, includeTime=false) {
  if (!value || !Number.isFinite(Date.parse(value))) return fallback;
  return new Intl.DateTimeFormat(locale,{dateStyle:"medium",...(includeTime?{timeStyle:"short" as const}:{}),timeZone:"UTC"}).format(new Date(value));
}
export type ReviewItem = {id:string;title:string;keywords?:string;group?:string;submittedAt?:string|null};
export function filterReviewItems<T extends ReviewItem>(items:T[], search:string, group:string, sort:string, locale:string) {
  const query=search.trim().toLocaleLowerCase(locale);
  return items.filter(item=>(group==="all"||item.group===group)&&`${item.title} ${item.keywords??""}`.toLocaleLowerCase(locale).includes(query)).sort((a,b)=>{
    if(sort==="name")return a.title.localeCompare(b.title,locale);
    if(sort!=="newest"&&sort!=="oldest")return 0;
    const first=Date.parse(a.submittedAt??""), second=Date.parse(b.submittedAt??"");
    if(!Number.isFinite(first))return Number.isFinite(second)?1:0;
    if(!Number.isFinite(second))return -1;
    return sort==="newest"?second-first:first-second;
  });
}
