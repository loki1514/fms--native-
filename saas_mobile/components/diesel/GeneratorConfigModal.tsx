import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Generator {
  id: string;
  name: string;
  make?: string;
  capacity_kva?: number;
  tank_capacity_litres?: number;
  status: string;
  initial_run_hours?: number;
  initial_kwh_reading?: number;
  initial_diesel_level?: number;
}

interface GeneratorConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId: string;
  existingGenerator?: Generator;
}

export default function GeneratorConfigModal({
  visible,
  onClose,
  onSuccess,
  propertyId,
  existingGenerator,
}: GeneratorConfigModalProps) {
  const { theme } = useTheme();
  const { user: authUser } = useAuth();
  const colors = Colors[theme];
  const isNew = !existingGenerator;

  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [capacityKva, setCapacityKva] = useState('500');
  const [tankCapacity, setTankCapacity] = useState('1000');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [initialKwh, setInitialKwh] = useState('0');
  const [initialRunHours, setInitialRunHours] = useState('0');
  const [initialDiesel, setInitialDiesel] = useState('0');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (visible) {
      if (existingGenerator) {
        setName(existingGenerator.name);
        setMake(existingGenerator.make || '');
        setCapacityKva(String(existingGenerator.capacity_kva ?? 500));
        setTankCapacity(String(existingGenerator.tank_capacity_litres ?? 1000));
        setStatus(existingGenerator.status === 'inactive' ? 'inactive' : 'active');
        setInitialKwh(String(existingGenerator.initial_kwh_reading ?? 0));
        setInitialRunHours(String(existingGenerator.initial_run_hours ?? 0));
        setInitialDiesel(String(existingGenerator.initial_diesel_level ?? 0));
        setEffectiveFrom(new Date().toISOString().split('T')[0]);
      } else {
        setName('');
        setMake('');
        setCapacityKva('500');
        setTankCapacity('1000');
        setStatus('active');
        setInitialKwh('0');
        setInitialRunHours('0');
        setInitialDiesel('0');
        setEffectiveFrom(new Date().toISOString().split('T')[0]);
      }
      setError(null);
    }
  }, [visible, existingGenerator]);

  const numInput = (val: string, setter: (v: string) => void, placeholder = '0') => (
    <TextInput
      style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      value={val}
      onChangeText={setter}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      keyboardType="decimal-pad"
    />
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Generator name is required');
      return;
    }
    const cap = parseFloat(capacityKva);
    const tank = parseFloat(tankCapacity);
    if (cap <= 0) {
      setError('Capacity must be greater than 0');
      return;
    }
    if (tank <= 0) {
      setError('Tank capacity must be greater than 0');
      return;
    }
    const initDiesel = parseFloat(initialDiesel);
    if (initDiesel > tank) {
      setError('Initial diesel level cannot exceed tank capacity');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (isNew) {
        // 1. Create generator
        const { data: gen, error: genErr } = await supabase
          .from('generators')
          .insert({
            property_id: propertyId,
            name: name.trim(),
            make: make.trim() || null,
            capacity_kva: cap,
            tank_capacity_litres: tank,
            status,
            initial_kwh_reading: parseFloat(initialKwh) || 0,
            initial_run_hours: parseFloat(initialRunHours) || 0,
            initial_diesel_level: initDiesel,
            effective_from_date: effectiveFrom,
          } as any)
          .select()
          .single() as any;

        if (genErr) throw genErr;

        // 2. Record initial setup reading
        const kwh = parseFloat(initialKwh) || 0;
        const hrs = parseFloat(initialRunHours) || 0;
        if (kwh > 0 || hrs > 0 || initDiesel > 0) {
          const { error: readingErr } = await supabase
            .from('diesel_readings')
            .insert({
              property_id: propertyId,
              generator_id: gen.id,
              reading_date: effectiveFrom,
              opening_hours: 0,
              closing_hours: hrs,
              opening_kwh: 0,
              closing_kwh: kwh,
              opening_diesel_level: 0,
              closing_diesel_level: initDiesel,
              diesel_added_litres: 0,
              computed_consumed_litres: initDiesel,
              notes: 'Initial setup reading',
              created_by: authUser?.id
            } as any);
          if (readingErr) console.error('[Generators] Error recording initial reading:', readingErr.message);
        }
      } else {
        // Update existing generator
        const { error: updateErr } = await (supabase as any)
          .from('generators')
          .update({
            name: name.trim(),
            make: make.trim() || null,
            capacity_kva: cap,
            tank_capacity_litres: tank,
            status,
          })
          .eq('id', existingGenerator!.id);
        
        if (updateErr) throw updateErr;
      }
      await onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save generator');
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="construct" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {isNew ? 'Add Generator' : 'Edit Generator'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.errorBg, borderColor: colors.errorBorder }]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            {/* Identity Section */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Generator Identity</Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. DG-1"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Make</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={make}
              onChangeText={setMake}
              placeholder="e.g. Cummins"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Capacity Section */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Capacity & Storage</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Capacity (KVA) *</Text>
                {numInput(capacityKva, setCapacityKva, '500')}
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tank Capacity (L) *</Text>
                {numInput(tankCapacity, setTankCapacity, '1000')}
              </View>
            </View>

            {/* Status */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.statusBtn, status === 'active' ? { backgroundColor: colors.success + '18', borderColor: colors.success } : { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setStatus('active')}
              >
                <Ionicons name="checkmark-circle" size={16} color={status === 'active' ? colors.success : colors.textTertiary} />
                <Text style={[styles.statusBtnText, { color: status === 'active' ? colors.success : colors.textSecondary }]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, status === 'inactive' ? { backgroundColor: colors.error + '18', borderColor: colors.error } : { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setStatus('inactive')}
              >
                <Ionicons name="pause-circle" size={16} color={status === 'inactive' ? colors.error : colors.textTertiary} />
                <Text style={[styles.statusBtnText, { color: status === 'inactive' ? colors.error : colors.textSecondary }]}>Inactive</Text>
              </TouchableOpacity>
            </View>

            {/* Initial Setup (New Only) */}
            {isNew && (
              <View style={[styles.initialSection, { borderColor: colors.primary + '40', backgroundColor: colors.primaryLight }]}>
                <View style={styles.initialHeader}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={[styles.initialTitle, { color: colors.primary }]}>Initial Setup</Text>
                </View>
                <Text style={[styles.initialSub, { color: colors.textSecondary }]}>
                  Starting truth for first log entry
                </Text>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Initial kWh *</Text>
                    {numInput(initialKwh, setInitialKwh, '0')}
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Initial Run Hours *</Text>
                    {numInput(initialRunHours, setInitialRunHours, '0')}
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Initial Diesel Level (L) *</Text>
                    {numInput(initialDiesel, setInitialDiesel, '0')}
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Effective From *</Text>
                    <TouchableOpacity style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center' }]}>
                      <Text style={{ color: colors.text,  fontSize: 15 }}>
                        {new Date(effectiveFrom + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isNew ? 'Add Generator' : 'Update Generator'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
      },
  sectionLabel: {
    fontSize: 11,
        textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
        textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
      },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  statusBtnText: {
    fontSize: 14,
      },
  initialSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  initialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  initialTitle: {
    fontSize: 14,
        textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  initialSub: {
    fontSize: 11,
        marginBottom: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
        flex: 1,
  },
  submitBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: {
    fontSize: 16,
        color: '#FFFFFF',
  },
  cancelBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    marginTop: 10,
  },
  cancelBtnText: {
    fontSize: 14,
      },
});
