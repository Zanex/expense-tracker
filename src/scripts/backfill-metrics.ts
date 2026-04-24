import { PrismaClient } from "@prisma/client";
import { toNumber } from "../lib/utils";

const db = new PrismaClient();

interface TxForCalc {
  type: string;
  quantity: number | { toNumber: () => number };
  pricePerUnit: number | { toNumber: () => number };
  fees: number | { toNumber: () => number };
  date: Date;
}

function calculatePositionMetrics(
  transactions: TxForCalc[]
) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentQty = 0;
  let totalCostBasis = 0;
  let avgCostPerUnit = 0;
  let realizedPnL = 0;
  let totalDividends = 0;
  let totalFees = 0;

  for (const tx of sorted) {
    const qty = toNumber(tx.quantity);
    const price = toNumber(tx.pricePerUnit);
    const fee = toNumber(tx.fees);

    if (tx.type === "buy") {
      const txCost = qty * price + fee;
      totalCostBasis += txCost;
      currentQty += qty;
      avgCostPerUnit = currentQty > 0 ? totalCostBasis / currentQty : 0;
      totalFees += fee;
    } else if (tx.type === "sell") {
      const costOfSold = avgCostPerUnit * qty;
      realizedPnL += qty * price - fee - costOfSold;
      totalCostBasis -= costOfSold;
      currentQty -= qty;
      totalFees += fee;
    } else if (tx.type === "dividend") {
      totalDividends += qty * price - fee;
      totalFees += fee;
    } else if (tx.type === "fee") {
      totalFees += qty * price;
    }
  }

  const r = (n: number) => Math.round(n * 100) / 100;
  const r8 = (n: number) => Math.round(n * 1e8) / 1e8;

  return {
    currentQty: r8(currentQty),
    costBasis: r(totalCostBasis),
    realizedPnL: r(realizedPnL),
    totalDividends: r(totalDividends),
    totalFees: r(totalFees),
  };
}

async function main() {
  console.log("🚀 Inizio ricalcolo metriche investimenti...");

  const investments = await db.investment.findMany({
    include: { transactions: true },
  });

  console.log(`🔍 Trovati ${investments.length} investimenti.`);

  for (const inv of investments) {
    console.log(`   - Elaborazione: ${inv.name} (${inv.transactions.length} transazioni)`);
    
    const metrics = calculatePositionMetrics(inv.transactions);

    await db.investment.update({
      where: { id: inv.id },
      data: {
        currentQty: metrics.currentQty,
        costBasis: metrics.costBasis,
        realizedPnL: metrics.realizedPnL,
        totalDividends: metrics.totalDividends,
        totalFees: metrics.totalFees,
      },
    });
  }

  console.log("✅ Ricalcolo completato con successo!");
}

main()
  .catch((e) => {
    console.error("❌ Errore durante il ricalcolo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
