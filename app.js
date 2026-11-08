let currentLang = "ar";
let selectedCourt = "padel1";
let pendingSlotHour = null;

const COURTS_INFO = {
  padel1: {
    ar: "ملعب بادل 1 — داخلي",
    en: "Padel Court 1 — Indoor",
    specAr: "أرضية Mondo معتمدة • إضاءة LED • صالة مغلقة مكيفة",
    specEn: "WPT Mondo Turf • LED Floodlights • Climate Controlled Indoor",
    price: 26,
  },
  padel2: {
    ar: "ملعب بادل 2 — بانوراما",
    en: "Padel Court 2 — Panoramic",
    specAr: "زجاج بانورامي 12 ملم • إضاءة مسائية مشمولة",
    specEn: "12mm Panoramic Glass • Night Floodlights Included",
    price: 30,
  },
  football5: {
    ar: "ملعب كرة قدم خماسي",
    en: "5-a-Side Football Pitch",
    specAr: "عشب صناعي معتمد (5 ضد 5) • غرف تبديل ملابس",
    specEn: "FIFA Quality Pro Turf (5v5) • Changing Rooms Included",
    price: 20,
  },
  football7: {
    ar: "ملعب كرة قدم سباعي",
    en: "7-a-Side Football Pitch",
    specAr: "عشب صناعي (7 ضد 7) • مدرج متفرجين • إضاءة كاملة",
    specEn: "Full 7v7 Arena Pitch • Spectator Seating • Floodlit",
    price: 35,
  },
};

const TIME_SLOTS = [
  "16:00 - 17:00",
  "17:00 - 18:00",
  "18:00 - 19:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
  "21:00 - 22:00",
  "22:00 - 23:00",
  "23:00 - 00:00",
  "00:00 - 01:00",
  "01:00 - 02:00",
];

let bookingsDB = [];

function initDemoData() {
  const todayStr = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("bookingDateInput");
  if (dateInput) {
    dateInput.value = todayStr;
  }

  bookingsDB = [
    {
      id: 8412,
      court: "padel1",
      date: todayStr,
      slot: "18:00 - 19:00",
      name: "عمر النسور",
      phone: "0798123456",
      notes: "حجز فردي — الدفع في الملعب",
    },
    {
      id: 8415,
      court: "padel1",
      date: todayStr,
      slot: "20:00 - 21:00",
      name: "طارق الزعبي",
      phone: "0795556677",
      notes: "تثبيت أسبوعي ثابت",
    },
    {
      id: 8419,
      court: "padel2",
      date: todayStr,
      slot: "21:00 - 22:00",
      name: "أحمد المجالي",
      phone: "0777889900",
      notes: "مطلوب 4 مضارب",
    },
    {
      id: 8421,
      court: "football5",
      date: todayStr,
      slot: "19:00 - 20:00",
      name: "أكاديمية الفرسان",
      phone: "0799112233",
      notes: "حصة تدريبية",
    },
  ];

  renderTimeSlots();
  renderAdminTable();
  updateROI();
}

function toggleLanguage() {
  currentLang = currentLang === "ar" ? "en" : "ar";
  const htmlRoot = document.getElementById("htmlRoot");
  const langBtn = document.getElementById("langToggle");

  if (currentLang === "en") {
    htmlRoot.setAttribute("lang", "en");
    htmlRoot.setAttribute("dir", "ltr");
    langBtn.textContent = "العربية";
  } else {
    htmlRoot.setAttribute("lang", "ar");
    htmlRoot.setAttribute("dir", "rtl");
    langBtn.textContent = "English";
  }

  document.querySelectorAll("[data-ar]").forEach((el) => {
    el.textContent = currentLang === "ar" ? el.getAttribute("data-ar") : el.getAttribute("data-en");
  });

  renderTimeSlots();
  renderAdminTable();
  updateROI();
}

