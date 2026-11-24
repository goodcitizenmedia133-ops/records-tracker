import { useState } from 'react';
import {
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { DashboardScreen } from './screens/DashboardScreen';
import { NewRequestScreen } from './screens/NewRequestScreen';
import { RequestDetailScreen } from './screens/RequestDetailScreen';
import { VaultScreen } from './screens/VaultScreen';
import { VaultUploadScreen } from './screens/VaultUploadScreen';
import { PublicRecordItem } from './types/models';

type ActiveRoute =
  | { name: 'dashboard' }
  | { name: 'new' }
  | { name: 'detail'; itemId: string }
  | { name: 'vault' }
  | { name: 'vault_upload' };

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>({ name: 'dashboard' });
  const [refreshTick, setRefreshTick] = useState(0);

  const bumpRefresh = () => setRefreshTick((t) => t + 1);

  const handleSavedNew = (item: PublicRecordItem) => {
    bumpRefresh();
    setRoute({ name: 'detail', itemId: item.id });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.body}>
        {route.name === 'dashboard' ? (
          <DashboardScreen
            onSelectItem={(item: PublicRecordItem) =>
              setRoute({ name: 'detail', itemId: item.id })
            }
            onCreateNew={() => setRoute({ name: 'new' })}
            refreshTrigger={refreshTick}
          />
        ) : null}

        {route.name === 'new' ? (
          <NewRequestScreen
            onSaved={handleSavedNew}
            onCancel={() => setRoute({ name: 'dashboard' })}
          />
        ) : null}

        {route.name === 'detail' ? (
          <RequestDetailScreen
            itemId={route.itemId}
            onBack={() => {
              bumpRefresh();
              setRoute({ name: 'dashboard' });
            }}
            onUpdated={bumpRefresh}
            onSelectSiblingItem={(siblingId) =>
              setRoute({ name: 'detail', itemId: siblingId })
            }
          />
        ) : null}

        {route.name === 'vault' ? (
          <VaultScreen
            onDataChanged={bumpRefresh}
            onOpenUpload={() => setRoute({ name: 'vault_upload' })}
          />
        ) : null}

        {route.name === 'vault_upload' ? (
          <VaultUploadScreen
            onBack={() => {
              bumpRefresh();
              setRoute({ name: 'vault' });
            }}
          />
        ) : null}
      </View>

      <View style={styles.tabBar}>
        <Pressable
          onPress={() => {
            bumpRefresh();
            setRoute({ name: 'dashboard' });
          }}
          style={[
            styles.tabBtn,
            (route.name === 'dashboard' || route.name === 'detail') &&
              styles.tabBtnActive,
          ]}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.tabText,
              (route.name === 'dashboard' || route.name === 'detail') &&
                styles.tabTextActive,
            ]}
          >
            Requests
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setRoute({ name: 'new' })}
          style={[styles.tabBtn, route.name === 'new' && styles.tabBtnActive]}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.tabText,
              route.name === 'new' && styles.tabTextActive,
            ]}
          >
            + New
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setRoute({ name: 'vault' })}
          style={[
            styles.tabBtn,
            (route.name === 'vault' || route.name === 'vault_upload') && styles.tabBtnActive,
          ]}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.tabText,
              (route.name === 'vault' || route.name === 'vault_upload') && styles.tabTextActive,
            ]}
          >
            Agencies &amp; Vault
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: {
    backgroundColor: '#111827',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
});