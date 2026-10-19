import { ApplicationStatusLoader } from "@/app/components/instructor/application-status-loader";
import { ApplicationStatusHeader } from "./application-status-header";
import styles from "./application-status.module.css";

export const metadata = { title: "Instructor application" };

export default async function TeachApplicationPage() {
  return <><ApplicationStatusHeader /><main id="main-content" className={`section-shell ${styles.main}`}><ApplicationStatusLoader /></main></>;
}
