import {
  Document,
  Page,
  Text,
  View,
  StyleSheet
} from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────

interface ExpenseRow {
  date: string;
  description: string;
  category: string;
  amount: string;
}

interface CategorySummary {
  name: string;
  icon: string;
  total: string;
}

interface ExpenseReportProps {
  title: string;
  period: string;
  userEmail: string;
  totalAmount: string;
  expenseCount: number;
  expenses: ExpenseRow[];
  categorySummary: CategorySummary[];
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#6366f1",
  },
  headerLeft: {
    flexDirection: "column",
    gap: 4,
  },
  appName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#6366f1",
  },
  reportTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  },
  headerMeta: {
    fontSize: 9,
    color: "#6b7280",
  },

  // KPI row
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#f5f3ff",
    borderRadius: 6,
    padding: 12,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#6366f1",
  },
  kpiSub: {
    fontSize: 8,
    color: "#9ca3af",
  },

  // Section
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: "6 8",
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  colDate: { width: "15%", color: "#6b7280" },
  colDescription: { width: "45%" },
  colCategory: { width: "20%", color: "#6b7280" },
  colAmount: { width: "20%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  colHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    textTransform: "uppercase",
  },

  // Category summary
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "48%",
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: "6 8",
  },
  summaryName: {
    fontSize: 9,
    color: "#374151",
  },
  summaryAmount: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#6366f1",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

// ─── Component ───────────────────────────────────────────

export function ExpenseReport({
  title,
  period,
  userEmail,
  totalAmount,
  expenseCount,
  expenses,
  categorySummary,
}: ExpenseReportProps) {
  const generatedAt = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appName}>Expense Tracker</Text>
            <Text style={styles.reportTitle}>{title}</Text>
            <Text style={styles.headerMeta}>{period}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>{userEmail}</Text>
            <Text style={styles.headerMeta}>Generato il {generatedAt}</Text>
          </View>
        </View>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Totale spese</Text>
            <Text style={styles.kpiValue}>{totalAmount}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Numero transazioni</Text>
            <Text style={styles.kpiValue}>{String(expenseCount)}</Text>
            <Text style={styles.kpiSub}>
              {expenseCount === 1 ? "transazione" : "transazioni"}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Media per spesa</Text>
            <Text style={styles.kpiValue}>
              {expenseCount > 0
                ? `€ ${(
                    parseFloat(totalAmount.replace("€", "").replace(",", ".").trim()) /
                    expenseCount
                  ).toFixed(2)}`
                : "€ 0,00"}
            </Text>
          </View>
        </View>

        {/* Tabella spese */}
        <Text style={styles.sectionTitle}>Dettaglio spese</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.colDate, styles.colHeaderText]}>Data</Text>
          <Text style={[styles.colDescription, styles.colHeaderText]}>
            Descrizione
          </Text>
          <Text style={[styles.colCategory, styles.colHeaderText]}>
            Categoria
          </Text>
          <Text style={[styles.colAmount, styles.colHeaderText]}>Importo</Text>
        </View>

        {expenses.map((expense, i) => (
          <View
            key={i}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.colDate}>{expense.date}</Text>
            <Text style={styles.colDescription}>{expense.description}</Text>
            <Text style={styles.colCategory}>{expense.category}</Text>
            <Text style={styles.colAmount}>{expense.amount}</Text>
          </View>
        ))}

        {/* Riepilogo per categoria */}
        {categorySummary.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Riepilogo per categoria</Text>
            <View style={styles.summaryGrid}>
              {categorySummary.map((cat, i) => (
                <View key={i} style={styles.summaryItem}>
                  <Text style={styles.summaryName}>
                    {cat.name}
                  </Text>
                  <Text style={styles.summaryAmount}>{cat.total}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Expense Tracker — {period}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Pagina ${pageNumber} di ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
