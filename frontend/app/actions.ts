"use server";

import { getSupabaseClient } from "@/lib/supabase";

export type InterestFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialState: InterestFormState = { status: "idle" };

export async function submitInterestAction(
  _prevState: InterestFormState,
  formData: FormData
): Promise<InterestFormState> {
  const supabase = getSupabaseClient();
  const name = (formData.get("name") as string)?.trim() ?? "";
  const email = (formData.get("email") as string)?.trim().toLowerCase() ?? "";
  const role = (formData.get("role") as string)?.trim() ?? "";
  const message = (formData.get("message") as string)?.trim() || undefined;

  if (!name || !email || !role) {
    return {
      status: "error",
      message: "Please complete all required fields before submitting.",
    };
  }

  const { error } = await supabase.from("interest_signups").insert({
    name,
    email,
    role,
    message,
  });

  if (error) {
    return {
      status: "error",
      message: "We couldn't save your request. Please try again shortly.",
    };
  }

  return {
    status: "success",
    message: "Thanks! We'll be in touch with early access details soon.",
  };
}
