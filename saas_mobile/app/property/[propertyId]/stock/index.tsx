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
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  X,
  QrCode,
  ChevronRight,
  TrendingDown,
  History,
} from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockItem {
  id: string;
  name: string;
  item_code: string;
  category: string;
  quantity: number;
  min_threshold: number;
  unit: string;
  unit_price: number;
  property_id: string;
  created_at: string;
}

interface StockMovement {
  id: string;
  item_id: string;
  action: 'add' | 'remove';
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
  stock_items: { name: string; item_code: string; unit?: string } | null;
  users: { full_name: string } | null;
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function StockScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  // ── State ────────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMovementsTab, setShowMovementsTab] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<'add' | 'remove'>('add');

  // Add form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formMinThreshold, setFormMinThreshold] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Movement form state
  const [moveQty, setMoveQty] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  // ── Computed ────────────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.item_code || '').toLowerCase().includes(q)
      );
    }
    if (selectedCategory) {
      result = result.filter((i) => i.category === selectedCategory);
    }
    return result;
  }, [items, searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    const total = items.length;
    const lowStock = items.filter((i) => i.quantity > 0 && i.quantity < (i.min_threshold || 10)).length;
    const outOfStock = items.filter((i) => i.quantity === 0).length;
    const totalValue = items.reduce((sum, i) => sum + (i.quantity * (i.unit_price || 0)), 0);
    return { total, lowStock, outOfStock, totalValue };
  }, [items]);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    if (!propertyId) return;
    try {
      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .eq('property_id', propertyId)
        .order('name');
      if (error) throw error;
      const fetched = (data || []) as StockItem[];
      setItems(fetched);

      // Extract unique categories
      const cats = [...new Set(fetched.map((i) => i.category).filter(Boolean))];
      setCategories(cats as string[]);
    } catch (err) {
      console.error('Error fetching stock items:', err);
    }
  }, [propertyId]);

  const fetchMovements = useCallback(async () => {
    if (!propertyId) return;
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, item_id, action, quantity_change, quantity_before, quantity_after, notes, created_at, stock_items:item_id(name, item_code, unit), users:user_id(full_name)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setMovements((data || []) as StockMovement[]);
    } catch (err) {
      console.error('Error fetching movements:', err);
    }
  }, [propertyId]);

  const fetchAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      await Promise.all([fetchItems(), fetchMovements()]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchItems, fetchMovements]);

  useEffect(() => {
    if (propertyId) fetchAll();
  }, [propertyId, fetchAll]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleRefresh = () => fetchAll(true);

  const handleItemPress = (item: StockItem) => {
    setSelectedItem(item);
    setShowDetailSheet(true);
  };

  const handleAddItem = async () => {
    if (!formName.trim() || !formQuantity.trim() || !propertyId) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await (supabase.from('stock_items') as any).insert({
        property_id: propertyId,
        name: formName.trim(),
        item_code: formCode.trim() || null,
        category: formCategory.trim() || null,
        quantity: parseInt(formQuantity) || 0,
        min_threshold: parseInt(formMinThreshold) || 10,
        unit: formUnit.trim() || null,
        unit_price: parseFloat(formPrice) || 0,
      }).select().single();
      if (error) throw error;
      setShowAddModal(false);
      resetForm();
      await fetchItems();
      Alert.alert('Success', 'Stock item added successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordMovement = async () => {
    if (!selectedItem || !moveQty.trim() || !propertyId) {
      Alert.alert('Error', 'Please fill in quantity');
      return;
    }
    const qty = parseInt(moveQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Quantity must be a positive number');
      return;
    }
    if (movementType === 'remove' && qty > selectedItem.quantity) {
      Alert.alert('Error', 'Cannot remove more than available quantity');
      return;
    }
    setIsSubmittingMovement(true);
    try {
      const { error } = await (supabase.from('stock_movements') as any).insert({
        property_id: propertyId,
        item_id: selectedItem.id,
        action: movementType,
        quantity_change: movementType === 'add' ? qty : -qty,
        quantity_before: selectedItem.quantity,
        quantity_after: movementType === 'add' ? selectedItem.quantity + qty : selectedItem.quantity - qty,
        notes: moveNotes.trim() || null,
        user_id: user?.id || null,
      });
      if (error) throw error;

      // Update local quantity
      setItems((prev) =>
        prev.map((i) =>
          i.id === selectedItem.id
            ? {
                ...i,
                quantity:
                  movementType === 'add'
                    ? i.quantity + qty
                    : i.quantity - qty,
              }
            : i
        )
      );
      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              quantity:
                movementType === 'add'
                  ? prev.quantity + qty
                  : prev.quantity - qty,
            }
          : null
      );

      setShowMovementModal(false);
      setMoveQty('');
      setMoveNotes('');
      await fetchMovements();
      Alert.alert('Success', 'Stock movement recorded');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record movement');
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormCategory('');
    setFormQuantity('');
    setFormMinThreshold('');
    setFormUnit('');
    setFormPrice('');
  };

  const openMovementSheet = (item: StockItem, type: 'add' | 'remove') => {
    setSelectedItem(item);
    setMovementType(type);
    setShowDetailSheet(false);
    setShowMovementModal(true);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const bgColor = theme === 'light' ? '#FBF8F4' : colors.background;

  if (isLoading && items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading inventory...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ── Header ── */}
      <View style={[styles.headerSection, { backgroundColor: '#708F96' }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Inventory</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowMovementsTab(!showMovementsTab)}
            >
              <History size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── KPI Cards ── */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Package size={16} color={colors.primary} />
          <Text style={[styles.kpiValue, { color: colors.text }]}>{stats.total}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>Items</Text>
        </View>
        <TouchableOpacity
          style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.warningBg }]}
          onPress={() => {
            setSelectedCategory('');
            setSearchQuery('');
          }}
        >
          <AlertTriangle size={16} color={colors.warning} />
          <Text style={[styles.kpiValue, { color: colors.warning }]}>{stats.lowStock}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>Low Stock</Text>
        </TouchableOpacity>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.errorBg }]}>
          <TrendingDown size={16} color={colors.error} />
          <Text style={[styles.kpiValue, { color: colors.error }]}>{stats.outOfStock}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>Out</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.kpiValue, { color: colors.text, fontSize: 18 }]}>
            {formatCurrency(stats.totalValue).replace('₹', '₹')}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>Value</Text>
        </View>
      </View>

      {/* ── Search + Filter ── */}
      <View style={styles.searchRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or SKU..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: selectedCategory ? colors.primary + '18' : colors.card, borderColor: colors.border }]}
          onPress={() => setShowCategoryFilter(!showCategoryFilter)}
        >
          <Filter size={16} color={selectedCategory ? colors.primary : colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* ── Category Filter Dropdown ── */}
      {showCategoryFilter && (
        <View style={[styles.categoryDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === '' ? { backgroundColor: colors.primary + '18' } : null]}
            onPress={() => { setSelectedCategory(''); setShowCategoryFilter(false); }}
          >
            <Text style={[styles.categoryChipText, { color: selectedCategory === '' ? colors.primary : colors.textSecondary }]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, selectedCategory === cat ? { backgroundColor: colors.primary + '18' } : null]}
              onPress={() => { setSelectedCategory(cat); setShowCategoryFilter(false); }}
            >
              <Text style={[styles.categoryChipText, { color: selectedCategory === cat ? colors.primary : colors.textSecondary }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Active filter indicator ── */}
      {selectedCategory ? (
        <View style={styles.filterIndicator}>
          <Text style={[styles.filterIndicatorText, { color: colors.textSecondary }]}>Category: {selectedCategory}</Text>
          <TouchableOpacity onPress={() => setSelectedCategory('')}>
            <X size={12} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Item List ── */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No items found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {searchQuery || selectedCategory ? 'Try adjusting your filters' : 'Add your first stock item'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isOut = item.quantity === 0;
          const isLow = !isOut && item.quantity < (item.min_threshold || 10);
          const stockColor = isOut ? colors.error : isLow ? colors.warning : colors.success;

          return (
            <TouchableOpacity
              style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.72}
            >
              <View style={styles.itemLeft}>
                <View style={[styles.itemIconWrap, { backgroundColor: stockColor + '18' }]}>
                  <Package size={20} color={stockColor} />
                </View>
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                  {(item.item_code || 'No SKU')} · {item.category || 'Uncategorized'}
                </Text>
              </View>
              <View style={styles.itemRight}>
                <View style={styles.qtyRow}>
                  <Text style={[styles.qtyValue, { color: stockColor }]}>{item.quantity}</Text>
                  {isOut ? (
                    <View style={[styles.stockBadge, { backgroundColor: colors.errorBg }]}>
                      <Text style={[styles.stockBadgeText, { color: colors.error }]}>OUT</Text>
                    </View>
                  ) : isLow ? (
                    <View style={[styles.stockBadge, { backgroundColor: colors.warningBg }]}>
                      <Text style={[styles.stockBadgeText, { color: colors.warning }]}>LOW</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.itemUnit, { color: colors.textTertiary }]}>
                  {item.unit || 'units'} · {formatCurrency(item.unit_price || 0).replace('₹', '')} each
                </Text>
                <Text style={[styles.itemMin, { color: colors.textTertiary }]}>Min: {item.min_threshold || 10}</Text>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Add Item Modal ── */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Stock Item</Text>
                <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Item Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. Hydraulic Fluid"
                  placeholderTextColor={colors.textTertiary}
                  value={formName}
                  onChangeText={setFormName}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>SKU / Item Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. SKU-001"
                  placeholderTextColor={colors.textTertiary}
                  value={formCode}
                  onChangeText={setFormCode}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. Lubricants"
                  placeholderTextColor={colors.textTertiary}
                  value={formCategory}
                  onChangeText={setFormCategory}
                />
                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Initial Qty *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={formQuantity}
                      onChangeText={setFormQuantity}
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Min Threshold</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      placeholder="10"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={formMinThreshold}
                      onChangeText={setFormMinThreshold}
                    />
                  </View>
                </View>
                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Unit</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      placeholder="litres, kg, pcs"
                      placeholderTextColor={colors.textTertiary}
                      value={formUnit}
                      onChangeText={setFormUnit}
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Unit Price (₹)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      value={formPrice}
                      onChangeText={setFormPrice}
                    />
                  </View>
                </View>
              </ScrollView>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
                onPress={handleAddItem}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Item</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Item Detail Bottom Sheet ── */}
      <Modal visible={showDetailSheet} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowDetailSheet(false)} />
          <View style={[styles.detailSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            {selectedItem && (
              <>
                <View style={styles.detailHeader}>
                  <View style={styles.detailTitleRow}>
                    <Text style={[styles.detailItemName, { color: colors.text }]}>{selectedItem.name}</Text>
                    <TouchableOpacity onPress={() => setShowDetailSheet(false)}>
                      <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                    {selectedItem.item_code || 'No SKU'} · {selectedItem.category || 'Uncategorized'}
                  </Text>
                </View>

                {/* Stats row */}
                <View style={styles.detailStatsRow}>
                  <View style={[styles.detailStatCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.detailStatValue, { color: colors.text }]}>{selectedItem.quantity}</Text>
                    <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>Current Qty</Text>
                  </View>
                  <View style={[styles.detailStatCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.detailStatValue, { color: colors.text }]}>{selectedItem.min_threshold || 10}</Text>
                    <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>Min Threshold</Text>
                  </View>
                  <View style={[styles.detailStatCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.detailStatValue, { color: colors.text }]}>{selectedItem.unit || '-'}</Text>
                    <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>Unit</Text>
                  </View>
                  <View style={[styles.detailStatCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.detailStatValue, { color: colors.text }]}>{formatCurrency(selectedItem.unit_price || 0)}</Text>
                    <Text style={[styles.detailStatLabel, { color: colors.textTertiary }]}>Unit Price</Text>
                  </View>
                </View>

                {/* Stock value */}
                <View style={[styles.valueBanner, { backgroundColor: colors.primary + '12' }]}>
                  <Text style={[styles.valueBannerLabel, { color: colors.textSecondary }]}>Total Value</Text>
                  <Text style={[styles.valueBannerValue, { color: colors.primary }]}>
                    {formatCurrency(selectedItem.quantity * (selectedItem.unit_price || 0))}
                  </Text>
                </View>

                {/* Action buttons */}
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.successBg }]}
                    onPress={() => openMovementSheet(selectedItem, 'add')}
                  >
                    <ArrowUpCircle size={20} color={colors.success} />
                    <Text style={[styles.actionBtnText, { color: colors.success }]}>Add Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.errorBg }]}
                    onPress={() => openMovementSheet(selectedItem, 'remove')}
                  >
                    <ArrowDownCircle size={20} color={colors.error} />
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Remove Stock</Text>
                  </TouchableOpacity>
                </View>

                {/* QR Code button */}
                <TouchableOpacity
                  style={[styles.qrBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setShowQRModal(true)}
                >
                  <QrCode size={18} color={colors.textSecondary} />
                  <Text style={[styles.qrBtnText, { color: colors.textSecondary }]}>Show Barcode / QR</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Stock Movement Modal ── */}
      <Modal visible={showMovementModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {movementType === 'add' ? 'Add' : 'Remove'} Stock
                </Text>
                <TouchableOpacity onPress={() => { setShowMovementModal(false); setMoveQty(''); setMoveNotes(''); }}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {selectedItem && (
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <View style={[styles.moveItemBanner, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.moveItemName, { color: colors.text }]}>{selectedItem.name}</Text>
                    <Text style={[styles.moveItemQty, { color: colors.textSecondary }]}>
                      Current: {selectedItem.quantity} {selectedItem.unit || 'units'}
                    </Text>
                  </View>

                  <View style={styles.movementToggle}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, movementType === 'add' ? { backgroundColor: colors.successBg } : { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => setMovementType('add')}
                    >
                      <ArrowUpCircle size={16} color={movementType === 'add' ? colors.success : colors.textTertiary} />
                      <Text style={[styles.toggleBtnText, { color: movementType === 'add' ? colors.success : colors.textTertiary }]}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, movementType === 'remove' ? { backgroundColor: colors.errorBg } : { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => setMovementType('remove')}
                    >
                      <ArrowDownCircle size={16} color={movementType === 'remove' ? colors.error : colors.textTertiary} />
                      <Text style={[styles.toggleBtnText, { color: movementType === 'remove' ? colors.error : colors.textTertiary }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Quantity *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    placeholder="Enter quantity"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={moveQty}
                    onChangeText={setMoveQty}
                  />

                  {movementType === 'remove' && selectedItem && (
                    <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                      Available: {selectedItem.quantity} {selectedItem.unit || 'units'}
                    </Text>
                  )}

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notes / Reason</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    placeholder="Optional notes..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                    value={moveNotes}
                    onChangeText={setMoveNotes}
                  />
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: movementType === 'add' ? colors.success : colors.error }, isSubmittingMovement && { opacity: 0.6 }]}
                onPress={handleRecordMovement}
                disabled={isSubmittingMovement}
              >
                {isSubmittingMovement ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {movementType === 'add' ? 'Add Stock' : 'Remove Stock'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── QR Modal ── */}
      <Modal visible={showQRModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModal, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Item QR / Barcode</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selectedItem && (
              <View style={styles.qrContent}>
                <View style={[styles.qrPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <QrCode size={64} color={colors.textTertiary} />
                  <Text style={[styles.qrItemCode, { color: colors.textSecondary }]}>{selectedItem.item_code || selectedItem.id}</Text>
                </View>
                <Text style={[styles.qrName, { color: colors.text }]}>{selectedItem.name}</Text>
                <Text style={[styles.qrCategory, { color: colors.textSecondary }]}>{selectedItem.category || 'Uncategorized'}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Urbanist-Medium' },

  headerSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontFamily: 'Poppins-Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: -12, marginBottom: 16 },
  kpiCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 2 },
  kpiValue: { fontSize: 20, fontFamily: 'Poppins-Bold', marginTop: 2 },
  kpiLabel: { fontSize: 9, fontFamily: 'Urbanist-Medium', textTransform: 'uppercase', letterSpacing: 0.5 },

  searchRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Urbanist-Regular' },
  filterBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  categoryDropdown: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, marginHorizontal: 16, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'transparent' },
  categoryChipText: { fontSize: 12, fontFamily: 'Urbanist-Medium' },

  filterIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 6, marginBottom: 4 },
  filterIndicatorText: { fontSize: 12, fontFamily: 'Urbanist-Medium' },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Urbanist-Regular', textAlign: 'center' },

  itemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10, gap: 12 },
  itemLeft: {},
  itemIconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  itemContent: { flex: 1 },
  itemName: { fontSize: 14, fontFamily: 'Poppins-Bold', marginBottom: 2 },
  itemMeta: { fontSize: 11, fontFamily: 'Urbanist-Regular' },
  itemRight: { alignItems: 'flex-end' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyValue: { fontSize: 20, fontFamily: 'Poppins-Bold' },
  stockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stockBadgeText: { fontSize: 8, fontFamily: 'Urbanist-Bold', letterSpacing: 0.5 },
  itemUnit: { fontSize: 10, fontFamily: 'Urbanist-Regular', marginTop: 1 },
  itemMin: { fontSize: 10, fontFamily: 'Urbanist-Regular' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 34 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
  modalBody: { maxHeight: 400 },
  inputLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Urbanist-Regular' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Poppins-Bold' },

  detailSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 34 },
  detailHeader: { marginBottom: 16 },
  detailTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailItemName: { fontSize: 20, fontFamily: 'Poppins-Bold', flex: 1, marginRight: 16 },
  detailMeta: { fontSize: 13, fontFamily: 'Urbanist-Regular', marginTop: 4 },
  detailStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  detailStatCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  detailStatValue: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  detailStatLabel: { fontSize: 9, fontFamily: 'Urbanist-Medium', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  valueBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 16 },
  valueBannerLabel: { fontSize: 12, fontFamily: 'Urbanist-Medium' },
  valueBannerValue: { fontSize: 18, fontFamily: 'Poppins-Bold' },
  actionBtns: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  actionBtnText: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  qrBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  qrBtnText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },

  moveItemBanner: { borderRadius: 10, padding: 12, marginBottom: 16 },
  moveItemName: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  moveItemQty: { fontSize: 12, fontFamily: 'Urbanist-Medium', marginTop: 2 },
  movementToggle: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: 'transparent' },
  toggleBtnText: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  helperText: { fontSize: 11, fontFamily: 'Urbanist-Regular', marginTop: 4, marginBottom: 8 },

  qrModal: { borderRadius: 20, paddingHorizontal: 20, paddingBottom: 34, alignItems: 'center' },
  qrContent: { alignItems: 'center', paddingVertical: 20 },
  qrPlaceholder: { width: 160, height: 160, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  qrItemCode: { fontSize: 11, fontFamily: 'Urbanist-Medium', marginTop: 8, letterSpacing: 1 },
  qrName: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  qrCategory: { fontSize: 12, fontFamily: 'Urbanist-Regular', marginTop: 4 },
});
