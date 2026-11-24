import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PublicRecordItem } from '../types/models';
import { StatusBadge } from './StatusBadge';

interface RequestCardProps {
  item: PublicRecordItem;
  onPress: (item: PublicRecordItem) => void;
}

export function RequestCard({ item, onPress }: RequestCardProps) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open request ${item.title}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.agency} numberOfLines={1}>
          {item.agencyName}
        </Text>
        <View style={styles.statutePill}>
          <Text style={styles.statuteText}>{item.statuteCode}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {item.summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {item.summary}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <StatusBadge status={item.status} dueDate={item.dueDate} />
        <View style={styles.metaRight}>
          {item.feeQuoted !== null ? (
            <Text style={styles.feeText}>Fee: ${item.feeQuoted.toFixed(2)}</Text>
          ) : null}
          {item.dueDate ? (
            <Text style={styles.dueText}>Due {item.dueDate}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 44,
  },
  cardPressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  agency: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  statutePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statuteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  summary: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
  },
  dueText: {
    fontSize: 12,
    color: '#4B5563',
  },
});