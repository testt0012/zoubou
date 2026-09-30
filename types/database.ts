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

export interface RecurringCustomer {
  id: string;
  first_name: string;
  last_name: string;
  mobile: string | null;
  service_id: string;
  start_date: string; // first visit, "YYYY-MM-DD" — its weekday is the visit day
  interval_weeks: number; // 1, 2 or 3
  start_time: string; // "HH:MM:SS"
  zone_end_time: string | null; // null = fixed time, otherwise end of the time zone
  // Dates the customer is skipping (absent on a database that hasn't had
  // migration 0010 yet).
  skipped_dates?: string[];
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
  mobile: string | null;
  status: AppointmentStatus;
  push_endpoint: string | null;
  push_p256dh: string | null;
  push_auth: string | null;
  reminder_sent: boolean;
  created_at: string;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface AppointmentWithService extends Appointment {
  services: Pick<Service, "id" | "name" | "duration_minutes"> | null;
}
