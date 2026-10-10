const rowsElement = document.querySelector("#student-rows");
const searchInput = document.querySelector("#search");
const classFilter = document.querySelector("#class-filter");
const sortOrder = document.querySelector("#sort-order");
const dialog = document.querySelector("#student-dialog");
const form = document.querySelector("#student-form");
const errorElement = document.querySelector("#form-error");
const toast = document.querySelector("#toast");
let students = [];
let editingId = null;
let searchTimer;
let toastTimer;

const avatarColors = [
  ["#e0eff5", "#315f79"],
  ["#f8ecd0", "#805e24"],
  ["#fde8e2", "#a64e3b"],
  ["#e0eee6", "#41684f"],
];

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function renderRows(records) {
  rowsElement.replaceChildren();
  records.forEach((student, index) => {
    const row = document.createElement("tr");
    const [avatarBg, avatarInk] = avatarColors[index % avatarColors.length];
    const percentage = Number(student.marks);
    row.innerHTML = `
      <td><div class="student-cell">
        <span class="student-avatar" style="--avatar-bg:${avatarBg};--avatar-ink:${avatarInk}">${escapeHtml(initials(student.name))}</span>
        <span><span class="student-name">${escapeHtml(student.name)}</span><br><span class="student-class">Student record</span></span>
      </div></td>
      <td><span class="roll-chip">${escapeHtml(student.roll_no)}</span></td>
      <td>${escapeHtml(student.class_name)}</td>
      <td><div class="mark-cell"><span class="mark-track"><span class="mark-fill" style="width:${percentage}%"></span></span><span class="mark-number">${formatMarks(percentage)}%</span></div></td>
      <td>${escapeHtml(student.contact)}</td>
      <td><div class="row-actions">
        <button class="row-action" type="button" data-action="edit" data-id="${student.id}" aria-label="Edit ${escapeHtml(student.name)}">Edit</button>
        <button class="row-action delete" type="button" data-action="delete" data-id="${student.id}" aria-label="Delete ${escapeHtml(student.name)}">Delete</button>
      </div></td>`;
    rowsElement.append(row);
  });

  const empty = records.length === 0;
  document.querySelector("#empty-state").hidden = !empty;
  const hasFilters = searchInput.value.trim() || classFilter.value;
  document.querySelector("#empty-copy").textContent = hasFilters
    ? "Try a different name, roll number or class."
    : "Add a student and their details will appear here.";
  document.querySelector("#result-count").textContent = hasFilters
    ? `${records.length} matching ${records.length === 1 ? "record" : "records"}`
    : `${records.length} ${records.length === 1 ? "record" : "records"}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatMarks(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function renderSummary(records) {
  document.querySelector("#nav-count").textContent = records.length;
  document.querySelector("#total-students").textContent = records.length;
  if (!records.length) {
    document.querySelector("#average-marks").innerHTML = "—<small>%</small>";
    document.querySelector("#top-score").innerHTML = "—<small>%</small>";
    document.querySelector("#top-student").textContent = "no marks recorded";
    return;
  }
  const average = records.reduce((total, student) => total + Number(student.marks), 0) / records.length;
  const topStudent = records.reduce((top, student) => Number(student.marks) > Number(top.marks) ? student : top);
  document.querySelector("#average-marks").innerHTML = `${formatMarks(average)}<small>%</small>`;
  document.querySelector("#top-score").innerHTML = `${formatMarks(Number(topStudent.marks))}<small>%</small>`;
  document.querySelector("#top-student").textContent = topStudent.name;
}

function refreshClassOptions() {
  const selectedClass = classFilter.value;
  const classes = [...new Set(students.map((student) => student.class_name))]
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true, sensitivity: "base" }));
  classFilter.replaceChildren(new Option("All classes", ""));
  classes.forEach((className) => classFilter.add(new Option(className, className)));
  classFilter.value = classes.includes(selectedClass) ? selectedClass : "";
}

function getVisibleStudents() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const selectedClass = classFilter.value;
  const [sortField, sortDirection] = sortOrder.value.split("-");
  const direction = sortDirection === "desc" ? -1 : 1;

  return students
    .filter((student) => {
      const matchesSearch = !query || [student.name, student.roll_no, student.class_name]
        .some((value) => String(value).toLocaleLowerCase().includes(query));
      return matchesSearch && (!selectedClass || student.class_name === selectedClass);
    })
    .sort((first, second) => {
      if (sortField === "marks") return (Number(first.marks) - Number(second.marks)) * direction;
      return first.name.localeCompare(second.name, undefined, { sensitivity: "base" }) * direction;
    });
}

function renderCurrentList() {
  renderRows(getVisibleStudents());
}

async function loadStudents() {
  try {
    students = await requestJson("/api/students");
    renderSummary(students);
    refreshClassOptions();
    renderCurrentList();
    document.querySelector("#footer-status").textContent = "Connected to local records";
  } catch (error) {
    rowsElement.replaceChildren();
    document.querySelector("#empty-state").hidden = false;
    document.querySelector("#empty-copy").textContent = error.message;
    document.querySelector("#result-count").textContent = "Unable to load records";
    document.querySelector("#footer-status").textContent = "Connection issue";
  }
}

function openForm(student = null) {
  editingId = student?.id ?? null;
  form.reset();
  errorElement.hidden = true;
  errorElement.textContent = "";
  document.querySelector("#dialog-title").textContent = student ? "Edit student details" : "Add to the register";
  document.querySelector("#dialog-eyebrow").textContent = student ? "UPDATE STUDENT" : "NEW STUDENT";
  document.querySelector("#save-student").textContent = student ? "Save changes" : "Save student";
  if (student) {
    for (const [field, value] of Object.entries(student)) {
      if (form.elements[field]) form.elements[field].value = value;
    }
  }
  dialog.showModal();
  form.elements.name.focus();
}

document.querySelector("#add-student").addEventListener("click", () => openForm());
document.querySelector("#empty-add").addEventListener("click", () => openForm());
document.querySelectorAll(".close-dialog").forEach((button) => {
  button.addEventListener("click", () => dialog.close());
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorElement.hidden = true;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.name = payload.name.trim();
  payload.roll_no = payload.roll_no.trim();
  payload.class_name = payload.class_name.trim();
  payload.contact = payload.contact.trim();
  payload.marks = Number(payload.marks);
  const contactDigits = [...payload.contact].filter((character) => /\d/.test(character)).length;
  const duplicateRoll = students.some((student) =>
    student.roll_no.toLowerCase() === payload.roll_no.toLowerCase() && student.id !== editingId
  );
  let validationMessage = "";
  if (![payload.name, payload.roll_no, payload.class_name, payload.contact].every(Boolean)) {
    validationMessage = "Complete all student details before saving.";
  } else if (!Number.isFinite(payload.marks) || payload.marks < 0 || payload.marks > 100) {
    validationMessage = "Marks must be between 0 and 100.";
  } else if (!/^\+?\d[\d\s().-]*$/.test(payload.contact) || contactDigits < 7 || contactDigits > 15) {
    validationMessage = "Enter a valid contact number with 7 to 15 digits.";
  } else if (duplicateRoll) {
    validationMessage = "That roll number is already registered.";
  }
  if (validationMessage) {
    errorElement.textContent = validationMessage;
    errorElement.hidden = false;
    return;
  }
  const saveButton = document.querySelector("#save-student");
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  try {
    await requestJson(editingId ? `/api/students/${editingId}` : "/api/students", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    dialog.close();
    searchInput.value = "";
    await loadStudents();
    showToast(editingId ? "Student record updated." : "Student added to the register.");
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId ? "Save changes" : "Save student";
  }
});

rowsElement.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const student = students.find((record) => record.id === Number(button.dataset.id));
  if (button.dataset.action === "edit" && student) {
    openForm(student);
    return;
  }
  if (button.dataset.action === "delete" && student) {
    if (!window.confirm(`Delete ${student.name}'s student record? This cannot be undone.`)) return;
    try {
      await requestJson(`/api/students/${student.id}`, { method: "DELETE" });
      await loadStudents();
      showToast("Student record deleted.");
    } catch (error) {
      showToast(error.message);
    }
  }
});

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(renderCurrentList, 120);
});

classFilter.addEventListener("change", renderCurrentList);
sortOrder.addEventListener("change", renderCurrentList);

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && dialog.open) dialog.close();
});

document.querySelector("#today").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric", year: "numeric",
}).format(new Date());

loadStudents();