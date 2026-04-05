import express from "express";
import cors from "cors";
import sql from "./db.js";

const app = express();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return uuidPattern.test(String(value || "").trim());
}

function parseBooleanParam(value, fallbackValue = true) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  return String(value).trim().toLowerCase() === "true";
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function mapCourseRow(course) {
  return {
    courseOfferingId: course.course_offering_id,
    courseCode: course.course_code,
    courseName: course.course_name,
    section: course.section,
    instructorName: course.instructor_name,
    credits: Number(course.credits),
    term: course.term,
    isEnabled: course.is_enabled,
    createdByUserId: course.created_by_user_id,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
  };
}

function mapAssessmentRow(assessment) {
  return {
    id: assessment.assessment_id,
    courseCode: assessment.course_code || "",
    name: assessment.title,
    weight:
      assessment.weight_percent === null || assessment.weight_percent === undefined
        ? ""
        : `${Number(assessment.weight_percent)}%`,
    dueDate: assessment.due_date || "",
  };
}

function normalizeWeightValue(value) {
  const trimmedValue = String(value ?? "").replace("%", "").trim();
  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeAssessmentInput(assessment) {
  const id = String(assessment?.id || "").trim();
  const name = String(assessment?.name || "").trim();
  const dueDate = String(assessment?.dueDate || "").trim();
  const weightPercent = normalizeWeightValue(assessment?.weight);

  if (!isUuid(id)) {
    throw new Error("Each assessment must include a valid id.");
  }

  if (!name) {
    throw new Error("Each assessment must include a name.");
  }

  if (!dueDate) {
    throw new Error("Each assessment must include a due date.");
  }

  if (weightPercent === null) {
    throw new Error("Each assessment must include a valid weight.");
  }

  return {
    id,
    name,
    dueDate,
    weightPercent,
  };
}

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", async (req, res) => {
  try {
    const result = await sql`select now() as current_time`;

    res.json({
      status: "ok",
      service: "smart-course-companion-api",
      database: "connected",
      timestamp: result[0].current_time,
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      service: "smart-course-companion-api",
      database: "disconnected",
      message: error.message,
    });
  }
});

app.get("/api", (req, res) => {
  res.json({
    message: "Smart Course Companion backend is running.",
    endpoints: {
      health: "/health",
      courses: "/api/courses",
      templates: "/api/templates",
      studentProfileAvailability: "/api/student-profiles/availability?studentNumber=:studentNumber",
      enrollments: "/api/students/:userId/enrollments",
      progress: "/api/students/:userId/courses/:courseId/progress",
    },
  });
});

app.get("/api/student-profiles/availability", async (req, res) => {
  const studentNumber = String(req.query.studentNumber || "").trim();

  if (!studentNumber) {
    return badRequest(res, "Student number is required.");
  }

  try {
    const rows = await sql`
      SELECT 1
      FROM public.student_profiles
      WHERE student_number = ${studentNumber}
      LIMIT 1
    `;

    res.json({
      studentNumber,
      available: rows.length === 0,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to validate student number.",
      message: error.message,
    });
  }
});

app.get("/api/courses", async (req, res) => {
  const enabled = parseBooleanParam(req.query.enabled, true);
  const createdByUserId = String(req.query.createdByUserId || "").trim();

  if (createdByUserId && !isUuid(createdByUserId)) {
    return badRequest(res, "Invalid createdByUserId.");
  }

  try {
    const courses = await sql`
      SELECT
        course_offering_id,
        course_code,
        course_name,
        section,
        instructor_name,
        credits,
        term,
        is_enabled,
        created_by_user_id,
        created_at,
        updated_at
      FROM public.available_courses
      WHERE (${createdByUserId || null}::uuid IS NULL OR created_by_user_id = ${createdByUserId || null}::uuid)
        AND (${enabled} = false OR is_enabled = true)
      ORDER BY course_code ASC, section ASC
    `;

    res.json({
      count: courses.length,
      courses: courses.map(mapCourseRow),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load courses.",
      message: error.message,
    });
  }
});

