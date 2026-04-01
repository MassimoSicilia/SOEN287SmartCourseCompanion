const API_BASE_URL =
  window.SMART_COURSE_API_URL || "http://localhost:3000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorPayload = await response.json();
      message = errorPayload.message || errorPayload.error || message;
    } catch (error) {
      // Keep the generic message when the response body is empty or invalid.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

window.SmartCourseApi = {
  getCourses(params = {}) {
    return apiRequest(`/courses${buildQuery(params)}`);
  },

  getCourse(courseId) {
    return apiRequest(`/courses/${encodeURIComponent(courseId)}`);
  },

  createCourse(payload) {
    return apiRequest("/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateCourse(courseId, payload) {
    return apiRequest(`/courses/${encodeURIComponent(courseId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteCourse(courseId) {
    return apiRequest(`/courses/${encodeURIComponent(courseId)}`, {
      method: "DELETE",
    });
  },

  getCourseTemplate(courseId) {
    return apiRequest(`/courses/${encodeURIComponent(courseId)}/template`);
  },

  saveCourseTemplate(courseId, assessments) {
    return apiRequest(`/courses/${encodeURIComponent(courseId)}/template`, {
      method: "PUT",
      body: JSON.stringify({ assessments }),
    });
  },

  getReusableTemplates(createdByUserId) {
    return apiRequest(`/templates${buildQuery({ createdByUserId })}`);
  },

  saveReusableTemplate(payload) {
    return apiRequest("/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getStudentEnrollments(userId) {
    return apiRequest(`/students/${encodeURIComponent(userId)}/enrollments`);
  },

  addStudentEnrollment(userId, courseOfferingId) {
    return apiRequest(`/students/${encodeURIComponent(userId)}/enrollments`, {
      method: "POST",
      body: JSON.stringify({ courseOfferingId }),
    });
  },

  removeStudentEnrollment(userId, courseId) {
    return apiRequest(
      `/students/${encodeURIComponent(userId)}/enrollments/${encodeURIComponent(courseId)}`,
      {
        method: "DELETE",
      },
    );
  },

  getStudentCourseProgress(userId, courseId) {
    return apiRequest(
      `/students/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/progress`,
    );
  },

  saveStudentCourseProgress(userId, courseId, progressByAssessmentId) {
    return apiRequest(
      `/students/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/progress`,
      {
        method: "PUT",
        body: JSON.stringify({ progressByAssessmentId }),
      },
    );
  },

  removeStudentCourseProgress(userId, courseId) {
    return apiRequest(
      `/students/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/progress`,
      {
        method: "DELETE",
      },
    );
  },

  getCourseSubmissionSummary(courseId) {
    return apiRequest(`/courses/${encodeURIComponent(courseId)}/submission-summary`);
  },
};
