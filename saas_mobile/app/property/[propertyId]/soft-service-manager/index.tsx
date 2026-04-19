import SoftServiceManagerDashboard from '@/components/dashboard/SoftServiceManagerDashboard';
import { useLocalSearchParams } from 'expo-router';

export default function SoftServiceManagerPage() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  if (!propertyId) return null;
  return <SoftServiceManagerDashboard propertyId={propertyId} />;
}
