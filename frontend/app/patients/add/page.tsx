"use client";

import { useState, useEffect } from "react";
import { motion, type Variants, type Easing } from "framer-motion";
import { ArrowLeft, AlertCircle, Loader } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SideNav } from "@/components/side-nav";
import { PatientForm } from "@/components/patient-form";
import { useSidebar } from "@/lib/sidebar-context";
import { useToast } from "@/components/toast";
import { getApiClient } from "@/lib/api-client-unified";

const easeOutExpo: Easing = [0.12, 0.12, 0.1, 0.1];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutExpo },
  },
};

export default function AddPatientPage() {
  const { isCollapsed } = useSidebar();
  const { addToast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userOrganizationId, setUserOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get user's organization ID
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const client = getApiClient();
        const user = await client.auth.getCurrentUser();

        if (user.organization_id) {
          setUserOrganizationId(user.organization_id);
        } else {

          setError("Unable to determine organization. Please contact support.");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load user data";
        setError(errorMessage);
        addToast({
          type: "error",
          title: "Error",
          message: errorMessage,
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePatient = async (formData: {
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    medical_record_number?: string;
  }) => {
    if (!userOrganizationId) {
      throw new Error("Organization ID not available");
    }

    setIsLoading(true);
    try {
      const client = getApiClient();
      const newPatient = await client.patients.create({
        ...formData,
        organization_id: userOrganizationId,
      });

      addToast({
        type: "success",
        title: "Patient Created",
        message: `${newPatient.firstName} ${newPatient.lastName} has been added successfully`,
      });

      // Redirect to patient profile after a short delay
      setTimeout(() => {
        router.push(`/patients/${newPatient.id}`);
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex h-screen flex-col bg-stone-50 dark:bg-slate-950">
        <SideNav />
        <main
          className={`flex items-center justify-center flex-1 px-6 transition-all duration-300 ${
            isCollapsed ? "ml-20" : "ml-64"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 text-slate-400 dark:text-zinc-500 animate-spin" />
            <p className="text-sm text-slate-600 dark:text-zinc-400">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-stone-50 dark:bg-slate-950">
      <SideNav />

      <main
        className={`flex h-screen flex-1 flex-col gap-6 overflow-auto px-6 pb-6 pt-6 transition-all duration-300 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
        <motion.div className="flex items-center justify-between" variants={fadeInUp} initial="hidden" animate="visible">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Add New Patient</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Create a new patient record</p>
          </div>
          <Link
            href="/patients"
            className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </motion.div>

        {/* Form Container */}
        <motion.div
          className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          {error && (
            <motion.div
              className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            </motion.div>
          )}

          <PatientForm
            onSubmit={handleCreatePatient}
            isLoading={isLoading}
            submitButtonText="Create Patient"
            onCancel={() => router.back()}
          />
        </motion.div>

        {/* Info Box */}
        <motion.div
          className="w-full max-w-2xl rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <h3 className="font-medium text-slate-900 dark:text-white mb-2">Information</h3>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-zinc-400 list-disc list-inside">
            <li>All fields marked with * are required</li>
            <li>Medical Record Numbers must be unique across the system</li>
            <li>Email and phone are optional but recommended</li>
            <li>The patient will be automatically assigned to your organization</li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}
