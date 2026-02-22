import { Link, useLoaderData, useActionData, Form } from "react-router";
import type { Route } from "./+types/index";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { prisma } from "~/lib/db/client";
import { redirect } from "react-router";
import { PersonIcon, FileTextIcon, ActivityLogIcon } from "@radix-ui/react-icons";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  // Require admin role
  if (user.role !== "admin") {
    throw redirect("/dashboard");
  }

  // Get all users with token stats
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tokensUsed: true,
      tokensRemaining: true,
      createdAt: true,
      lastLoginAt: true,
      _count: {
        select: {
          documents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get recent token transactions
  const recentTransactions = await prisma.tokenTransaction.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Get system stats
  const stats = {
    totalUsers: await prisma.user.count(),
    totalDocuments: await prisma.document.count(),
    totalTokensUsed: await prisma.user
      .aggregate({
        _sum: { tokensUsed: true },
      })
      .then((result) => result._sum.tokensUsed || 0),
    totalTokensRemaining: await prisma.user
      .aggregate({
        _sum: { tokensRemaining: true },
      })
      .then((result) => result._sum.tokensRemaining || 0),
  };

  return { user, users, recentTransactions, stats };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  // Require admin role
  if (user.role !== "admin") {
    throw redirect("/dashboard");
  }

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    switch (actionType) {
      case "addUser": {
        const email = formData.get("email") as string;
        const name = formData.get("name") as string;

        if (!email) {
          return { error: "Email is required" };
        }

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          return { error: "User with this email already exists" };
        }

        await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email,
              name: name || undefined,
              role: "USER",
              tokensRemaining: 1000,
            },
          });

          await tx.tokenTransaction.create({
            data: {
              type: "INITIAL_GRANT",
              amount: 1000,
              reason: "Initial user grant",
              userId: newUser.id,
              adminUserId: user.id,
            },
          });
        });

        return { success: "User added successfully" };
      }

      case "addTokens": {
        const userId = formData.get("userId") as string;
        const amount = parseInt(formData.get("amount") as string);
        const reason = formData.get("reason") as string;

        if (!userId || !amount || amount <= 0) {
          return {
            error: "Invalid user or token amount",
          };
        }

        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { tokensRemaining: { increment: amount } },
          }),
          prisma.tokenTransaction.create({
            data: {
              type: "MANUAL_ADD",
              amount,
              reason: reason || "Manual admin addition",
              userId,
              adminUserId: user.id,
            },
          }),
        ]);

        return {
          success: "Tokens added successfully",
        };
      }

      case "subtractTokens": {
        const userId = formData.get("userId") as string;
        const amount = parseInt(formData.get("amount") as string);
        const reason = formData.get("reason") as string;

        if (!userId || !amount || amount <= 0) {
          return {
            error: "Invalid user or token amount",
          };
        }

        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { tokensRemaining: { decrement: amount } },
          }),
          prisma.tokenTransaction.create({
            data: {
              type: "MANUAL_SUBTRACT",
              amount: -amount,
              reason: reason || "Manual admin removal",
              userId,
              adminUserId: user.id,
            },
          }),
        ]);

        return {
          success: "Tokens removed successfully",
        };
      }

      default:
        return {
          error: "Unknown action type",
        };
    }
  } catch (error) {
    console.error("Admin action failed:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default function AdminDashboard() {
  const { user, users, recentTransactions, stats } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage users, tokens, and system settings
          </p>
        </div>

        {/* Action Messages */}
        {actionData?.success && (
          <div className="mb-6 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-3 rounded">
            {actionData.success}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <PersonIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Total Users
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {stats.totalUsers}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <FileTextIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Total Documents
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {stats.totalDocuments}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <ActivityLogIcon className="h-6 w-6 text-red-400 dark:text-red-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Tokens Used
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {stats.totalTokensUsed.toLocaleString("en-US")}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <ActivityLogIcon className="h-6 w-6 text-green-400 dark:text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Tokens Remaining
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {stats.totalTokensRemaining.toLocaleString("en-US")}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Users Table */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                User Management
              </h3>

              {/* Add User Form */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Add New User
                </h4>
                <Form method="post" className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <input type="hidden" name="actionType" value="addUser" />
                  <div className="flex-1">
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      placeholder="user@example.com"
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor="name"
                      className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                    >
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      placeholder="John Doe"
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                  >
                    Add User
                  </button>
                </Form>
              </div>

              <div className="mt-6 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-3 py-3 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tokens
                      </th>
                      <th className="px-3 py-3 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((userData) => (
                      <tr key={userData.id}>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {userData.name || userData.email}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {userData.email}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {userData.role} • {userData._count.documents} docs
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="text-gray-900 dark:text-gray-100">
                            Used: {userData.tokensUsed.toLocaleString()}
                          </div>
                          <div className="text-green-600 dark:text-green-400">
                            Left: {userData.tokensRemaining.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
                            <Form method="post" className="inline">
                              <input
                                type="hidden"
                                name="actionType"
                                value="addTokens"
                              />
                              <input
                                type="hidden"
                                name="userId"
                                value={userData.id}
                              />
                              <input
                                type="number"
                                name="amount"
                                placeholder="Amount"
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs"
                                required
                              />
                              <input
                                type="text"
                                name="reason"
                                placeholder="Reason"
                                className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs ml-1"
                              />
                              <button
                                type="submit"
                                className="ml-1 px-2 py-1 bg-green-600 dark:bg-green-500 text-white text-xs rounded hover:bg-green-700 dark:hover:bg-green-600"
                              >
                                Add
                              </button>
                            </Form>
                          </div>
                          <div className="flex space-x-2 mt-1">
                            <Form method="post" className="inline">
                              <input
                                type="hidden"
                                name="actionType"
                                value="subtractTokens"
                              />
                              <input
                                type="hidden"
                                name="userId"
                                value={userData.id}
                              />
                              <input
                                type="number"
                                name="amount"
                                placeholder="Amount"
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs"
                                required
                              />
                              <input
                                type="text"
                                name="reason"
                                placeholder="Reason"
                                className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs ml-1"
                              />
                              <button
                                type="submit"
                                className="ml-1 px-2 py-1 bg-red-600 dark:bg-red-500 text-white text-xs rounded hover:bg-red-700 dark:hover:bg-red-600"
                              >
                                Remove
                              </button>
                            </Form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                Recent Token Transactions
              </h3>

              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          transaction.amount > 0
                            ? "bg-green-400 dark:bg-green-500"
                            : "bg-red-400 dark:bg-red-500"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {transaction.user.name || transaction.user.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {transaction.reason}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-sm font-medium ${
                          transaction.amount > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount.toLocaleString()}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(transaction.createdAt).toLocaleDateString(
                          "en-US",
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