function switchDemoMode(mode) {
  const playerView = document.getElementById("playerDemoView");
  const adminView = document.getElementById("adminDemoView");
  const tabPlayer = document.getElementById("tabPlayerBtn");
  const tabAdmin = document.getElementById("tabAdminBtn");

  if (mode === "player") {
    playerView.classList.remove("hidden");
    adminView.classList.add("hidden");
    tabPlayer.classList.add("active");
    tabAdmin.classList.remove("active");
    renderTimeSlots();
  } else {
    playerView.classList.add("hidden");
    adminView.classList.remove("hidden");
    tabPlayer.classList.remove("active");
    tabAdmin.classList.add("active");
    renderAdminTable();
  }
}

function selectCourt(courtKey) {
  selectedCourt = courtKey;
  document.querySelectorAll(".court-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-court") === courtKey);
  });
  renderTimeSlots();
}

function renderTimeSlots() {
  const grid = document.getElementById("slotsGrid");
  const dateVal = document.getElementById("bookingDateInput").value;
  const specsNote = document.getElementById("activeCourtSpecs");
  if (!grid) return;

  grid.innerHTML = "";
  const courtMeta = COURTS_INFO[selectedCourt];
  if (specsNote) {
    specsNote.textContent = currentLang === "ar" ? courtMeta.specAr : courtMeta.specEn;
  }

  TIME_SLOTS.forEach((slot) => {
    const existing = bookingsDB.find(
      (b) => b.court === selectedCourt && b.date === dateVal && b.slot === slot
    );

    const cell = document.createElement("div");
    cell.className = `slot-cell ${existing ? "reserved" : "open"}`;

    if (existing) {
      cell.innerHTML = `
        <div>
          <div class="slot-top">
            <span class="slot-clock mono-text">${slot}</span>
            <span class="slot-rate mono-text">#BK-${existing.id}</span>
          </div>
          <div class="slot-holder">${
            currentLang === "ar" ? `محجوز: ${existing.name}` : `Reserved: ${existing.name}`
          }</div>
        </div>
        <div class="slot-footer">
          <span>${currentLang === "ar" ? "محجوز / غير متاح" : "Reserved Slot"}</span>
          <span class="mono-text">LOCKED</span>
        </div>
      `;
    } else {
      cell.onclick = () => openBookingModal(slot);
      cell.innerHTML = `
        <div>
          <div class="slot-top">
            <span class="slot-clock mono-text">${slot}</span>
            <span class="slot-rate mono-text">${courtMeta.price} JOD</span>
          </div>
          <div class="slot-holder">${
            currentLang === "ar" ? "متاح للحجز الفوري (60 دقيقة)" : "Available (60 min session)"
          }</div>
        </div>
        <div class="slot-footer">
          <span>${currentLang === "ar" ? "احجز هذا الموعد" : "Reserve Slot"}</span>
          <span class="mono-text">→</span>
        </div>
      `;
    }

    grid.appendChild(cell);
  });

  const badge = document.getElementById("adminBadgeCount");
  if (badge) badge.textContent = bookingsDB.length;
}

function openBookingModal(slot) {
  pendingSlotHour = slot;
  const dateVal = document.getElementById("bookingDateInput").value;
  const courtMeta = COURTS_INFO[selectedCourt];
  const summary = document.getElementById("modalSlotSummary");

  summary.textContent =
    currentLang === "ar"
      ? `${courtMeta.ar} | التاريخ: ${dateVal} | الوقت: ${slot} | الرسوم: ${courtMeta.price} د.أ`
      : `${courtMeta.en} | Date: ${dateVal} | Time: ${slot} | Rate: ${courtMeta.price} JOD`;

  document.getElementById("bookingModal").classList.remove("hidden");
}

function closeBookingModal() {
  document.getElementById("bookingModal").classList.add("hidden");
  pendingSlotHour = null;
}

function confirmDemoBooking(e) {
  e.preventDefault();
  const name = document.getElementById("playerNameInput").value.trim();
  const phone = document.getElementById("playerPhoneInput").value.trim();
  const notes = document.getElementById("playerNotesInput").value.trim();
  const dateVal = document.getElementById("bookingDateInput").value;

  if (!name || !phone || !pendingSlotHour) return;

  const refId = Math.floor(8500 + Math.random() * 1400);
  bookingsDB.unshift({
    id: refId,
    court: selectedCourt,
    date: dateVal,
    slot: pendingSlotHour,
    name,
    phone,
    notes: notes || (currentLang === "ar" ? "حجز إلكتروني مباشر" : "Direct Web Reservation"),
  });

  document.getElementById("playerNameInput").value = "";
  document.getElementById("playerPhoneInput").value = "";
  document.getElementById("playerNotesInput").value = "";

  closeBookingModal();
  renderTimeSlots();
  renderAdminTable();
}

