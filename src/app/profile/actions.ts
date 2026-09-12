"use server"

import { redirect } from "next/navigation"
import { destroyCustomerSession } from "@/lib/auth/customer"

export async function customerLogoutAction(): Promise<void> {
  await destroyCustomerSession()
  redirect("/")
}
