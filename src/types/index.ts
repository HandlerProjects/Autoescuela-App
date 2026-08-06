export type PracticeType = 'car' | 'truck' | 'moto'
export type PracticeSubtype = 'pista' | 'circulacion'
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed'
export type ExamType = 'theory' | 'practical'
export type ExamResult = 'passed' | 'failed' | 'pending'
export type PaymentStatus = 'pending' | 'paid'

export interface Instructor {
  id: string
  email: string
  name: string
  user_id: string | null
  practice_types: PracticeType[]
  schedule_morning: boolean
  schedule_afternoon: boolean
  morning_start: string
  morning_end: string
  afternoon_start: string
  afternoon_end: string
  milestone_counts: number[]
  break_minutes: number
  jornada: 'full' | 'half'
  notes: string | null
  created_at: string
}

export interface Staff {
  id: string
  name: string
  email: string
  role: 'admin' | 'instructor' | 'secretary'
  is_active: boolean
  created_at: string
}

export interface Student {
  id: string
  instructor_id: string | null
  dni: string
  full_name: string
  order_number: number
  token: string
  practice_types: PracticeType[]
  phone: string | null
  email: string | null
  login_code: string | null
  login_pin: string | null
  is_active: boolean
  max_concurrent_bookings: number
  max_weekly_bookings: number
  max_daily_bookings: number
  /** Tope acumulado de prácticas pagadas — ver lib/bono.ts */
  practices_paid_through: number
  alert_days_inactive: number
  exam_mode: boolean
  notes: string | null
  preferred_schedule: string | null
  preferred_days: number[] | null
  start_date: string | null
  created_at: string
}

export interface Booking {
  id: string
  student_id: string
  instructor_id: string
  practice_date: string
  start_time: string
  end_time: string
  practice_type: PracticeType
  practice_subtype: PracticeSubtype | null
  status: BookingStatus
  confirmed_by_student: boolean
  no_show: boolean
  notes: string | null
  pickup_location: string | null
  calendar_event_id: string | null
  created_at: string
  student?: Student
}

export interface BlockedDay {
  id: string
  instructor_id: string
  date: string
  reason: string | null
  created_at: string
}

export interface BlockedSlot {
  id: string
  instructor_id: string
  date: string
  start_time: string
  end_time: string
  reason: string | null
  created_at: string
}

export interface Exam {
  id: string
  student_id: string
  instructor_id: string
  exam_type: ExamType
  exam_date: string
  result: ExamResult
  attempt_number: number
  notes: string | null
  created_at: string
  student?: Student
}

export interface Payment {
  id: string
  student_id: string
  instructor_id: string
  amount: number
  concept: string
  status: PaymentStatus
  due_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  student?: Student
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
}

export interface WaitlistEntry {
  id: string
  student_id: string
  instructor_id: string
  practice_type: PracticeType
  requested_at: string
  position: number
  student?: Student
}