export type RsvpStatus = "going" | "pending_payment" | "waitlist";

export interface Match {
  id: string;
  host_id: string;
  host_name: string;
  title: string;
  description: string | null;
  venue_name: string;
  address: string | null;
  lat: number;
  lng: number;
  starts_at: string;
  duration_min: number;
  min_players: number;
  max_players: number;
  price_cents: number;
  currency: string;
  status: "open" | "cancelled" | "completed";
  going_count: number;
  held_count: number;
  waitlist_count: number;
  spots_left: number;
  is_confirmed: boolean;
  players_needed: number;
  group_id: string | null;
  group_name: string | null;
  visibility: "public" | "group";
  payment_method: "stripe" | "direct";
  payment_instructions: string | null;
}

export interface Rsvp {
  user_id: string;
  status: RsvpStatus;
  paid_at: string | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  starts_at: string | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Poll {
  id: string;
  match_id: string;
  kind: "time" | "location";
  question: string;
  closes_at: string | null;
  poll_options: PollOption[];
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export type Role = "admin" | "participant";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
}

export interface ChatMessage {
  id: string;
  match_id: string | null;
  group_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string; role: Role } | null;
}

export type GroupRole = "organizer" | "participant";
export type MemberStatus = "active" | "pending" | "invited";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  lat: number | null;
  lng: number | null;
  member_count: number;
  pending_count: number;
  my_status: MemberStatus | null;
  my_group_role: GroupRole | null;
}

export interface GroupMember {
  user_id: string;
  role: GroupRole;
  status: MemberStatus;
  profiles: { display_name: string } | null;
}
