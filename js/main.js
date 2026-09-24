// SauFox Entertainment — site scripts

// Section 1 — Header: split call-to-action text into letters so each one
// can run the orange -> white wave with its own delay.
(function animateLetters() {
  document.querySelectorAll("[data-animate-letters]").forEach((el) => {
    const text = el.textContent.trim();
    const chars = Array.from(text);
    // Short words get a slower, clearly readable wave; long ones stay ~1.4s.
    const step = Math.min(140, 1400 / chars.length);

    // Letters live in an inline wrapper: as direct children of the flex
    // button, space-only spans would collapse to nothing.
    const line = document.createElement("span");
    line.setAttribute("aria-hidden", "true");

    el.setAttribute("aria-label", text);
    el.textContent = "";
    el.append(line);
    chars.forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "cta__char";
      span.textContent = ch;
      span.style.animationDelay = `${Math.round(i * step)}ms`;
      line.append(span);
    });
  });
})();

// Section 1 — Header: profile chip (signed-in users only).
// Desktop expands it on hover (CSS). On touch screens the first tap expands
// it, a second tap follows the link, and tapping elsewhere collapses it.
(function profileChip() {
  const chip = document.querySelector(".profile-chip");
  if (!chip) return;

  const canHover = window.matchMedia("(hover: hover)").matches;

  chip.addEventListener("click", (event) => {
    if (canHover) return;
    if (!chip.classList.contains("is-open")) {
      event.preventDefault();
      chip.classList.add("is-open");
    }
  });

  document.addEventListener("click", (event) => {
    if (!chip.contains(event.target)) chip.classList.remove("is-open");
  });
})();
