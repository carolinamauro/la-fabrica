"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";

export async function signOutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
