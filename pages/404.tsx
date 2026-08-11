import styles from "../styles/player.module.css";
export default function NotFound() { return <main className={styles.error}><span className={styles.errorMark}>S</span><h1>This recording does not exist or has been deleted.</h1><p>Check the link and try again.</p></main>; }
