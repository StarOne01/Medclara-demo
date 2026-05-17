"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";

interface PatientFormProps {
  onSubmit: (data: {
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    medical_record_number?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
}

export function PatientForm({
  onSubmit,
  isLoading = false,
  submitButtonText = "Create Patient",
  onCancel,
}: PatientFormProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    email: "",
    phone: "",
    medical_record_number: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      errors.first_name = "First name is required";
    }
    if (!formData.last_name.trim()) {
      errors.last_name = "Last name is required";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (formData.phone && !/^[\d\-+() ]+$/.test(formData.phone)) {
      errors.phone = "Please enter a valid phone number";
    }
    if (formData.date_of_birth && isNaN(Date.parse(formData.date_of_birth))) {
      errors.date_of_birth = "Please enter a valid date";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validateForm()) {
      setError("Please fix the errors above");
      return;
    }

    try {
      await onSubmit(formData);
      setSuccess(true);
      setFormData({
        first_name: "",
        last_name: "",
        date_of_birth: "",
        gender: "",
        email: "",
        phone: "",
        medical_record_number: "",
      });
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : "Failed to create patient";
      
      // Handle specific API errors
      if (err instanceof Error && 'statusCode' in err) {
        const apiError = err as any;
        if (apiError.statusCode === 403) {
          errorMessage = "You can only create patients in your own organization";
        } else if (apiError.statusCode === 409) {
          errorMessage = "This medical record number already exists";
        } else if (apiError.statusCode === 422) {
          errorMessage = "Invalid patient data provided";
        }
      }
      
      setError(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <motion.div
          className="flex items-center gap-3 rounded-lg border border-[color:var(--color-error)] bg-[color:var(--color-error)]/10 p-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle className="h-5 w-5 text-[color:var(--color-error)] flex-shrink-0" />
          <p className="text-sm font-medium text-[color:var(--color-error)]">{error}</p>
        </motion.div>
      )}

      {/* Success Message */}
      {success && (
        <motion.div
          className="flex items-center gap-3 rounded-lg border border-[color:var(--color-success)] bg-[color:var(--color-success)]/10 p-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CheckCircle className="h-5 w-5 text-[color:var(--color-success)] flex-shrink-0" />
          <p className="text-sm font-medium text-[color:var(--color-success)]">Patient created successfully!</p>
        </motion.div>
      )}

      {/* Required Fields Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-[color:var(--text-primary)]">Required Information *</h3>

        <div className="grid gap-4 md:grid-cols-2">
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">
              First Name *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className={`w-full rounded-lg border bg-[color:var(--surface-card)] px-3.5 py-2.5 text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/20 transition ${
                validationErrors.first_name
                  ? "border-[color:var(--color-error)]"
                  : "border-[color:var(--border-subtle)] focus:border-[color:var(--border-strong)]"
              }`}
              placeholder="John"
              disabled={isLoading}
            />
            {validationErrors.first_name && (
              <p className="text-xs text-[color:var(--color-error)] mt-1">{validationErrors.first_name}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">
              Last Name *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className={`w-full rounded-lg border bg-[color:var(--surface-card)] px-3.5 py-2.5 text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/20 transition ${
                validationErrors.last_name
                  ? "border-[color:var(--color-error)]"
                  : "border-[color:var(--border-subtle)] focus:border-[color:var(--border-strong)]"
              }`}
              placeholder="Doe"
              disabled={isLoading}
            />
            {validationErrors.last_name && (
              <p className="text-xs text-[color:var(--color-error)] mt-1">{validationErrors.last_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Optional Fields Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-[color:var(--text-primary)]">Additional Information</h3>

        {/* Date of Birth */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
            Date of Birth
          </label>
          <input
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 transition dark:bg-white/5 dark:text-white dark:focus-visible:ring-sky-900 ${
              validationErrors.date_of_birth
                ? "border-red-300 dark:border-red-700"
                : "border-slate-200 focus:border-slate-300 dark:border-white/10 dark:focus:border-white/20"
            }`}
            disabled={isLoading}
          />
          {validationErrors.date_of_birth && (
            <p className="text-xs text-red-500 mt-1">{validationErrors.date_of_birth}</p>
          )}
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
            Gender
          </label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 transition dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20 dark:focus-visible:ring-sky-900"
            disabled={isLoading}
          >
            <option value="">Select gender</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 transition dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus-visible:ring-sky-900 ${
                validationErrors.email
                  ? "border-red-300 dark:border-red-700"
                  : "border-slate-200 focus:border-slate-300 dark:border-white/10 dark:focus:border-white/20"
              }`}
              placeholder="john@example.com"
              disabled={isLoading}
            />
            {validationErrors.email && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 transition dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus-visible:ring-sky-900 ${
                validationErrors.phone
                  ? "border-red-300 dark:border-red-700"
                  : "border-slate-200 focus:border-slate-300 dark:border-white/10 dark:focus:border-white/20"
              }`}
              placeholder="+1-555-0123"
              disabled={isLoading}
            />
            {validationErrors.phone && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>
            )}
          </div>
        </div>

        {/* Medical Record Number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
            Medical Record Number
          </label>
          <input
            type="text"
            value={formData.medical_record_number}
            onChange={(e) => setFormData({ ...formData, medical_record_number: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 transition dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus-visible:ring-sky-900"
            placeholder="MRN-12345"
            disabled={isLoading}
          />
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
            Must be unique if provided
          </p>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center gap-3 pt-4">
        <motion.button
          type="submit"
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-stone-100 dark:disabled:bg-stone-400 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading && <Loader className="h-4 w-4 animate-spin" />}
          {submitButtonText}
        </motion.button>

        {onCancel && (
          <motion.button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 transition"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Cancel
          </motion.button>
        )}
      </div>
    </form>
  );
}
