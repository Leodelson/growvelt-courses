import Image from "next/image";
import styles from "./growvelt-logo.module.css";

export function GrowveltLogo({ width = 72, surface = "auto", priority = false }: {
  width?: number;
  surface?: "auto" | "light" | "dark";
  priority?: boolean;
}) {
  return <span role="img" aria-label="Growvelt" className={`${styles.logo} ${styles[surface]}`} style={{ width, aspectRatio: "720 / 208" }}>
    <Image className={styles.lightImage} src="/logo/growvelt-wordmark-purple-20261019.png" alt="" width={720} height={208} priority={priority} unoptimized />
    <Image className={styles.darkImage} src="/logo/growvelt-wordmark-white-20261019.png" alt="" width={720} height={208} priority={priority} unoptimized />
  </span>;
}