function renderAdminTable() {
  const tbody = document.getElementById("adminBookingsTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  bookingsDB.forEach((b) => {
    const courtName = COURTS_INFO[b.court]
      ? currentLang === "ar"
        ? COURTS_INFO[b.court].ar
        : COURTS_INFO[b.court].en
      : b.court;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono-text">#BK-${b.id}</td>
      <td><strong>${courtName}</strong></td>
      <td class="mono-text">${b.date} • ${b.slot}</td>
      <td>${b.name}</td>
      <td class="mono-text" dir="ltr">${b.phone}</td>
      <td>${b.notes}</td>
      <td>
        <button class="action-btn-wa" onclick="sendOwnerWhatsAppConfirm('${b.phone}', '${b.name}', '${courtName}', '${b.date}', '${b.slot}', '${b.id}')">
          ${currentLang === "ar" ? "إرسال تأكيد WhatsApp" : "Send WhatsApp Confirm"}
        </button>
        <button class="action-btn-del" onclick="deleteDemoBooking(${b.id})">
          ${currentLang === "ar" ? "إلغاء الحجز" : "Release Slot"}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteDemoBooking(id) {
  bookingsDB = bookingsDB.filter((b) => b.id !== id);
  renderAdminTable();
  renderTimeSlots();
}

function sendOwnerWhatsAppConfirm(phone, name, court, date, slot, refId) {
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("07")) cleanPhone = "962" + cleanPhone.slice(1);
  const msg = `تأكيد حجز ملعب (مرجع #BK-${refId})\nالاسم: ${name}\nالملعب: ${court}\nالتاريخ: ${date}\nالوقت: ${slot}`;
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
}

function updateROI() {
  const rateSlider = document.getElementById("hourlyRateSlider");
  const extraSlider = document.getElementById("extraHoursSlider");
  if (!rateSlider || !extraSlider) return;

  const rate = parseInt(rateSlider.value, 10) || 25;
  const extraHours = parseInt(extraSlider.value, 10) || 5;

  document.getElementById("rateValDisplay").textContent = `${rate} JOD`;
  document.getElementById("extraHoursDisplay").textContent =
    currentLang === "ar" ? `${extraHours} ساعات / أسبوع` : `${extraHours} hrs / week`;

  const bookingsNeeded = Math.ceil(500 / rate);
  const monthlyExtra = rate * extraHours * 4;
  const yearlyExtra = monthlyExtra * 12;

  document.getElementById("bookingsToBreakEven").textContent =
    currentLang === "ar" ? `${bookingsNeeded} ساعة فقط` : `${bookingsNeeded} Bookings`;
  document.getElementById("monthlyExtraRev").textContent =
    currentLang === "ar" ? `+${monthlyExtra} JOD / شهر` : `+${monthlyExtra} JOD / mo`;
  document.getElementById("yearlyExtraRev").textContent =
    currentLang === "ar"
      ? `+${yearlyExtra.toLocaleString()} JOD / سنة`
      : `+${yearlyExtra.toLocaleString()} JOD / yr`;
}

function sendLeadToWhatsApp(e) {
  e.preventDefault();
  const club = document.getElementById("clubNameLead").value.trim();
  const city = document.getElementById("clubCityLead").value.trim();
  const courts = document.getElementById("clubCourtsLead").value.trim();
  const phone = document.getElementById("clubPhoneLead").value.trim();

  const text = `طلب تجهيز نظام حجز ملاعب (3MK F X G — باقة 500 د.أ)\nالمنشأة: ${club}\nالمنطقة: ${city}\nالملاعب: ${courts}\nرقم التواصل: ${phone}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

window.addEventListener("DOMContentLoaded", initDemoData);
