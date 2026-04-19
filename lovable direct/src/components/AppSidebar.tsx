import { Link } from "@tanstack/react-router";
import { Building2, Home, BarChart3, Settings, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

const items = [
  { to: "/", label: "Properties", icon: Building2 },
  { to: "/", label: "Home", icon: Home },
  { to: "/", label: "Analytics", icon: BarChart3 },
  { to: "/", label: "Settings", icon: Settings },
];

export function AppSidebar({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[oklch(0.15_0.02_280)] p-6 text-white shadow-2xl"
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/50">
                  Cassandra
                </div>
                <div className="mt-1 text-xl font-semibold">Facility OS</div>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Signed in as</div>
              <div className="mt-1 text-sm font-medium">Super Admin</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
