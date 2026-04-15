import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LoggersMenuProps {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
}

export function LoggersMenu({ visible, onClose, propertyId }: LoggersMenuProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isDark = theme === 'dark';

  const menuItems = [
    {
      title: 'Electricity Logger',
      icon: 'flash', // Use non-outline for "selected" feel
      color: '#F59E0B',
      route: `/property/${propertyId}/electricity`,
      description: 'Meter readings & tariffs'
    },
    {
      title: 'Diesel Logger',
      icon: 'water',
      color: '#EF4444',
      route: `/property/${propertyId}/diesel`,
      description: 'Fuel levels & consumption'
    },
    {
      title: 'Checklists (SOP)',
      icon: 'checkbox',
      color: '#10B981',
      route: `/property/${propertyId}/checklist`,
      description: 'Maintenance schedules'
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[
          styles.menuContainer,
          { backgroundColor: isDark ? '#1F2937' : '#FFF' }
        ]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#FFF' : '#1A2332' }]}>Maintenance Loggers</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <View style={styles.itemsGrid}>
            {menuItems.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.menuItem,
                  { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }
                ]}
                onPress={() => {
                  onClose();
                  router.push(item.route as any);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: isDark ? '#FFF' : '#1A2332' }]}>{item.title}</Text>
                  <Text style={[styles.itemDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#4B5563' : '#CBD5E1'} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 100, // Show above bottom nav
  },
  menuContainer: {
    borderRadius: 24,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 4,
  },
  itemsGrid: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
