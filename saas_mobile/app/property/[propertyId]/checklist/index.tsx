import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import {
  CheckSquare,
  Plus,
  ClipboardList,
  Play,
  Clock,
  User,
  ChevronRight,
  X,
  Camera,
  CheckCircle2,
  Circle,
  ArrowLeft,
  AlertCircle,
  FileText,
  ListChecks,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  requires_photo: boolean;
  order_index: number;
  section_title?: string;
}

interface SOPTemplate {
  id: string;
  name: string;
  description?: string;
  frequency?: string;
  is_running: boolean;
  start_time?: string;
  end_time?: string;
  assigned_to?: string[];
  property_id: string;
  items: ChecklistItem[];
  completions: SOPCompletion[];
}

interface SOPCompletion {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  completion_date?: string;
  completed_at?: string;
  user_id?: string;
  items: SOPCompletionItem[];
}

interface SOPCompletionItem {
  id: string;
  is_checked: boolean;
  value?: string;
  photo_url?: string;
  checklist_item_id: string;
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function isDueToday(frequency: string | undefined, lastDone: string | null): { due: boolean; label: string } {
  if (!frequency) return { due: false, label: '' };
  const today = new Date().toDateString();
  if (!lastDone || new Date(lastDone).toDateString() !== today) {
    if (frequency === 'daily') return { due: true, label: 'Due today' };
    if (frequency === 'weekly') {
      const d = new Date(lastDone || Date.now());
      return { due: new Date().getTime() - d.getTime() > 7 * 86400000, label: 'Due this week' };
    }
    if (frequency === 'monthly') return { due: true, label: 'Due this month' };
  }
  return { due: false, label: '' };
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const diffDays = Math.floor(diff / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

type ViewMode = 'active' | 'templates' | 'runner';

export default function ChecklistScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { theme } = useTheme();
  const { user, membership } = useAuth();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  // ── State ────────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [templates, setTemplates] = useState<SOPTemplate[]>([]);
  const [completions, setCompletions] = useState<SOPCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showRunner, setShowRunner] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<SOPTemplate | null>(null);
  const [activeCompletion, setActiveCompletion] = useState<SOPCompletion | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, { checked: boolean; photo?: string; value?: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [liveNow, setLiveNow] = useState(() => new Date());

  // Template form state
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplFrequency, setTplFrequency] = useState('daily');
  const [tplItems, setTplItems] = useState<{ title: string; description: string; requires_photo: boolean }[]>([]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const isAdmin = useMemo(() => {
    if (!membership || !propertyId) return false;
    const prop = membership.properties.find((p) => p.id === propertyId);
    if (!prop) return false;
    return ['property_admin', 'org_admin', 'org_super_admin', 'master_admin'].includes(prop.role.toLowerCase());
  }, [membership, propertyId]);

  const dueTemplates = useMemo(() => {
    const now = new Date();
    return templates.filter((t) => {
      if (!t.is_running) return false;
      const lastDone = t.completions
        .filter((c) => c.status === 'completed')
        .sort((a, b) => new Date(b.completed_at || b.completion_date || 0).getTime() - new Date(a.completed_at || a.completion_date || 0).getTime())[0];
      const { due } = isDueToday(t.frequency, lastDone?.completion_date || lastDone?.completed_at || null);
      return due;
    });
  }, [templates]);

  const completedCount = useMemo(() => {
    return templates.reduce((sum, t) => sum + (t.completions?.filter((c) => c.status === 'completed').length || 0), 0);
  }, [templates]);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!propertyId) return;
    try {
      const { data, error } = await supabase
        .from('sop_templates')
        .select(`
          *,
          items:sop_checklist_items(*),
          completions:sop_completions(*)
        `)
        .eq('property_id', propertyId)
        .eq('is_active', true);
      if (error) throw error;
      setTemplates((data || []) as SOPTemplate[]);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }, [propertyId]);

