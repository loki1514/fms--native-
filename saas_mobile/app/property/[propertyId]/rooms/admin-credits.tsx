import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import SafeBlurView from '@/components/ui/SafeBlurView';
import {
  getCompaniesWithCreditsApi,
  updateMeetingRoomCreditsApi,
} from '@/utils/api/mobileApi';
import {
  ChevronLeft,
  Building2,
  Users,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Save,
  CheckCircle2,
} from 'lucide-react-native';

export default function AdminCreditsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Editing state
  const [editHours, setEditHours] = useState<Record<string, string>>({});
  const [editRemainingHours, setEditRemainingHours] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await getCompaniesWithCreditsApi(propertyId);
      if (res.companies) {
        setCompanies(res.companies);
        
        // Initialize edit states
        const initHours: Record<string, string> = {};
        const initRemaining: Record<string, string> = {};
        res.companies.forEach((comp: any) => {
          if (comp.credits && comp.credits.length > 0) {
            initHours[comp.id] = String(comp.credits[0].monthly_hours || 0);
            initRemaining[comp.id] = String(comp.credits[0].remaining_hours || 0);
          } else {
            initHours[comp.id] = '0';
            initRemaining[comp.id] = '0';
          }
        });
        setEditHours(initHours);
        setEditRemainingHours(initRemaining);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load companies.');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (companyId: string) => {
    setSavingId(companyId);
    try {
      const monthly = parseFloat(editHours[companyId] || '0');
      const remaining = parseFloat(editRemainingHours[companyId] || '0');

      if (isNaN(monthly) || isNaN(remaining)) {
        throw new Error('Invalid hours format');
      }

      const res = await updateMeetingRoomCreditsApi({
        propertyId,
        companyId,
        monthlyHours: monthly,
        remainingHours: remaining,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      Alert.alert('Success', 'Credits updated successfully');
      fetchData(); // Refresh to get latest DB state
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save credits.');
    } finally {
      setSavingId(null);
    }
  };

  const renderCompany = ({ item }: { item: any }) => {
    const isExpanded = expandedId === item.id;
    const credit = item.credits && item.credits.length > 0 ? item.credits[0] : null;
    const members = item.members || [];
    const isSaving = savingId === item.id;

    return (
      <View style={styles.companyCard}>
        <SafeBlurView intensity={40} tint="dark" style={styles.cardInner}>
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFillObject}
          />
          
          <TouchableOpacity 
            style={styles.cardHeader} 
            activeOpacity={0.7}
            onPress={() => setExpandedId(isExpanded ? null : item.id)}
          >
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.companyLogo} />
            ) : (
              <View style={styles.companyLogoPlaceholder}>
                <Building2 size={24} color="#708F96" />
              </View>
            )}
            
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{item.name}</Text>
              <Text style={styles.memberCount}>{members.length} Members</Text>
            </View>

            <View style={styles.expandIcon}>
              {isExpanded ? <ChevronUp size={20} color="#94A3B8" /> : <ChevronDown size={20} color="#94A3B8" />}
            </View>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.expandedContent}>
              <View style={styles.divider} />
              
              <Text style={styles.sectionTitle}>Assign Company Credits</Text>
              <View style={styles.creditForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Monthly Quota (Hours)</Text>
                  <TextInput
                    style={styles.input}
                    value={editHours[item.id]}
                    onChangeText={(v) => setEditHours(prev => ({ ...prev, [item.id]: v }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Remaining (Hours)</Text>
                  <TextInput
                    style={styles.input}
                    value={editRemainingHours[item.id]}
                    onChangeText={(v) => setEditRemainingHours(prev => ({ ...prev, [item.id]: v }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]} 
                onPress={() => handleSave(item.id)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={16} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save Credits</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Aligned Tenants</Text>
              
              {members.length === 0 ? (
                <Text style={styles.noMembersText}>No members assigned to this company.</Text>
              ) : (
                <View style={styles.membersList}>
                  {members.map((m: any, idx: number) => (
                    <View key={m.user?.id || idx} style={styles.memberItem}>
                      {m.user?.user_photo_url ? (
                        <Image source={{ uri: m.user.user_photo_url }} style={styles.memberAvatar} />
                      ) : (
                        <View style={styles.memberAvatarPlaceholder}>
                          <Users size={14} color="#94A3B8" />
                        </View>
                      )}
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{m.user?.full_name || 'Unknown'}</Text>
                        <Text style={styles.memberEmail}>{m.user?.email || 'No email'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

            </View>
          )}
        </SafeBlurView>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient
        colors={theme === 'dark' ? ['#0F1521', '#121824', '#090d16'] : ['#F5F0E8', '#EAE0D5', '#DFD3C3']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeBlurView intensity={80} tint="dark" style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Company Credits</Text>
          <Text style={styles.headerSubtitle}>Manage meeting room limits</Text>
        </View>
        <View style={{ width: 40 }} />
      </SafeBlurView>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#708F96" />
          <Text style={styles.loadingText}>Loading companies...</Text>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.id}
          renderItem={renderCompany}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Building2 size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyTitle}>No Companies Found</Text>
              <Text style={styles.emptySubtitle}>There are no companies registered in this property.</Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins-Bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, fontFamily: 'Urbanist-Medium', color: '#94A3B8' },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94A3B8', marginTop: 12, fontFamily: 'Urbanist-Medium' },
  listContent: { padding: 16 },
  companyCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardInner: { padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companyLogo: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFF' },
  companyLogoPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  companyInfo: { flex: 1 },
  companyName: { fontSize: 16, fontFamily: 'Poppins-Bold', color: '#FFF' },
  memberCount: { fontSize: 12, fontFamily: 'Urbanist-Medium', color: '#94A3B8', marginTop: 2 },
  expandIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  expandedContent: { marginTop: 16 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#FFF', marginBottom: 12 },
  creditForm: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#FFF', fontFamily: 'Urbanist-Bold', fontSize: 16 },
  saveBtn: { backgroundColor: '#708F96', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#FFF', fontFamily: 'Urbanist-Bold', fontSize: 14 },
  noMembersText: { fontSize: 13, color: '#94A3B8', fontFamily: 'Urbanist-Medium', fontStyle: 'italic' },
  membersList: { gap: 12 },
  memberItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18 },
  memberAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontFamily: 'Urbanist-Bold', color: '#FFF' },
  memberEmail: { fontSize: 12, fontFamily: 'Urbanist-Medium', color: '#94A3B8' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins-SemiBold', color: '#FFF', marginTop: 16 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Urbanist-Medium', color: '#94A3B8', textAlign: 'center', marginTop: 8 },
});
