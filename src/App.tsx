import { useState, Component, type ReactNode } from 'react';
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

class ScreenErrorBoundary extends Component<
  { children: ReactNode; onResetRoute: () => void },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode; onResetRoute: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected screen error.',
    };
  }

  componentDidCatch(error: unknown) {
    // Keep failure visible in console without crashing the full window
    console.error('ScreenErrorBoundary caught error:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onResetRoute();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={boundaryStyles.box}>
          <Text style={boundaryStyles.title}>Screen Recovered From Error</Text>
          <Text style={boundaryStyles.body}>
            Your saved requests and audit log remain in local storage. {this.state.message}
          </Text>
          <View style={boundaryStyles.row}>
            <Pressable onPress={this.handleRetry} style={boundaryStyles.btnPrimary}>
              <Text style={boundaryStyles.btnText}>Reload Screen</Text>
            </Pressable>
            <Pressable onPress={this.handleGoHome} style={boundaryStyles.btnSecondary}>
              <Text style={boundaryStyles.btnText}>Back to Requests</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const boundaryStyles = StyleSheet.create({
  box: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1E1B18',
    borderWidth: 1,
    borderColor: '#D97706',
    gap: 10,
  },
  title: {
    color: '#FDE68A',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: '#E5E7EB',
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnSecondary: {
    backgroundColor: '#374151',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});

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
          <ScreenErrorBoundary onResetRoute={() => setRoute({ name: 'dashboard' })}>
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
          </ScreenErrorBoundary>
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