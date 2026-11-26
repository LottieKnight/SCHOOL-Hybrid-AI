import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/ui/Screen";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { fetchWalletBalance, fetchWalletLedger } from "../../src/lib/api/wallet";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function TransactionRow({
  type,
  reason,
  amount,
  createdAt,
}: {
  type: "CREDIT" | "DEBIT";
  reason: string;
  amount: number;
  createdAt: string;
}) {
  const credit = type === "CREDIT";
  return (
    <View style={styles.transactionRow}>
      <View style={[styles.transactionIcon, credit ? styles.creditIcon : styles.debitIcon]}>
        <Ionicons name={credit ? "arrow-up" : "arrow-down"} size={16} color={credit ? colors.green : colors.red} />
      </View>
      <View style={styles.transactionText}>
        <Text style={styles.transactionReason} numberOfLines={1}>
          {reason}
        </Text>
        <Text style={styles.transactionMeta}>{formatDate(createdAt)}</Text>
      </View>
      <Text style={[styles.transactionAmount, credit ? styles.creditAmount : styles.debitAmount]}>
        {credit ? "+" : "-"}
        {amount}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const balanceQuery = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: fetchWalletBalance,
  });

  const ledgerQuery = useQuery({
    queryKey: ["wallet-ledger", 10],
    queryFn: () => fetchWalletLedger(10),
  });

  const wallet = balanceQuery.data?.wallet;
  const ledger = ledgerQuery.data?.entries ?? [];
  const balance = wallet?.balanceCredits ?? 0;
  const creditsCopy = useMemo(() => `${formatCurrency(balance)} Scholar Credits`, [balance]);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.kicker}>WALLET</Text>
        <Text style={styles.title}>Scholar Credits</Text>
        <Text style={styles.subtitle}>Track the credits you earn and spend across SCHOOL.</Text>
      </View>

      <GlassCard>
        <Text style={styles.balanceLabel}>Current balance</Text>
        <Text style={styles.balanceValue}>{creditsCopy}</Text>
        <Text style={styles.balanceMeta}>Currency: {wallet?.currency ?? "ZAR"}</Text>
      </GlassCard>

      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent transactions</Text>
          <Text style={styles.sectionHint}>{ledger.length} shown</Text>
        </View>

        {ledger.length > 0 ? (
          <View style={styles.ledgerList}>
            {ledger.map((entry) => (
              <TransactionRow
                key={entry.id}
                type={entry.type}
                reason={entry.reason}
                amount={entry.amountCredits}
                createdAt={entry.createdAt}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyState}>No transactions yet. Earn or spend credits to see activity here.</Text>
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  balanceLabel: {
    color: colors.textSoft,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  balanceValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginTop: 4,
  },
  balanceMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHint: {
    color: colors.textSoft,
    fontSize: 12,
  },
  ledgerList: {
    gap: spacing.xs,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  transactionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  creditIcon: {
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  debitIcon: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  transactionText: {
    flex: 1,
    gap: 2,
  },
  transactionReason: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  transactionMeta: {
    color: colors.textSoft,
    fontSize: 11,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: "800",
  },
  creditAmount: {
    color: colors.green,
  },
  debitAmount: {
    color: colors.red,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