app.get("/api/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;
  if (!isUuid(courseId)) {
    return badRequest(res, "Invalid course id.");
  }

  try {
    const rows = await sql`
      SELECT
        course_offering_id,
        course_code,
        course_name,
        section,
        instructor_name,
        credits,
        term,
        is_enabled,
        created_by_user_id,
        created_at,
        updated_at
      FROM public.available_courses
      WHERE course_offering_id = ${courseId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    res.json(mapCourseRow(rows[0]));
  } catch (error) {
    res.status(500).json({
      error: "Failed to load course.",
      message: error.message,
    });
  }
});

app.post("/api/courses", async (req, res) => {
  const {
    courseCode,
    courseName,
    section,
    instructorName,
    credits,
    term,
    createdByUserId,
  } = req.body || {};

  if (
    !courseCode ||
    !courseName ||
    !section ||
    !instructorName ||
    !term ||
    !isUuid(createdByUserId)
  ) {
    return badRequest(res, "Missing required course fields.");
  }

  const numericCredits = Number(credits);
  if (!Number.isInteger(numericCredits) || numericCredits <= 0) {
    return badRequest(res, "Credits must be a positive integer.");
  }

  try {
    const rows = await sql`
      INSERT INTO public.available_courses (
        course_code,
        course_name,
        section,
        instructor_name,
        credits,
        term,
        created_by_user_id
      )
      VALUES (
        ${String(courseCode).trim()},
        ${String(courseName).trim()},
        ${String(section).trim()},
        ${String(instructorName).trim()},
        ${numericCredits},
        ${String(term).trim()},
        ${createdByUserId}
      )
      RETURNING
        course_offering_id,
        course_code,
        course_name,
        section,
        instructor_name,
        credits,
        term,
        is_enabled,
        created_by_user_id,
        created_at,
        updated_at
    `;

    res.status(201).json(mapCourseRow(rows[0]));
  } catch (error) {
    res.status(500).json({
      error: "Failed to create course.",
      message: error.message,
    });
  }
});

app.patch("/api/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;
  if (!isUuid(courseId)) {
    return badRequest(res, "Invalid course id.");
  }

  if (!Object.prototype.hasOwnProperty.call(req.body || {}, "isEnabled")) {
    return badRequest(res, "No supported course updates were provided.");
  }

  try {
    const rows = await sql`
      UPDATE public.available_courses
      SET
        is_enabled = ${Boolean(req.body.isEnabled)},
        updated_at = NOW()
      WHERE course_offering_id = ${courseId}
      RETURNING
        course_offering_id,
        course_code,
        course_name,
        section,
        instructor_name,
        credits,
        term,
        is_enabled,
        created_by_user_id,
        created_at,
        updated_at
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    res.json(mapCourseRow(rows[0]));
  } catch (error) {
    res.status(500).json({
      error: "Failed to update course.",
      message: error.message,
    });
  }
});