  const fetchAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      await fetchTemplates();
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchTemplates]);

  useEffect(() => {
    if (propertyId) fetchAll();
  }, [propertyId, fetchAll]);

  // Live clock for overdue detection
  useEffect(() => {
    const id = setInterval(() => setLiveNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleRefresh = () => fetchAll(true);

  const handleStartChecklist = async (template: SOPTemplate, existingCompletion?: SOPCompletion) => {
    if (existingCompletion && existingCompletion.status !== 'completed') {
      // Resume existing in-progress
      setActiveTemplate(template);
      setActiveCompletion(existingCompletion);
      initItemStates(template, existingCompletion);
      setShowRunner(true);
      setViewMode('runner');
      return;
    }

    // Create new completion session
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.from('sop_completions') as any)
        .insert({ property_id: propertyId, template_id: template.id, status: 'in_progress', user_id: user?.id || null })
        .select()
        .single();
      if (error) throw error;

      // Insert completion items
      const completionItems = template.items.map((item) => ({
        completion_id: data.id,
        checklist_item_id: item.id,
        is_checked: false,
      }));
      if (completionItems.length > 0) {
        await (supabase.from('sop_completion_items') as any).insert(completionItems);
      }

      const newCompletion = data as SOPCompletion;
      setActiveTemplate(template);
      setActiveCompletion({ ...newCompletion, items: [] });
      initItemStates(template, { ...newCompletion, items: [] });
      setShowRunner(true);
      setViewMode('runner');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start checklist');
    } finally {
      setIsLoading(false);
    }
  };

  const initItemStates = (template: SOPTemplate, completion: SOPCompletion) => {
    const states: Record<string, { checked: boolean; photo?: string; value?: string }> = {};
    template.items.forEach((item) => {
      const compItem = completion.items.find((ci) => ci.checklist_item_id === item.id);
      states[item.id] = {
        checked: compItem?.is_checked || false,
        photo: compItem?.photo_url,
        value: compItem?.value,
      };
    });
    setItemStates(states);
  };

  const toggleItem = async (item: ChecklistItem) => {
    const current = itemStates[item.id]?.checked || false;
    const newChecked = !current;

    // Optimistic update
    setItemStates((prev) => ({ ...prev, [item.id]: { ...prev[item.id], checked: newChecked } }));

    try {
      if (!activeCompletion) return;
      const compItem = activeCompletion.items.find((ci) => ci.checklist_item_id === item.id);
      if (compItem) {
        await (supabase.from('sop_completion_items') as any).update({ is_checked: newChecked }).eq('id', compItem.id);
      }
    } catch (err) {
      // Rollback
      setItemStates((prev) => ({ ...prev, [item.id]: { ...prev[item.id], checked: current } }));
    }
  };

  const handlePhotoCapture = async (item: ChecklistItem) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to capture photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setItemStates((prev) => ({ ...prev, [item.id]: { ...prev[item.id], photo: uri } }));
      // Upload photo
      if (activeCompletion) {
        try {
          const compItem = activeCompletion.items.find((ci) => ci.checklist_item_id === item.id);
          if (compItem) {
            const uriParts = uri.split('/');
            const filename = uriParts[uriParts.length - 1];
            const formData = new FormData();
            formData.append('file', { uri, name: filename, type: 'image/jpeg' } as any);
            formData.append('completionItemId', compItem.id);
            await fetch(`/api/upload`, { method: 'POST', body: formData });
            await (supabase.from('sop_completion_items') as any).update({ photo_url: filename }).eq('id', compItem.id);
          }
        } catch {}
      }
    }
  };

  const handleCompleteChecklist = async () => {
    if (!activeCompletion || !activeTemplate) return;
    const allChecked = activeTemplate.items.every((item) => itemStates[item.id]?.checked);
    if (!allChecked) {
      const unchecked = activeTemplate.items.filter((item) => !itemStates[item.id]?.checked).length;
      Alert.alert('Incomplete', `${unchecked} item(s) not checked. Please complete all items before submitting.`);
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await (supabase.from('sop_completions') as any)
        .update({ status: 'completed', completed_at: new Date().toISOString(), completion_date: new Date().toISOString().split('T')[0] })
        .eq('id', activeCompletion.id);
      if (error) throw error;
      setShowRunner(false);
      setViewMode('active');
      setActiveTemplate(null);
      setActiveCompletion(null);
      setItemStates({});
      Alert.alert('Success', 'Checklist completed successfully!');
      await fetchAll();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to complete checklist');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!tplName.trim() || !propertyId) {
      Alert.alert('Error', 'Template name is required');
      return;
    }
    if (tplItems.length === 0) {
      Alert.alert('Error', 'Add at least one checklist item');
      return;
    }
    setIsSaving(true);
    try {
      // Create template
      const { data: tplData, error: tplError } = await (supabase.from('sop_templates') as any)
        .insert({ property_id: propertyId, name: tplName.trim(), description: tplDesc.trim() || null, frequency: tplFrequency, is_running: true })
        .select()
        .single();
      if (tplError) throw tplError;

      // Create checklist items
      const itemsToInsert = tplItems.map((item, idx) => ({
        template_id: tplData.id,
        title: item.title.trim(),
        description: item.description.trim() || null,
        requires_photo: item.requires_photo,
        order_index: idx,
      }));
      const { error: itemsError } = await (supabase.from('sop_checklist_items') as any).insert(itemsToInsert);
      if (itemsError) throw itemsError;

      setShowCreateTemplate(false);
      resetTemplateForm();
      await fetchTemplates();
      Alert.alert('Success', 'Template created successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create template');
    } finally {
      setIsSaving(false);
    }
  };

  const resetTemplateForm = () => {
    setTplName('');
    setTplDesc('');
    setTplFrequency('daily');
    setTplItems([]);
  };

  const addTemplateItem = () => {
    setTplItems((prev) => [...prev, { title: '', description: '', requires_photo: false }]);
  };

  const updateTemplateItem = (idx: number, field: string, value: any) => {
    setTplItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeTemplateItem = (idx: number) => {
    setTplItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCancelRunner = () => {
    setShowRunner(false);
    setViewMode('active');
    setActiveTemplate(null);
    setActiveCompletion(null);
    setItemStates({});
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const bgColor = theme === 'light' ? '#FBF8F4' : colors.background;

  if (isLoading && templates.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading checklists...</Text>
        </View>
      </View>
    );
  }

  // ── Runner View ──
  if (viewMode === 'runner' && activeTemplate) {
    const completedCount = activeTemplate.items.filter((item) => itemStates[item.id]?.checked).length;
    const progress = activeTemplate.items.length > 0 ? completedCount / activeTemplate.items.length : 0;
    const allDone = completedCount === activeTemplate.items.length;

    // Group items by section
    const sections: Record<string, ChecklistItem[]> = {};
    activeTemplate.items.forEach((item) => {
      const section = item.section_title || 'General';
      if (!sections[section]) sections[section] = [];
      sections[section].push(item);
    });

    return (
      <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={[styles.runnerHeader, { backgroundColor: colors.primary }]}>
          <View style={styles.runnerHeaderTop}>
            <TouchableOpacity style={styles.runnerBackBtn} onPress={handleCancelRunner}>
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.runnerTitleGroup}>
              <Text style={styles.runnerTitle}>{activeTemplate.name}</Text>
              {activeTemplate.description && (
                <Text style={styles.runnerSubtitle}>{activeTemplate.description}</Text>
              )}
            </View>
          </View>
          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressCount}>{completedCount}/{activeTemplate.items.length}</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <View style={[styles.progressFill, { backgroundColor: '#FFFFFF', width: `${progress * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Checklist */}
        <FlatList
          data={Object.entries(sections)}
          keyExtractor={([section]) => section}
          contentContainerStyle={styles.runnerList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <TouchableOpacity
              style={[styles.completeBtn, { backgroundColor: allDone ? colors.success : colors.textTertiary }, isSaving && { opacity: 0.6 }]}
              onPress={handleCompleteChecklist}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <CheckCircle2 size={20} color="#FFFFFF" />
                  <Text style={styles.completeBtnText}>
                    {allDone ? 'Complete Checklist' : `Complete (${completedCount}/${activeTemplate.items.length})`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          }
          renderItem={({ item: [section, items] }) => (
            <View style={styles.runnerSection}>
              {section !== 'General' && (
                <Text style={[styles.runnerSectionTitle, { color: colors.textSecondary }]}>{section}</Text>
              )}
              {items.map((checkItem) => {
                const state = itemStates[checkItem.id] || { checked: false };
                return (
                  <View key={checkItem.id} style={[styles.checklistItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.checklistItemRow}
                      onPress={() => toggleItem(checkItem)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.checkCircle,
                        { backgroundColor: state.checked ? colors.success + '18' : colors.surface, borderColor: state.checked ? colors.success : colors.border }
                      ]}>
                        {state.checked ? (
                          <CheckCircle2 size={22} color={colors.success} />
                        ) : (
                          <Circle size={22} color={colors.textTertiary} />
                        )}
                      </View>
                      <View style={styles.checklistItemContent}>
                        <Text style={[styles.checklistItemTitle, { color: state.checked ? colors.textSecondary : colors.text, textDecorationLine: state.checked ? 'line-through' : 'none' }]}>
                          {checkItem.title}
                        </Text>
                        {checkItem.description && (
                          <Text style={[styles.checklistItemDesc, { color: colors.textTertiary }]}>{checkItem.description}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    {(checkItem.requires_photo || state.photo) && (
                      <TouchableOpacity
                        style={[styles.photoBtn, { backgroundColor: state.photo ? colors.success + '18' : colors.surface }]}
                        onPress={() => handlePhotoCapture(checkItem)}
                      >
                        {state.photo ? (
                          <>
                            <CheckCircle2 size={16} color={colors.success} />
                            <Text style={[styles.photoBtnText, { color: colors.success }]}>Photo</Text>
                          </>
                        ) : (
                          <>
                            <Camera size={16} color={colors.textTertiary} />
                            <Text style={[styles.photoBtnText, { color: colors.textTertiary }]}>Photo</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        />
      </View>
    );
  }

  // ── Main View ──
  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.headerSection, { backgroundColor: '#708F96' }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Checklists</Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
              onPress={() => setShowCreateTemplate(true)}
            >
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* View Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleTab, viewMode === 'active' ? { backgroundColor: 'rgba(255,255,255,0.25)' } : null]}
            onPress={() => setViewMode('active')}
          >
            <ListChecks size={14} color="rgba(255,255,255,0.8)" />
            <Text style={[styles.toggleTabText, { color: 'rgba(255,255,255,0.8)' }]}>Active</Text>
            {dueTemplates.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{dueTemplates.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.toggleTab, viewMode === 'templates' ? { backgroundColor: 'rgba(255,255,255,0.25)' } : null]}
              onPress={() => setViewMode('templates')}
            >
              <FileText size={14} color="rgba(255,255,255,0.8)" />
              <Text style={[styles.toggleTabText, { color: 'rgba(255,255,255,0.8)' }]}>Templates</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {viewMode === 'active' && (
        <FlatList
          data={dueTemplates.length > 0 ? dueTemplates : templates}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            dueTemplates.length > 0 ? (
              <View style={styles.sectionHeader}>
                <AlertCircle size={16} color={colors.warning} />
                <Text style={[styles.sectionHeaderText, { color: colors.warning }]}>
                  {dueTemplates.length} checklist(s) due
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ClipboardList size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No active checklists</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {isAdmin ? 'Create a template to get started' : 'No checklists assigned to you'}
              </Text>
            </View>
          }
          renderItem={({ item: template }) => {
            const lastDone = template.completions
              .filter((c) => c.status === 'completed')
              .sort((a, b) => new Date(b.completed_at || b.completion_date || 0).getTime() - new Date(a.completed_at || a.completion_date || 0).getTime())[0];
            const { due, label } = isDueToday(template.frequency, lastDone?.completion_date || lastDone?.completed_at || null);
            const inProgress = template.completions.find((c) => c.status === 'in_progress');
            const isOverdue = due && !inProgress;

            return (
              <View style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.templateCardTop}>
                  <View style={[styles.templateIcon, { backgroundColor: (isOverdue ? colors.errorBg : due ? colors.warningBg : colors.successBg) }]}>
                    <ClipboardList size={20} color={isOverdue ? colors.error : due ? colors.warning : colors.success} />
                  </View>
                  <View style={styles.templateContent}>
                    <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={1}>{template.name}</Text>
                    <Text style={[styles.templateMeta, { color: colors.textSecondary }]}>
                      {label || template.frequency || 'One-time'} · {template.items.length} items
                    </Text>
                    {lastDone && (
                      <Text style={[styles.templateLastDone, { color: colors.textTertiary }]}>
                        Last done: {formatRelative(lastDone.completed_at || lastDone.completion_date || '')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.templateRight}>
                    {isOverdue && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.errorBg }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.error }]}>OVERDUE</Text>
                      </View>
                    )}
                    {due && !isOverdue && !inProgress && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.warningBg }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.warning }]}>DUE</Text>
                      </View>
                    )}
                    {inProgress && (
                      <View style={[styles.statusBadge, { backgroundColor: colors.infoBg }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.info }]}>IN PROGRESS</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.templateActions}>
                  <TouchableOpacity
                    style={[styles.startBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleStartChecklist(template, inProgress)}
                  >
                    <Play size={14} color="#FFFFFF" />
                    <Text style={styles.startBtnText}>{inProgress ? 'Resume' : 'Start'}</Text>
                  </TouchableOpacity>
                  {template.completions.filter((c) => c.status === 'completed').length > 0 && (
                    <Text style={[styles.completionCount, { color: colors.textTertiary }]}>
                      {template.completions.filter((c) => c.status === 'completed').length} completed
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {viewMode === 'templates' && isAdmin && (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FileText size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No templates yet</Text>
              <TouchableOpacity style={[styles.createFirstBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCreateTemplate(true)}>
                <Text style={styles.createFirstBtnText}>Create First Template</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: template }) => (
            <TouchableOpacity
              style={[styles.templateAdminCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                setActiveTemplate(template);
                setShowRunner(true);
                // Find or create in-progress completion
                const inProgress = template.completions.find((c) => c.status !== 'completed');
                handleStartChecklist(template, inProgress);
              }}
            >
              <View style={styles.templateAdminRow}>
                <View style={[styles.templateIcon, { backgroundColor: colors.primary + '18' }]}>
                  <FileText size={18} color={colors.primary} />
                </View>
                <View style={styles.templateAdminContent}>
                  <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={1}>{template.name}</Text>
                  <Text style={[styles.templateMeta, { color: colors.textSecondary }]}>
                    {template.frequency || 'One-time'} · {template.items.length} items
                  </Text>
                </View>
                <View style={styles.templateAdminRight}>
                  {!template.is_running && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.textTertiary + '20' }]}>
                      <Text style={[styles.statusBadgeText, { color: colors.textTertiary }]}>PAUSED</Text>
                    </View>
                  )}
                  <ChevronRight size={16} color={colors.textTertiary} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Create Template Modal ── */}
      <Modal visible={showCreateTemplate} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Create Template</Text>
                <TouchableOpacity onPress={() => { setShowCreateTemplate(false); resetTemplateForm(); }}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Template Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. Morning Walkthrough"
                  placeholderTextColor={colors.textTertiary}
                  value={tplName}
                  onChangeText={setTplName}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="Optional description"
                  placeholderTextColor={colors.textTertiary}
                  value={tplDesc}
                  onChangeText={setTplDesc}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Frequency</Text>
                <View style={styles.freqRow}>
                  {['daily', 'weekly', 'monthly', 'one_time'].map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.freqChip, tplFrequency === freq ? { backgroundColor: colors.primary + '18', borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => setTplFrequency(freq)}
                    >
                      <Text style={[styles.freqChipText, { color: tplFrequency === freq ? colors.primary : colors.textSecondary }]}>
                        {freq.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.itemsSectionHeader}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Checklist Items ({tplItems.length})</Text>
                  <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: colors.primary }]} onPress={addTemplateItem}>
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.addItemBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {tplItems.map((item, idx) => (
                  <View key={idx} style={[styles.templateItemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.templateItemInputs}>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, fontSize: 13 }]}
                        placeholder={`Item ${idx + 1} title`}
                        placeholderTextColor={colors.textTertiary}
                        value={item.title}
                        onChangeText={(v) => updateTemplateItem(idx, 'title', v)}
                      />
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text, fontSize: 12 }]}
                        placeholder="Description (optional)"
                        placeholderTextColor={colors.textTertiary}
                        value={item.description}
                        onChangeText={(v) => updateTemplateItem(idx, 'description', v)}
                      />
                      <TouchableOpacity
                        style={[styles.photoToggle, { backgroundColor: item.requires_photo ? colors.warning + '18' : 'transparent', borderColor: item.requires_photo ? colors.warning : colors.border }]}
                        onPress={() => updateTemplateItem(idx, 'requires_photo', !item.requires_photo)}
                      >
                        <Camera size={12} color={item.requires_photo ? colors.warning : colors.textTertiary} />
                        <Text style={[styles.photoToggleText, { color: item.requires_photo ? colors.warning : colors.textTertiary }]}>Photo required</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.removeItemBtn} onPress={() => removeTemplateItem(idx)}>
                      <X size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {tplItems.length === 0 && (
                  <TouchableOpacity style={[styles.addFirstItem, { borderColor: colors.border }]} onPress={addTemplateItem}>
                    <Plus size={20} color={colors.textTertiary} />
                    <Text style={[styles.addFirstItemText, { color: colors.textTertiary }]}>Add first item</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
                onPress={handleCreateTemplate}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Create Template</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Urbanist-Medium' },

  headerSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 24, fontFamily: 'Poppins-Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  headerBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  viewToggle: { flexDirection: 'row', gap: 8 },
  toggleTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  toggleTabText: { fontSize: 12, fontFamily: 'Urbanist-Bold' },
  badge: { backgroundColor: '#EF6B6B', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Urbanist-Bold' },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: 8 },
  sectionHeaderText: { fontSize: 13, fontFamily: 'Urbanist-Bold' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Urbanist-Regular', textAlign: 'center' },

  templateCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  templateCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  templateIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  templateContent: { flex: 1 },
  templateName: { fontSize: 15, fontFamily: 'Poppins-Bold', marginBottom: 3 },
  templateMeta: { fontSize: 11, fontFamily: 'Urbanist-Regular' },
  templateLastDone: { fontSize: 10, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  templateRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 9, fontFamily: 'Urbanist-Bold', letterSpacing: 0.5 },
  templateActions: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  startBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins-Bold' },
  completionCount: { fontSize: 11, fontFamily: 'Urbanist-Medium' },

  templateAdminCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  templateAdminRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  templateAdminContent: { flex: 1 },
  templateAdminRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Runner
  runnerHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  runnerHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  runnerBackBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  runnerTitleGroup: { flex: 1 },
  runnerTitle: { fontSize: 20, fontFamily: 'Poppins-Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  runnerSubtitle: { fontSize: 12, fontFamily: 'Urbanist-Regular', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  progressSection: {},
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressCount: { fontSize: 14, fontFamily: 'Poppins-Bold', color: '#FFFFFF' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  runnerList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  runnerSection: { marginBottom: 20 },
  runnerSectionTitle: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  checklistItem: { borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  checklistItemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  checkCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checklistItemContent: { flex: 1 },
  checklistItemTitle: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  checklistItemDesc: { fontSize: 11, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 12, marginVertical: 8 },
  photoBtnText: { fontSize: 11, fontFamily: 'Urbanist-Bold' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  completeBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Poppins-Bold' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 34, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
  modalBody: { maxHeight: 500 },
  inputLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Urbanist-Regular' },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  freqChipText: { fontSize: 12, fontFamily: 'Urbanist-Medium', textTransform: 'capitalize' },
  itemsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  addItemBtnText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Urbanist-Bold' },
  templateItemRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 8, gap: 8 },
  templateItemInputs: { flex: 1, gap: 6 },
  removeItemBtn: { padding: 4, marginTop: 2 },
  photoToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  photoToggleText: { fontSize: 11, fontFamily: 'Urbanist-Medium' },
  addFirstItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 24, marginTop: 8 },
  addFirstItemText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Poppins-Bold' },
  createFirstBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  createFirstBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins-Bold' },
});
