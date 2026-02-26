import { json, type ActionFunctionArgs } from "react-router";
import { requireUser } from "~/lib/auth/session.server";
import { prisma } from "~/lib/db/client";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastConsentAt: new Date() },
    });

    return json({ success: true });
  } catch (error) {
    console.error("Error updating consent:", error);
    return json({ success: false, error: "Failed to update consent" }, { status: 500 });
  }
}
