import { Component, type ReactNode, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { NewRequestScreen } from '../screens/NewRequestScreen';
import { RequestDetailScreen } from '../screens/RequestDetailScreen';
import { VaultScreen } from '../screens/VaultScreen';
import { VaultUploadScreen } from '../screens/VaultUploadScreen';
import { PublicRecordItem } from '../types/models';

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

type ActiveRoute =
  | { name: 'dashboard' }
  | { name: 'new' }
  | { name: 'detail'; itemId: string }
  | { name: 'vault' }
  | { name: 'vault_upload' };

const SCREEN_TITLES: Record<ActiveRoute['name'], string> = {
  dashboard: 'Requests',
  new: 'New Request',
  detail: 'Request Details',
  vault: 'Agencies & Vault',
  vault_upload: 'Vault Upload Wizard',
};

const DISCLAIMER_VERSION = '1';
const DISCLAIMER_KEY = `records_tracker_disclaimer_v${DISCLAIMER_VERSION}`;

const DISCLAIMER_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'What this app is',
    body: 'Records Tracker is an informational organizing tool. It helps you draft public records requests, estimate response deadlines, and keep a log of your own activity.',
  },
  {
    heading: 'Not legal advice',
    body: 'We are not attorneys and this is not a law firm. Nothing in this app, including statute summaries, calculated deadlines, suggested clauses, and generated request text, is legal advice. Using the app does not create an attorney-client relationship.',
  },
  {
    heading: 'Verify everything',
    body: 'Laws, agency policies, holidays, and court decisions change, and your situation may differ. Deadlines shown are estimates. Confirm requirements with the official statute text, the agency, or a licensed attorney before relying on them.',
  },
  {
    heading: 'Your responsibility',
    body: 'You are solely responsible for the requests you send, the dates you record, and the decisions you make. The app is provided as-is, without warranties of any kind. To the fullest extent permitted by law, its creators are not liable for losses arising from its use.',
  },
  {
    heading: 'Your data',
    body: 'Your requests, notes, and files are stored on your own device. Some optional features, such as browser voice dictation, may use your browser\'s own services. A notice appears wherever that applies.',
  },
];

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getWebStorage(): WebStorage | null {
  try {
    const g = globalThis as unknown as { localStorage?: WebStorage };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

async function readDisclaimerAccepted(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return getWebStorage()?.getItem(DISCLAIMER_KEY) != null;
    }
    const SecureStore = await import('expo-secure-store');
    return (await SecureStore.getItemAsync(DISCLAIMER_KEY)) != null;
  } catch {
    return false;
  }
}

async function saveDisclaimerAccepted(): Promise<void> {
  const record = JSON.stringify({
    version: DISCLAIMER_VERSION,
    acceptedAt: new Date().toISOString(),
  });
  try {
    if (Platform.OS === 'web') {
      getWebStorage()?.setItem(DISCLAIMER_KEY, record);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(DISCLAIMER_KEY, record);
  } catch {
    // If saving fails, the notice simply appears again next time.
  }
}

export default function IndexScreen() {
  const [route, setRoute] = useState<ActiveRoute>({ name: 'dashboard' });
  const [refreshTick, setRefreshTick] = useState(0);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const already = await readDisclaimerAccepted();
      if (!cancelled) setAccepted(already);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bumpRefresh = () => setRefreshTick((t) => t + 1);

  const goToDashboard = () => {
    bumpRefresh();
    setRoute({ name: 'dashboard' });
  };

  const handleSavedNew = (item: PublicRecordItem) => {
    bumpRefresh();
    setRoute({ name: 'detail', itemId: item.id });
  };

  const handleAccept = async () => {
    if (!checked) return;
    await saveDisclaimerAccepted();
    setAccepted(true);
  };

  if (accepted === null) {
    return <SafeAreaView style={styles.safe} />;
  }

  if (!accepted) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.gateContent}>
          <Text style={styles.gateTitle}>Important Notice</Text>
          <Text style={styles.gateSub}>
            Please read before using Records Tracker
          </Text>

          {DISCLAIMER_SECTIONS.map((section) => (
            <View key={section.heading} style={styles.gateCard}>
              <Text style={styles.gateHeading}>{section.heading}</Text>
              <Text style={styles.gateBody}>{section.body}</Text>
            </View>
          ))}

          <Pressable
            onPress={() => setChecked((c) => !c)}
            style={styles.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
              {checked ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>
              I have read and understand this notice, and I accept it.
            </Text>
          </Pressable>

          <Pressable
            onPress={handleAccept}
            disabled={!checked}
            style={[styles.acceptBtn, !checked && styles.acceptBtnDisabled]}
            accessibilityRole="button"
          >
            <Text style={styles.acceptBtnText}>Continue</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const showHeader = route.name !== 'dashboard';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {showHeader ? (
        <View style={styles.header}>
          <Pressable
            onPress={goToDashboard}
            style={({ pressed }) => [
              styles.dashBtn,
              pressed && styles.btnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
          >
            <Text style={styles.dashBtnText}>← Dashboard</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {SCREEN_TITLES[route.name]}
          </Text>
        </View>
      ) : null}

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

        <ScreenErrorBoundary onResetRoute={goToDashboard}>
        {route.name === 'detail' ? (
          <RequestDetailScreen
            itemId={route.itemId}
            onBack={goToDashboard}
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
        </ScreenErrorBoundary>
      </View>

      <Text style={styles.disclaimer}>
        Informational tracking tool — not legal advice. Verify deadlines with
        the statute or an attorney.
      </Text>

      <View style={styles.tabBar}>
        <Pressable
          onPress={goToDashboard}
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
  gateContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  gateTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginTop: 12,
  },
  gateSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  gateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  gateHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  gateBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    minHeight: 44,
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
  },
  acceptBtn: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  acceptBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dashBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.85,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  body: {
    flex: 1,
  },
  disclaimer: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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