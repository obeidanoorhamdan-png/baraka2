import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "super_admin" | "admin" | "reviewer" | "aid_distributor" | "viewer" | null;

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;          // any admin-tier role
  isSuperAdmin: boolean;     // admin or super_admin
  canReview: boolean;        // super_admin/admin/reviewer
  canDistribute: boolean;    // super_admin/admin/aid_distributor
  adminRole: AdminRole;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null, session: null, isAdmin: false, isSuperAdmin: false,
  canReview: false, canDistribute: false, adminRole: null, loading: true,
});

const ADMIN_TIER = ["admin", "super_admin", "reviewer", "aid_distributor", "viewer"];
const ROLE_PRIORITY: AdminRole[] = ["super_admin", "admin", "reviewer", "aid_distributor", "viewer"];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .in("role", ADMIN_TIER as any);
    const roles = (data || []).map((r: any) => r.role) as AdminRole[];
    const top = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
    setAdminRole(top);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) setTimeout(() => fetchRole(newSession.user.id), 0);
      else setAdminRole(null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) fetchRole(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = adminRole !== null;
  const isSuperAdmin = adminRole === "super_admin" || adminRole === "admin";
  const canReview = isSuperAdmin || adminRole === "reviewer";
  const canDistribute = isSuperAdmin || adminRole === "aid_distributor";

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isSuperAdmin, canReview, canDistribute, adminRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
