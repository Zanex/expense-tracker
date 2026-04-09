module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Tipi consentiti per questo progetto
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "refactor",
        "style",
        "docs",
        "test",
        "perf",
        "ci",
        "revert",
      ],
    ],
    // Scope opzionale ma se presente deve essere lowercase
    "scope-case": [2, "always", "lower-case"],
    // Soggetto obbligatorio, non vuoto
    "subject-empty": [2, "never"],
    // Nessun punto finale nel subject
    "subject-full-stop": [2, "never", "."],
    // Max 100 caratteri per riga
    "header-max-length": [2, "always", 100],
  },
};