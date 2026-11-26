"use client";

import styles from "./LearningPathTree.module.css";

type Module = {
  code: string;
  name: string;
  status: "completed" | "current" | "locked";
};

export function LearningPathTree() {
  const modules: Module[] = [
    { code: "ECON111", name: "Macroeconomics I", status: "completed" },
    { code: "ECON121", name: "Macroeconomics II", status: "current" },
    { code: "ECON211", name: "Macroeconomics III", status: "locked" },
  ];

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Module Learning Path</h3>
      <div className={styles.tree}>
        {modules.map((m, i) => (
          <div key={m.code} className={styles.nodeWrapper}>
            <div className={styles.node} data-status={m.status}>
              <span className={styles.code}>{m.code}</span>
              <span className={styles.name}>{m.name}</span>
            </div>
            {i < modules.length - 1 && <div className={styles.connector} />}
          </div>
        ))}
      </div>
    </div>
  );
}
