import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { RequestCard } from '../components/RequestCard';
import { isOverdue } from '../data/statutes';
import { getAllItems, searchItems } from '../services/database';
import { PublicRecordItem, RecordStatus } from '../types/models';

interface DashboardScreenProps {
  onSelectItem: (item: PublicRecordItem) => void;
  onCreateNew: () => void;
  refreshTrigger?: number;
}

const STATUS_FILTERS: { label: string; value: RecordStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Sent', value: 'sent' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Extended', value: 'extended' },
  { label: 'Fee Paused', value: 'fee_paused' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Fulfilled', value: 'fulfilled' },
];

export function DashboardScreen({
  onSelectItem,
  onCreateNew,
  refreshTrigger = 0,
}: DashboardScreenProps) {
  const [items, setItems] = useState<PublicRecordItem[]>([]);
  const [allItems, setAllItems] = useState<PublicRecordItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGuide, setShowGuide] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('gcm_hide_starter_guide') !== '1';
      }
    } catch {}
    return true;
  });

  const toggleGuide = (visible: boolean) => {
    setShowGuide(visible);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gcm_hide_starter_guide', visible ? '0' : '1');
      }
    } catch {}
  };

  const loadData = useCallback(async () => {
    try {
      const fullList = await getAllItems();
      setAllItems(fullList);

      if (statusFilter === 'overdue') {
        const filtered = fullList.filter((item) => {
          const matchesStatus = isOverdue(item.status, item.dueDate);
          if (!matchesStatus) return false;
          if (!query.trim()) return true;
          const q = query.trim().toLowerCase();
          return (
            item.title.toLowerCase().includes(q) ||
            item.agencyName.toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q)
          );
        });
        setItems(filtered);
      } else {
        const results = await searchItems(query, statusFilter);
        setItems(results);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeCount = allItems.filter(
    (i) =>
      i.status === 'sent' ||
      i.status === 'extended' ||
      i.status === 'partially_fulfilled'
  ).length;
  const overdueCount = allItems.filter((i) =>
    isOverdue(i.status, i.dueDate)
  ).length;
  const draftCount = allItems.filter((i) => i.status === 'draft').length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Records Tracker</Text>
          <Text style={styles.headerSub}>Saved locally · Response due date tracker</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => toggleGuide(!showGuide)}
            style={({ pressed }) => [
              styles.guideToggleBtn,
              pressed && styles.btnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={showGuide ? 'Hide quick walkthrough' : 'Show quick walkthrough'}
          >
            <Text style={styles.guideToggleText}>{showGuide ? 'Hide Guide' : 'Guide'}</Text>
          </Pressable>
          <Pressable
            onPress={onCreateNew}
            style={({ pressed }) => [
              styles.newBtn,
              pressed && styles.btnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create new records request"
          >
            <Text style={styles.newBtnText}>+ New Request</Text>
          </Pressable>
        </View>
      </View>

      {showGuide ? (
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <Text style={styles.guideTitle}>Quick Walkthrough: First Request</Text>
            <Pressable onPress={() => toggleGuide(false)} accessibilityRole="button">
              <Text style={styles.guideDismiss}>Dismiss</Text>
            </Pressable>
          </View>
          <Text style={styles.guideStep}>1. Tap "+ New Request" to pick the agency, statute, summary, and your sign-off.</Text>
          <Text style={styles.guideStep}>2. Open the request to review the letter, set your sender account, and launch mail or copy the full packet.</Text>
          <Text style={styles.guideStep}>3. Tap "Mark as sent" once sent so the tracker logs the filing date and statutory due date.</Text>
          <Pressable
            onPress={onCreateNew}
            style={({ pressed }) => [styles.guideCtaBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.guideCtaText}>Start First Request</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View
          style={[
            styles.statCard,
            overdueCount > 0 && styles.statCardDanger,
          ]}
        >
          <Text
            style={[
              styles.statValue,
              overdueCount > 0 && styles.statValueDanger,
            ]}
          >
            {overdueCount}
          </Text>
          <Text
            style={[
              styles.statLabel,
              overdueCount > 0 && styles.statValueDanger,
            ]}
          >
            Overdue
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{draftCount}</Text>
          <Text style={styles.statLabel}>Drafts</Text>
        </View>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search title, agency, or summary..."
        placeholderTextColor="#9CA3AF"
        style={styles.searchInput}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatusFilter(f.value)}
              style={[
                styles.filterChip,
                active && styles.filterChipActive,
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard item={item} onPress={onSelectItem} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No matching requests</Text>
              <Text style={styles.emptySub}>
                Clear your filters or tap "+ New Request" to start tracking one.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  headerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  newBtn: {
    minHeight: 44,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.85,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statValueDanger: {
    color: '#B91C1C',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  searchInput: {
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 10,
  },
  filterBar: {
    maxHeight: 44,
    marginBottom: 10,
  },
  filterBarContent: {
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 28,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  guideToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  guideCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    gap: 6,
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  guideDismiss: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  guideStep: {
    fontSize: 12,
    lineHeight: 17,
    color: '#1E293B',
  },
  guideCtaBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#1D4ED8',
  },
  guideCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});