import LovableSoftServiceManagerDashboard from '@/components/dashboard/LovableSoftServiceManagerDashboard';
import { useLocalSearchParams } from 'expo-router';

export default function SoftServiceManagerPage() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  if (!propertyId) return null;
  return <LovableSoftServiceManagerDashboard propertyId={propertyId} />;
}
