export type AppointmentStatus = "confirmed" | "cancelled";

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
}

export interface AvailabilityRule {
  id: string;
  weekday: number; // 0 = Sunday ... 6 = Saturday
  start_time: string; // "HH:MM"
  end_time: string;
}

export interface BlockedSlot {
  id: string;
  date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string;
  reason: string | null;
}

export interface Settings {
  slot_granularity_minutes: number;
  buffer_minutes: number;
}

export interface Appointment {
  id: string;
  service_id: string;
  service_name: string;
  date: string;
  start_time: string;
  end_time: string;
  first_name: string;
  last_name: string;
  mobile: string;
  status: AppointmentStatus;
  lock_ids: string[];
}
