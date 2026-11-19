/* eslint-disable @typescript-eslint/no-explicit-any */
// OpenAPI 3 description of the FixItNow API. Served by Swagger UI at /api/docs
// and also used to generate the Postman collection (npm run docs:postman).

const bearer = [{ bearerAuth: [] }];

const jsonBody = (properties: Record<string, any>, required: string[] = [], example?: any) => ({
  required: true,
  content: {
    "application/json": {
      schema: { type: "object", required, properties },
      ...(example ? { example } : {}),
    },
  },
});

const param = (name: string, description: string, where: "path" | "query" = "query", schema: any = { type: "string" }) => ({
  name,
  in: where,
  required: where === "path",
  description,
  schema,
});

const idParam = (what: string) => param("id", `${what} id`, "path");

const paging = [
  param("page", "Page number (default 1)", "query", { type: "integer", minimum: 1 }),
  param("limit", "Items per page (default 10, max 100)", "query", { type: "integer", minimum: 1, maximum: 100 }),
];

const responses = (okDescription: string, ...errors: number[]) => {
  const names: Record<number, string> = {
    400: "Validation failed or invalid request",
    401: "Missing, invalid or expired token",
    403: "Not allowed for this role (or account banned)",
    404: "Resource not found",
    409: "Conflict (duplicate or already in that state)",
    503: "Payment provider not configured",
  };
  const out: Record<string, any> = {
    "200": { description: okDescription, content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
  };
  for (const code of errors) {
    out[String(code)] = { description: names[code], content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  }
  return out;
};

const created = (description: string, ...errors: number[]) => {
  const r = responses(description, ...errors);
  r["201"] = r["200"];
  delete r["200"];
  return r;
};

const bookingStatuses = ["REQUESTED", "ACCEPTED", "DECLINED", "PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FixItNow API",
    version: "1.0.0",
    description: [
      "Backend for **FixItNow**, a home services marketplace. Customers book technicians, pay through **Stripe Checkout**, and review finished jobs.",
      "",
      "**Roles:** `CUSTOMER`, `TECHNICIAN`, `ADMIN`",
      "",
      "**Success response:** `{ success: true, message, data, meta? }`",
      "",
      "**Error response:** `{ success: false, message, errorDetails }`",
      "",
      "**How to authorize here:** call `POST /auth/login`, copy the `token`, press the **Authorize** button and paste it.",
      "",
      "**Demo accounts (after `npm run db:seed`):** admin `admin@fixitnow.com / Admin@12345`, customer `tania@example.com / Customer@123`, technician `rahim.plumber@fixitnow.com / Tech@12345`.",
    ].join("\n"),
  },
  servers: [{ url: "/api", description: "Current server" }],
  tags: [
    { name: "Auth" },
    { name: "Public" },
    { name: "Bookings" },
    { name: "Payments" },
    { name: "Reviews" },
    { name: "Technician" },
    { name: "Admin" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Success: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { nullable: true },
          meta: {
            type: "object",
            properties: {
              page: { type: "integer" },
              limit: { type: "integer" },
              total: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Validation failed" },
          errorDetails: {
            nullable: true,
            example: [{ field: "email", message: "Please provide a valid email" }],
          },
        },
      },
    },
  },
  paths: {
    // ---------------------------------------------------------------- Auth
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a customer or technician",
        description: "Admins cannot be created here. A technician gets an empty profile automatically.",
        requestBody: jsonBody(
          {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", description: "8+ chars, at least one letter and one number" },
            role: { type: "string", enum: ["CUSTOMER", "TECHNICIAN"] },
            phone: { type: "string" },
            address: { type: "string" },
          },
          ["name", "email", "password", "role"],
          { name: "Tania Rahman", email: "tania.new@example.com", password: "Passw0rd1", role: "CUSTOMER", phone: "01711111111", address: "Dhanmondi, Dhaka" },
        ),
        responses: created("Account created, returns user and JWT", 400, 409),
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive a JWT",
        requestBody: jsonBody(
          { email: { type: "string" }, password: { type: "string" } },
          ["email", "password"],
          { email: "tania@example.com", password: "Customer@123" },
        ),
        responses: responses("Logged in", 400, 401, 403),
      },
    },
    "/auth/me": {
      get: { tags: ["Auth"], summary: "Get the logged-in user", security: bearer, responses: responses("Current user", 401, 403) },
      patch: {
        tags: ["Auth"],
        summary: "Update own name, phone or address",
        security: bearer,
        requestBody: jsonBody({ name: { type: "string" }, phone: { type: "string" }, address: { type: "string" } }, [], {
          name: "Tania R.",
          phone: "01711111111",
        }),
        responses: responses("Profile updated", 400, 401),
      },
    },
    "/auth/change-password": {
      patch: {
        tags: ["Auth"],
        summary: "Change own password",
        security: bearer,
        requestBody: jsonBody(
          { currentPassword: { type: "string" }, newPassword: { type: "string" } },
          ["currentPassword", "newPassword"],
          { currentPassword: "Customer@123", newPassword: "NewPass123" },
        ),
        responses: responses("Password changed", 400, 401),
      },
    },

    // -------------------------------------------------------------- Public
    "/categories": { get: { tags: ["Public"], summary: "List active service categories", responses: responses("Categories") } },
    "/services": {
      get: {
        tags: ["Public"],
        summary: "Browse services with search, filters, sorting and pagination",
        parameters: [
          param("search", "Matches title or description"),
          param("category", "Category id or slug, e.g. plumbing"),
          param("location", "Technician city, e.g. Dhaka"),
          param("minPrice", "Minimum price", "query", { type: "number" }),
          param("maxPrice", "Maximum price", "query", { type: "number" }),
          param("minRating", "Minimum technician rating (0-5)", "query", { type: "number" }),
          param("sortBy", "Sort field", "query", { type: "string", enum: ["price", "rating", "newest"] }),
          param("order", "Sort direction", "query", { type: "string", enum: ["asc", "desc"] }),
          ...paging,
        ],
        responses: responses("Paginated services", 400),
      },
    },
    "/services/{id}": {
      get: { tags: ["Public"], summary: "Service details", parameters: [idParam("Service")], responses: responses("Service", 404) },
    },
    "/technicians": {
      get: {
        tags: ["Public"],
        summary: "Browse technicians",
        parameters: [
          param("search", "Name, headline or bio"),
          param("category", "Category id or slug"),
          param("city", "City"),
          param("skill", "Exact skill, e.g. wiring"),
          param("minRating", "Minimum rating (0-5)", "query", { type: "number" }),
          param("sortBy", "Sort field", "query", { type: "string", enum: ["rating", "experience", "rate"] }),
          param("order", "Sort direction", "query", { type: "string", enum: ["asc", "desc"] }),
          ...paging,
        ],
        responses: responses("Paginated technicians", 400),
      },
    },
    "/technicians/{id}": {
      get: {
        tags: ["Public"],
        summary: "Technician profile with services, availability and reviews",
        parameters: [idParam("Technician profile")],
        responses: responses("Technician", 404),
      },
    },

    // ------------------------------------------------------------ Bookings
    "/bookings": {
      post: {
        tags: ["Bookings"],
        summary: "Book a technician (customer)",
        description:
          "`scheduledAt` must be in the future and fit inside one of the technician's weekly availability slots (UTC). A time already taken by an accepted/paid job returns 409.",
        security: bearer,
        requestBody: jsonBody(
          {
            serviceId: { type: "string" },
            scheduledAt: { type: "string", format: "date-time" },
            address: { type: "string" },
            notes: { type: "string" },
          },
          ["serviceId", "scheduledAt", "address"],
          { serviceId: "<serviceId>", scheduledAt: "2027-03-01T10:00:00Z", address: "House 12, Road 5, Dhanmondi", notes: "Please call before arriving" },
        ),
        responses: created("Booking created with status REQUESTED", 400, 401, 403, 404, 409),
      },
      get: {
        tags: ["Bookings"],
        summary: "My bookings (customer: own bookings, technician: assigned bookings)",
        security: bearer,
        parameters: [param("status", "Filter by status", "query", { type: "string", enum: bookingStatuses }), ...paging],
        responses: responses("Paginated bookings", 400, 401, 403),
      },
    },
    "/bookings/{id}": {
      get: { tags: ["Bookings"], summary: "Booking details (owner, assigned technician or admin)", security: bearer, parameters: [idParam("Booking")], responses: responses("Booking", 401, 404) },
    },
    "/bookings/{id}/cancel": {
      patch: {
        tags: ["Bookings"],
        summary: "Cancel a booking before it is in progress (customer)",
        description: "If the booking is already PAID the payment is refunded through Stripe.",
        security: bearer,
        parameters: [idParam("Booking")],
        responses: responses("Booking cancelled", 400, 401, 403, 404),
      },
    },

    // ------------------------------------------------------------ Payments
    "/payments/create": {
      post: {
        tags: ["Payments"],
        summary: "Create a Stripe Checkout session for an ACCEPTED booking (customer)",
        description: "Returns `checkoutUrl`. Open it in a browser and pay with the Stripe test card `4242 4242 4242 4242`.",
        security: bearer,
        requestBody: jsonBody({ bookingId: { type: "string" } }, ["bookingId"], { bookingId: "<bookingId>" }),
        responses: created("Checkout session created", 400, 401, 403, 404, 409, 503),
      },
    },
    "/payments/confirm": {
      post: {
        tags: ["Payments"],
        summary: "Verify a Checkout session with Stripe and mark the booking PAID (customer)",
        description: "Call this from the success page with the `session_id` Stripe appended to the URL. Safe to call more than once.",
        security: bearer,
        requestBody: jsonBody({ sessionId: { type: "string", example: "cs_test_a1b2c3" } }, ["sessionId"], { sessionId: "cs_test_a1b2c3" }),
        responses: responses("Payment confirmed", 400, 401, 403, 404, 503),
      },
    },
    "/payments/webhook": {
      post: {
        tags: ["Payments"],
        summary: "Stripe webhook (called by Stripe, not by clients)",
        description:
          "Verifies the `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET`. Handles `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired` and `checkout.session.async_payment_failed`.",
        parameters: [{ name: "Stripe-Signature", in: "header", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: responses("Event processed", 400, 503),
      },
    },
    "/payments": {
      get: {
        tags: ["Payments"],
        summary: "Payment history (customer: own payments, technician: payments for own jobs)",
        security: bearer,
        parameters: [param("status", "Payment status", "query", { type: "string", enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] }), ...paging],
        responses: responses("Paginated payments", 400, 401, 403),
      },
    },
    "/payments/{id}": {
      get: { tags: ["Payments"], summary: "Payment details", security: bearer, parameters: [idParam("Payment")], responses: responses("Payment", 401, 404) },
    },

    // ------------------------------------------------------------- Reviews
    "/reviews": {
      post: {
        tags: ["Reviews"],
        summary: "Review a COMPLETED booking (customer, once per booking)",
        security: bearer,
        requestBody: jsonBody(
          { bookingId: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } },
          ["bookingId", "rating"],
          { bookingId: "<bookingId>", rating: 5, comment: "Quick, clean and polite." },
        ),
        responses: created("Review created", 400, 401, 403, 404, 409),
      },
    },

    // ---------------------------------------------------------- Technician
    "/technician/profile": {
      get: { tags: ["Technician"], summary: "My technician profile", security: bearer, responses: responses("Profile", 401, 403) },
      put: {
        tags: ["Technician"],
        summary: "Update my technician profile",
        security: bearer,
        requestBody: jsonBody(
          {
            headline: { type: "string" },
            bio: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            experienceYears: { type: "integer" },
            hourlyRate: { type: "number" },
            city: { type: "string" },
          },
          [],
          { headline: "Licensed electrician", bio: "Safe, tidy work.", skills: ["wiring", "fans"], experienceYears: 6, hourlyRate: 18, city: "Dhaka" },
        ),
        responses: responses("Profile updated", 400, 401, 403),
      },
    },
    "/technician/availability": {
      put: {
        tags: ["Technician"],
        summary: "Replace my weekly availability slots",
        description: "`dayOfWeek` is 0 (Sunday) to 6 (Saturday). Times are `HH:mm` in UTC. Slots on the same day may not overlap.",
        security: bearer,
        requestBody: jsonBody(
          {
            slots: {
              type: "array",
              items: {
                type: "object",
                properties: { dayOfWeek: { type: "integer" }, startTime: { type: "string" }, endTime: { type: "string" } },
              },
            },
          },
          ["slots"],
          { slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" }] },
        ),
        responses: responses("Availability updated", 400, 401, 403),
      },
    },
    "/technician/services": {
      get: { tags: ["Technician"], summary: "My services", security: bearer, responses: responses("Services", 401, 403) },
      post: {
        tags: ["Technician"],
        summary: "Add a service I offer",
        security: bearer,
        requestBody: jsonBody(
          {
            title: { type: "string" },
            description: { type: "string" },
            categoryId: { type: "string" },
            price: { type: "number" },
            durationMinutes: { type: "integer" },
          },
          ["title", "description", "categoryId", "price"],
          { title: "Ceiling fan installation", description: "Fit a new fan including wiring check.", categoryId: "<categoryId>", price: 18, durationMinutes: 60 },
        ),
        responses: created("Service created", 400, 401, 403),
      },
    },
    "/technician/services/{id}": {
      put: {
        tags: ["Technician"],
        summary: "Update one of my services",
        security: bearer,
        parameters: [idParam("Service")],
        requestBody: jsonBody({ title: { type: "string" }, description: { type: "string" }, price: { type: "number" }, durationMinutes: { type: "integer" }, isActive: { type: "boolean" } }, [], { price: 22 }),
        responses: responses("Service updated", 400, 401, 403, 404),
      },
      delete: {
        tags: ["Technician"],
        summary: "Delete a service (deactivated instead if it has past bookings)",
        security: bearer,
        parameters: [idParam("Service")],
        responses: responses("Service removed", 401, 403, 404),
      },
    },
    "/technician/bookings": {
      get: {
        tags: ["Technician"],
        summary: "Bookings assigned to me",
        security: bearer,
        parameters: [param("status", "Filter by status", "query", { type: "string", enum: bookingStatuses }), ...paging],
        responses: responses("Paginated bookings", 400, 401, 403),
      },
    },
    "/technician/bookings/{id}": {
      patch: {
        tags: ["Technician"],
        summary: "Accept / decline / start / complete a booking",
        description: "Allowed moves: REQUESTED -> ACCEPTED or DECLINED, PAID -> IN_PROGRESS, IN_PROGRESS -> COMPLETED. PAID is only set by the Stripe payment flow.",
        security: bearer,
        parameters: [idParam("Booking")],
        requestBody: jsonBody(
          { status: { type: "string", enum: ["ACCEPTED", "DECLINED", "IN_PROGRESS", "COMPLETED"] }, declineReason: { type: "string" } },
          ["status"],
          { status: "ACCEPTED" },
        ),
        responses: responses("Booking updated", 400, 401, 403, 404, 409),
      },
    },

    // --------------------------------------------------------------- Admin
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List users",
        security: bearer,
        parameters: [
          param("role", "Filter by role", "query", { type: "string", enum: ["CUSTOMER", "TECHNICIAN", "ADMIN"] }),
          param("status", "Filter by status", "query", { type: "string", enum: ["ACTIVE", "BANNED"] }),
          param("search", "Name or email"),
          ...paging,
        ],
        responses: responses("Paginated users", 400, 401, 403),
      },
    },
    "/admin/users/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Ban or unban a user",
        security: bearer,
        parameters: [idParam("User")],
        requestBody: jsonBody({ status: { type: "string", enum: ["ACTIVE", "BANNED"] } }, ["status"], { status: "BANNED" }),
        responses: responses("User updated", 400, 401, 403, 404),
      },
    },
    "/admin/bookings": {
      get: {
        tags: ["Admin"],
        summary: "All bookings",
        security: bearer,
        parameters: [
          param("status", "Filter by status", "query", { type: "string", enum: bookingStatuses }),
          param("customerId", "Filter by customer user id"),
          param("technicianId", "Filter by technician profile id"),
          ...paging,
        ],
        responses: responses("Paginated bookings", 400, 401, 403),
      },
    },
    "/admin/payments": {
      get: {
        tags: ["Admin"],
        summary: "All payments",
        security: bearer,
        parameters: [param("status", "Payment status", "query", { type: "string", enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] }), ...paging],
        responses: responses("Paginated payments", 400, 401, 403),
      },
    },
    "/admin/categories": {
      get: { tags: ["Admin"], summary: "All categories (including disabled)", security: bearer, responses: responses("Categories", 401, 403) },
      post: {
        tags: ["Admin"],
        summary: "Create a category",
        security: bearer,
        requestBody: jsonBody({ name: { type: "string" }, description: { type: "string" }, icon: { type: "string" } }, ["name"], {
          name: "Pest Control",
          description: "Termites, cockroaches and rodents",
        }),
        responses: created("Category created", 400, 401, 403, 409),
      },
    },
    "/admin/categories/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update or disable a category",
        security: bearer,
        parameters: [idParam("Category")],
        requestBody: jsonBody({ name: { type: "string" }, description: { type: "string" }, icon: { type: "string" }, isActive: { type: "boolean" } }, [], { isActive: false }),
        responses: responses("Category updated", 400, 401, 403, 404, 409),
      },
      delete: {
        tags: ["Admin"],
        summary: "Delete a category that has no services",
        security: bearer,
        parameters: [idParam("Category")],
        responses: responses("Category deleted", 401, 403, 404, 409),
      },
    },
  },
};
