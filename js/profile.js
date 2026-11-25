// Profile page: the side menu jumps to a section and highlights the one being read.
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let links = [];
let sections = [];

const mark = (id) => links.forEach((a) => a.toggleAttribute("aria-current", a.dataset.section === id));

function update() {
  const view = document.getElementById("view-profile");
  if (!view || !view.classList.contains("active")) return;
  // at the very bottom, the last section is the one being read
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
    mark(sections[sections.length - 1].id);
    return;
  }
  // otherwise, the last section whose top has passed the upper third of the screen
  const line = window.innerHeight * 0.3;
  let current = sections[0];
  for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
  mark(current.id);
}

export function initProfile(root) {
  links = [...root.querySelectorAll(".profile-nav a")];
  sections = links.map((a) => root.querySelector(`#${a.dataset.section}`)).filter(Boolean);
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    },
    { passive: true },
  );
  update();
}

/** Scroll to a profile section, e.g. from #profile/why-defence. */
export function showProfileSection(id) {
  const target = document.getElementById(id);
  if (!target || !target.closest("#view-profile")) return;
  target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  mark(id);
}
