import { getAdminSession } from './adminAuth';

export interface AdminDashboardData {
  counts: {
    users: number;
    trainings: number;
    events: number;
    venues: number;
    leisureEvents: number;
    reports: number;
    notificationOutbox: number;
  };
  recentUsers: Array<{ id:string; name:string; isVerified:boolean; registeredAt:string }>;
  release: string;
  generatedAt: string;
}

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const session = getAdminSession();
  if (!session) throw new Error('admin-otp-required');
  const response = await fetch('/api/admin-dashboard', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ sessionId:session.sessionId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as AdminDashboardData;
}
