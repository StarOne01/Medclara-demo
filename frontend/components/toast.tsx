"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

import { createContext, useContext } from "react";

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = Date.now().toString();
    const newToast: Toast = { ...toast, id, duration: toast.duration ?? 5000 };
    
    setToasts((prev) => [...prev, newToast]);

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => removeToast(id), newToast.duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const getStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-500/10",
          border: "border-emerald-200 dark:border-emerald-500/30",
          icon: CheckCircle,
          iconColor: "text-emerald-600 dark:text-emerald-400",
          title: "text-emerald-900 dark:text-emerald-200",
          message: "text-emerald-700 dark:text-emerald-300",
        };
      case "error":
        return {
          bg: "bg-rose-50 dark:bg-rose-500/10",
          border: "border-rose-200 dark:border-rose-500/30",
          icon: AlertCircle,
          iconColor: "text-rose-600 dark:text-rose-400",
          title: "text-rose-900 dark:text-rose-200",
          message: "text-rose-700 dark:text-rose-300",
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-500/10",
          border: "border-amber-200 dark:border-amber-500/30",
          icon: AlertTriangle,
          iconColor: "text-amber-600 dark:text-amber-400",
          title: "text-amber-900 dark:text-amber-200",
          message: "text-amber-700 dark:text-amber-300",
        };
      case "info":
      default:
        return {
          bg: "bg-blue-50 dark:bg-blue-500/10",
          border: "border-blue-200 dark:border-blue-500/30",
          icon: Info,
          iconColor: "text-blue-600 dark:text-blue-400",
          title: "text-blue-900 dark:text-blue-200",
          message: "text-blue-700 dark:text-blue-300",
        };
    }
  };

  const styles = getStyles(toast.type);
  const Icon = styles.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`pointer-events-auto rounded-lg border ${styles.bg} ${styles.border} p-4 shadow-lg max-w-sm`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${styles.iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${styles.title}`}>{toast.title}</p>
          {toast.message && (
            <p className={`text-sm mt-1 ${styles.message}`}>{toast.message}</p>
          )}
        </div>
        <motion.button
          onClick={() => onRemove(toast.id)}
          className={`flex-shrink-0 ${styles.iconColor} hover:opacity-70 transition`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X className="h-5 w-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}
