import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StrategyCard } from '../services/wizardEngine';

interface StrategyCardListProps {
  cards: StrategyCard[];
  onInsertClause?: (clauseText: string) => void;
  splitSuggestions?: string[];
  onApplySplit?: () => void;
}

const SEVERITY_META: Record<
  StrategyCard['severity'],
  { border: string; bg: string; tagBg: string; tagFg: string; label: string }
> = {
  action: {
    border: '#93C5FD',
    bg: '#EFF6FF',
    tagBg: '#DBEAFE',
    tagFg: '#1D4ED8',
    label: 'RECOMMENDED CLAUSE',
  },
  warning: {
    border: '#FCD34D',
    bg: '#FFFBEB',
    tagBg: '#FEF3C7',
    tagFg: '#B45309',
    label: 'SCOPING / FEE TIP',
  },
  info: {
    border: '#E5E7EB',
    bg: '#FFFFFF',
    tagBg: '#F3F4F6',
    tagFg: '#374151',
    label: 'STATUTORY NOTE',
  },
};

export function StrategyCardList({
  cards,
  onInsertClause,
  splitSuggestions = [],
  onApplySplit,
}: StrategyCardListProps) {
  if (cards.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Strategy &amp; Compliance Guidance</Text>

      {cards.map((card) => {
        const meta = SEVERITY_META[card.severity] ?? SEVERITY_META.info;
        const isSplitCard = card.id === 'split-fee-strategy';

        return (
          <View
            key={card.id}
            style={[
              styles.card,
              { borderColor: meta.border, backgroundColor: meta.bg },
            ]}
          >
            <View style={[styles.tag, { backgroundColor: meta.tagBg }]}>
              <Text style={[styles.tagText, { color: meta.tagFg }]}>
                {meta.label}
              </Text>
            </View>

            <Text style={styles.title}>{card.title}</Text>
            <Text style={styles.detail}>{card.detail}</Text>

            {card.recommendedText ? (
              <View style={styles.clauseBox}>
                <Text style={styles.clauseText}>{card.recommendedText}</Text>
                {onInsertClause ? (
                  <Pressable
                    onPress={() => onInsertClause(card.recommendedText!)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      pressed && styles.btnPressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionBtnText}>
                      + Append Clause to Request
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {isSplitCard && splitSuggestions.length > 0 ? (
              <View style={styles.splitBox}>
                {splitSuggestions.map((s, idx) => (
                  <Text key={idx} style={styles.splitItem}>
                    • {s}
                  </Text>
                ))}
                {onApplySplit ? (
                  <Pressable
                    onPress={onApplySplit}
                    style={({ pressed }) => [
                      styles.splitBtn,
                      pressed && styles.btnPressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.splitBtnText}>
                      Split Into {splitSuggestions.length} Separate Drafts
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    gap: 10,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  detail: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  clauseBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
    gap: 8,
  },
  clauseText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#1F2937',
    lineHeight: 17,
  },
  actionBtn: {
    minHeight: 44,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  splitBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    gap: 6,
  },
  splitItem: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  splitBtn: {
    minHeight: 44,
    backgroundColor: '#B45309',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 4,
  },
  splitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.85,
  },
});