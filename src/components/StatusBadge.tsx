import { StyleSheet, Text, View } from 'react-native';
import { getWorkingDaysRemaining, isOverdue } from '../data/statutes';
import { RecordStatus } from '../types/models';

interface StatusBadgeProps {
  status: RecordStatus;
  dueDate?: string | null;
  showCountdown?: boolean;
}

const STATUS_META: Record<
  RecordStatus,
  { label: string; bg: string; fg: string }
> = {
  draft: { label: 'DRAFT', bg: '#E5E7EB', fg: '#374151' },
  sent: { label: 'SENT', bg: '#DBEAFE', fg: '#1D4ED8' },
  extended: { label: 'EXTENDED', bg: '#FEF3C7', fg: '#B45309' },
  fee_paused: { label: 'FEE PAUSED', bg: '#F3E8FF', fg: '#6D28D9' },
  partially_fulfilled: { label: 'PARTIAL', bg: '#E0F2FE', fg: '#0369A1' },
  fulfilled: { label: 'FULFILLED', bg: '#DCFCE7', fg: '#15803D' },
  denied: { label: 'DENIED', bg: '#FEE2E2', fg: '#B91C1C' },
  overdue: { label: 'OVERDUE', bg: '#FEE2E2', fg: '#B91C1C' },
};

export function StatusBadge({
  status,
  dueDate = null,
  showCountdown = true,
}: StatusBadgeProps) {
  const overdueNow = isOverdue(status, dueDate);
  const effectiveStatus: RecordStatus = overdueNow ? 'overdue' : status;
  const meta = STATUS_META[effectiveStatus] ?? STATUS_META.draft;

  let countdownLabel: string | null = null;
  if (
    showCountdown &&
    dueDate &&
    effectiveStatus !== 'draft' &&
    effectiveStatus !== 'fulfilled' &&
    effectiveStatus !== 'denied'
  ) {
    const daysLeft = getWorkingDaysRemaining(dueDate);
    if (daysLeft < 0) {
      const late = Math.abs(daysLeft);
      countdownLabel = `${late} working ${late === 1 ? 'day' : 'days'} late`;
    } else if (daysLeft === 0) {
      countdownLabel = 'Due today';
    } else {
      countdownLabel = `${daysLeft} working ${daysLeft === 1 ? 'day' : 'days'} left`;
    }
  }

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
        <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
      </View>
      {countdownLabel ? (
        <Text
          style={[
            styles.countdown,
            overdueNow ? styles.countdownOverdue : styles.countdownNormal,
          ]}
        >
          {countdownLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  countdown: {
    fontSize: 12,
    fontWeight: '600',
  },
  countdownNormal: {
    color: '#4B5563',
  },
  countdownOverdue: {
    color: '#B91C1C',
  },
});