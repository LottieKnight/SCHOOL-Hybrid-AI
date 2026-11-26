"use client";

import styles from "./ConceptMap.module.css";

type Props = {
  title: string;
  sections: Array<{ key: string; label: string }>;
  completedKeys: string[];
};

export function ConceptMap({ title, sections, completedKeys }: Props) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Concept Map: {title}</h3>
      <div className={styles.map}>
        <div className={styles.centerNode}>
          <span className={styles.rootLabel}>{title}</span>
        </div>
        
        <div className={styles.nodes}>
          {sections.map((section, i) => {
            const isCompleted = completedKeys.includes(section.key);
            const angle = (i / sections.length) * 2 * Math.PI;
            const x = Math.cos(angle) * 120;
            const y = Math.sin(angle) * 120;

            return (
              <div
                key={section.key}
                className={styles.node}
                data-completed={isCompleted}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                <div className={styles.connector} style={{
                   width: '120px',
                   transform: `rotate(${angle}rad) translateX(-120px)`,
                   transformOrigin: 'right center'
                }} />
                <span className={styles.nodeLabel}>{section.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
