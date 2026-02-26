import { type ActionFunctionArgs, data } from "react-router";
import { requireUser } from "~/lib/auth/session.server";
import { prisma } from "~/lib/db/client";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastConsentAt: new Date() },
    });

    return data({ success: true, lastConsentAt: updatedUser.lastConsentAt });
  } catch (error) {
    console.error("Failed to update consent:", error);
    return data({ error: "Failed to update consent" }, { status: 500 });
  }
}
