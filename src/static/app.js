document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper: escape HTML to avoid XSS
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Helper: get up to two initials from the part before the @ in an email (fallback safe)
  function getInitials(email) {
    try {
      const local = String(email).split("@")[0];
      // split by non-word chars to try to get name parts
      const parts = local.split(/[\.\-_]/).filter(Boolean);
      const source = parts.length ? parts : [local];
      const letters = source
        .slice(0, 2) // take up to two parts
        .map(s => s[0] || "")
        .join("")
        .toUpperCase();
      return letters || (String(email).slice(0, 2).toUpperCase());
    } catch {
      return "??";
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Reset select options (keep default placeholder)
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants HTML
        let participantsHtml = "";
        if (Array.isArray(details.participants) && details.participants.length > 0) {
          participantsHtml = details.participants
            .map(p => {
              const safe = escapeHtml(p);
              const initials = escapeHtml(getInitials(p));
              // Add a remove button next to each participant. data attributes carry activity and email info.
              return `<li data-email="${safe}" data-activity="${escapeHtml(name)}"><span class="participant-initial">${initials}</span><span class="participant-email" title="${safe}">${safe}</span><button type="button" class="participant-remove" aria-label="Remove ${safe}" data-email="${safe}" data-activity="${escapeHtml(name)}">Remove</button></li>`;
            })
            .join("");
        } else {
          participantsHtml = `<li class="no-participants">No participants yet</li>`;
        }

        activityCard.innerHTML = `
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(details.description)}</p>
          <p><strong>Schedule:</strong> ${escapeHtml(details.schedule)}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            <strong>Participants:</strong>
            <ul class="participants-list">
              ${participantsHtml}
            </ul>
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Refresh activities so the new participant appears without a full page reload
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();

  // Event delegation for participant remove buttons
  activitiesList.addEventListener("click", async (event) => {
    const btn = event.target.closest(".participant-remove");
    if (!btn) return;

    const email = btn.dataset.email;
    const activity = btn.dataset.activity;

    if (!email || !activity) {
      return;
    }

    // Confirm with the user before removing
    const ok = window.confirm(`Unregister ${email} from ${activity}?`);
    if (!ok) return;

    try {
      const resp = await fetch(`/activities/${encodeURIComponent(activity)}/participants?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });

      if (resp.ok) {
        // Refresh activities to update counts and lists
        fetchActivities();
      } else {
        const payload = await resp.json().catch(() => ({}));
        alert(payload.detail || payload.message || "Failed to remove participant");
      }
    } catch (error) {
      console.error("Error removing participant:", error);
      alert("Failed to remove participant. Please try again.");
    }
  });
});
