export type AppointmentStatus = "confirmed" | "cancelled";

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface AvailabilityRule {
  id: string;
  weekday: number; // 0 = Sunday ... 6 = Saturday
  start_time: string; // "HH:MM:SS"
  end_time: string;
  created_at: string;
}

export interface BlockedSlot {
  id: string;
  date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at: string;
}

export interface Settings {
  id: true;
  slot_granularity_minutes: number;
  buffer_minutes: number;
}

export interface Appointment {
  id: string;
  service_id: string;
  date: string;
  start_time: string;
  end_time: string;
  first_name: string;
  last_name: string;
  mobile: string;
  status: AppointmentStatus;
  created_at: string;
}

export interface AppointmentWithService extends Appointment {
  services: Pick<Service, "id" | "name" | "duration_minutes"> | null;
}