app.delete("/api/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;
  if (!isUuid(courseId)) {
    return badRequest(res, "Invalid course id.");
  }

  try {
    const rows = await sql`
      DELETE FROM public.available_courses
      WHERE course_offering_id = ${courseId}
      RETURNING course_offering_id
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete course.",
      message: error.message,
    });
  }
});

app.get("/api/courses/:courseId/template", async (req, res) => {
  const { courseId } = req.params;
  if (!isUuid(courseId)) {
    return badRequest(res, "Invalid course id.");
  }

  try {
    const assessments = await sql`
      SELECT assessment_id, course_code, title, weight_percent, due_date
      FROM public.assessments
      WHERE course_offering_id = ${courseId}
      ORDER BY due_date ASC, title ASC
    `;

    res.json({
      courseId,
      assessments: assessments.map(mapAssessmentRow),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load course template.",
      message: error.message,
    });
  }
});

app.put("/api/courses/:courseId/template", async (req, res) => {
  const { courseId } = req.params;
  if (!isUuid(courseId)) {
    return badRequest(res, "Invalid course id.");
  }

  const rawAssessments = Array.isArray(req.body?.assessments) ? req.body.assessments : [];

  let assessments;
  try {
    assessments = rawAssessments.map(normalizeAssessmentInput);
  } catch (error) {
    return badRequest(res, error.message);
  }

  try {
    await sql.begin(async (transaction) => {
      const courseRows = await transaction`
        SELECT course_code
        FROM public.available_courses
        WHERE course_offering_id = ${courseId}
        LIMIT 1
      `;

      if (courseRows.length === 0) {
        throw new Error("Course not found.");
      }

      const courseCode = String(courseRows[0].course_code || "").trim();

      await transaction`
        DELETE FROM public.assessments
        WHERE course_offering_id = ${courseId}
      `;

      for (const assessment of assessments) {
        await transaction`
          INSERT INTO public.assessments (
            assessment_id,
            course_offering_id,
            course_code,
            title,
            weight_percent,
            due_date,
            is_published
          )
          VALUES (
            ${assessment.id},
            ${courseId},
            ${courseCode},
            ${assessment.name},
            ${assessment.weightPercent},
            ${assessment.dueDate},
            true
          )
        `;
      }
    });

    res.json({
      courseId,
      assessments: rawAssessments,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to save course template.",
      message: error.message,
    });
  }
});

app.get("/api/templates", async (req, res) => {
  const createdByUserId = String(req.query.createdByUserId || "").trim();
  if (!isUuid(createdByUserId)) {
    return badRequest(res, "Invalid createdByUserId.");
  }

  try {
    const templates = await sql`
      SELECT
        course_template_id,
        template_name,
        template_description,
        created_by_user_id,
        is_active,
        created_at
      FROM public.course_templates
      WHERE created_by_user_id = ${createdByUserId}
        AND is_active = true
      ORDER BY created_at DESC
    `;

    res.json({
      count: templates.length,
      templates: templates.map((template) => ({
        templateId: template.course_template_id,
        templateName: template.template_name,
        templateDescription: template.template_description,
        createdByUserId: template.created_by_user_id,
        isActive: template.is_active,
        createdAt: template.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load reusable templates.",
      message: error.message,
    });
  }
});

app.post("/api/templates", async (req, res) => {
  const {
    templateName,
    templateDescription = "",
    createdByUserId,
  } = req.body || {};

  if (!templateName || !isUuid(createdByUserId)) {
    return badRequest(res, "Missing required reusable template fields.");
  }

  try {
    const normalizedTemplateName = String(templateName).trim();
    const normalizedTemplateDescription = String(templateDescription);

    const existingTemplates = await sql`
      SELECT course_template_id
      FROM public.course_templates
      WHERE created_by_user_id = ${createdByUserId}
        AND template_name = ${normalizedTemplateName}
      LIMIT 1
    `;

    const rows =
      existingTemplates.length > 0
        ? await sql`
            UPDATE public.course_templates
            SET
              template_description = ${normalizedTemplateDescription},
              is_active = true
            WHERE course_template_id = ${existingTemplates[0].course_template_id}
            RETURNING
              course_template_id,
              template_name,
              template_description,
              created_by_user_id,
              is_active,
              created_at
          `
        : await sql`
            INSERT INTO public.course_templates (
              template_name,
              template_description,
              created_by_user_id,
              is_active
            )
            VALUES (
              ${normalizedTemplateName},
              ${normalizedTemplateDescription},
              ${createdByUserId},
              true
            )
            RETURNING
              course_template_id,
              template_name,
              template_description,
              created_by_user_id,
              is_active,
              created_at
          `;

    const template = rows[0];
    res.status(201).json({
      templateId: template.course_template_id,
      templateName: template.template_name,
      templateDescription: template.template_description,
      createdByUserId: template.created_by_user_id,
      isActive: template.is_active,
      createdAt: template.created_at,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to save reusable template.",
      message: error.message,
    });
  }
});

app.get("/api/students/:userId/enrollments", async (req, res) => {
  const { userId } = req.params;
  if (!isUuid(userId)) {
    return badRequest(res, "Invalid user id.");
  }

  try {
    const rows = await sql`
      SELECT
        ac.course_offering_id,
        ac.course_code,
        ac.course_name,
        ac.section,
        ac.instructor_name,
        ac.credits,
        ac.term,
        ac.is_enabled,
        ac.created_by_user_id,
        ac.created_at,
        ac.updated_at
      FROM public.student_course_enrollments sce
      JOIN public.available_courses ac
        ON ac.course_offering_id = sce.course_offering_id
      WHERE sce.user_id = ${userId}
      ORDER BY ac.course_code ASC, ac.section ASC
    `;

    res.json({
      count: rows.length,
      courses: rows.map(mapCourseRow),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load student enrollments.",
      message: error.message,
    });
  }
});

app.post("/api/students/:userId/enrollments", async (req, res) => {
  const { userId } = req.params;
  const courseOfferingId = String(req.body?.courseOfferingId || "").trim();

  if (!isUuid(userId) || !isUuid(courseOfferingId)) {
    return badRequest(res, "Invalid enrollment payload.");
  }

  try {
    await sql`
      INSERT INTO public.student_course_enrollments (
        user_id,
        course_offering_id,
        updated_at
      )
      VALUES (
        ${userId},
        ${courseOfferingId},
        NOW()
      )
      ON CONFLICT (user_id, course_offering_id)
      DO UPDATE SET updated_at = NOW()
    `;

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Failed to save student enrollment.",
      message: error.message,
    });
  }
});

app.delete("/api/students/:userId/enrollments/:courseId", async (req, res) => {
  const { userId, courseId } = req.params;
  if (!isUuid(userId) || !isUuid(courseId)) {
    return badRequest(res, "Invalid enrollment ids.");
  }

  try {
    await sql.begin(async (transaction) => {
      await transaction`
        DELETE FROM public.student_assessment_progress
        WHERE user_id = ${userId}
          AND course_offering_id = ${courseId}
      `;

      await transaction`
        DELETE FROM public.student_course_enrollments
        WHERE user_id = ${userId}
          AND course_offering_id = ${courseId}
      `;
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Failed to remove student enrollment.",
      message: error.message,
    });
  }
});

app.get("/api/students/:userId/courses/:courseId/progress", async (req, res) => {
  const { userId, courseId } = req.params;
  if (!isUuid(userId) || !isUuid(courseId)) {
    return badRequest(res, "Invalid progress ids.");
  }

  try {
    const rows = await sql`
      SELECT assessment_id, grade, status
      FROM public.student_assessment_progress
      WHERE user_id = ${userId}
        AND course_offering_id = ${courseId}
    `;

    const progressByAssessmentId = Object.fromEntries(
      rows.map((row) => [
        row.assessment_id,
        {
          grade: row.grade || "",
          status: row.status || "Not started",
        },
      ]),
    );

    res.json({
      userId,
      courseId,
      progressByAssessmentId,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load student course progress.",
      message: error.message,
    });
  }
});

app.put("/api/students/:userId/courses/:courseId/progress", async (req, res) => {
  const { userId, courseId } = req.params;
  if (!isUuid(userId) || !isUuid(courseId)) {
    return badRequest(res, "Invalid progress ids.");
  }

  const progressByAssessmentId =
    req.body && typeof req.body.progressByAssessmentId === "object"
      ? req.body.progressByAssessmentId
      : {};

  const progressEntries = Object.entries(progressByAssessmentId);
  const invalidAssessmentId = progressEntries.find(([assessmentId]) => !isUuid(assessmentId));
  if (invalidAssessmentId) {
    return badRequest(res, "Invalid assessment id in progress payload.");
  }

  try {
    await sql.begin(async (transaction) => {
      await transaction`
        DELETE FROM public.student_assessment_progress
        WHERE user_id = ${userId}
          AND course_offering_id = ${courseId}
      `;

      for (const [assessmentId, progress] of progressEntries) {
        await transaction`
          INSERT INTO public.student_assessment_progress (
            user_id,
            course_offering_id,
            assessment_id,
            grade,
            status,
            updated_at
          )
          VALUES (
            ${userId},
            ${courseId},
            ${assessmentId},
            ${String(progress?.grade || "").trim()},
            ${String(progress?.status || "Not started").trim() || "Not started"},
            NOW()
          )
        `;
      }
    });

    res.json({
      userId,
      courseId,
      progressByAssessmentId,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to save student course progress.",
      message: error.message,
    });
  }
});

app.delete("/api/students/:userId/courses/:courseId/progress", async (req, res) => {
  const { userId, courseId } = req.params;
  if (!isUuid(userId) || !isUuid(courseId)) {
    return badRequest(res, "Invalid progress ids.");
  }

  try {
    await sql`
      DELETE FROM public.student_assessment_progress
      WHERE user_id = ${userId}
        AND course_offering_id = ${courseId}
    `;

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Failed to remove student course progress.",
      message: error.message,
    });
  }
});

app.get("/api/courses/:courseId/submission-summary", async (req, res) => {
  const { courseId } = req.params;
  if (!isUuid(courseId)) {
    return badRequest(res, "Invalid course id.");
  }

  try {
    const rows = await sql`
      SELECT
        a.assessment_id,
        COUNT(DISTINCT sce.user_id) AS total_count,
        COUNT(
          DISTINCT CASE
            WHEN sap.status = 'Submitted' THEN sap.user_id
            ELSE NULL
          END
        ) AS submitted_count
      FROM public.assessments a
      LEFT JOIN public.student_course_enrollments sce
        ON sce.course_offering_id = a.course_offering_id
      LEFT JOIN public.student_assessment_progress sap
        ON sap.course_offering_id = a.course_offering_id
        AND sap.assessment_id = a.assessment_id
        AND sap.user_id = sce.user_id
      WHERE a.course_offering_id = ${courseId}
      GROUP BY a.assessment_id
    `;

    const summaryByAssessmentId = Object.fromEntries(
      rows.map((row) => {
        const totalCount = Number(row.total_count ?? 0);
        const submittedCount = Number(row.submitted_count ?? 0);
        const completionRate =
          totalCount > 0 ? ((submittedCount / totalCount) * 100).toFixed(2) : "--";

        return [
          row.assessment_id,
          {
            submittedCount,
            totalCount,
            completionStatusText: `${submittedCount}/${totalCount}`,
            completionRateText: totalCount > 0 ? `${completionRate}%` : "--",
          },
        ];
      }),
    );

    res.json({
      courseId,
      summaryByAssessmentId,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load course submission summary.",
      message: error.message,
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

export default app;
