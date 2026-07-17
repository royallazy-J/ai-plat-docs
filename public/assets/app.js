const panels = Array.from(document.querySelectorAll("[data-doc]"));
const navDocTabs = Array.from(document.querySelectorAll(".sidebar .doc-tab[data-doc-target]"));
const navChapterLinks = Array.from(document.querySelectorAll(".sidebar .part-chapter-link[data-doc-target]"));
const navSectionLinks = Array.from(document.querySelectorAll(".sidebar .toc-link[data-section-target]"));
const docLinks = Array.from(document.querySelectorAll("[data-doc-target]"));
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const lightbox = document.getElementById("lightbox");
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const sidebarClose = document.getElementById("sidebarClose");
const sidebarScrim = document.getElementById("sidebarScrim");
const readingProgress = document.getElementById("readingProgress");
let searchIndex = [];
let activeSidebarTarget = "";

function showDoc(slug, shouldFocus = false) {
  const target = panels.find((panel) => panel.dataset.doc === slug) || panels[0];
  panels.forEach((panel) => panel.classList.toggle("active", panel === target));
  navDocTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.docTarget === target.dataset.doc));
  navChapterLinks.forEach((link) => link.classList.toggle("active", link.dataset.docTarget === target.dataset.doc));
  syncSidebarSection();
  closeSidebar();
  if (shouldFocus) target.focus({ preventScroll: true });
}

function syncSidebarSection() {
  const activePanel = panels.find((panel) => panel.classList.contains("active"));
  if (!activePanel) return;

  const hash = decodeURIComponent(location.hash.replace("#", ""));
  const hashHeading = document.getElementById(hash);
  const headings = Array.from(activePanel.querySelectorAll("h2[id], h3[id], h4[id]"));
  const currentHeading = hashHeading?.closest("[data-doc]") === activePanel && hashHeading.matches("h2, h3, h4")
    ? hashHeading
    : headings.filter((heading) => heading.getBoundingClientRect().top <= 132).at(-1);

  navSectionLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.sectionTarget === currentHeading?.id);
  });

  const activeLink = currentHeading
    ? navSectionLinks.find((link) => link.dataset.sectionTarget === currentHeading.id)
    : navChapterLinks.find((link) => link.classList.contains("active"));
  const targetId = activeLink?.dataset.sectionTarget || activeLink?.dataset.docTarget || "";
  if (activeLink && targetId !== activeSidebarTarget) {
    activeSidebarTarget = targetId;
    activeLink.scrollIntoView({ block: "nearest" });
  }
}

function currentHashDoc() {
  const hash = decodeURIComponent(location.hash.replace("#", ""));
  if (!hash) return panels[0]?.dataset.doc;
  const exactDoc = panels.find((panel) => panel.dataset.doc === hash);
  if (exactDoc) return exactDoc.dataset.doc;
  const section = document.getElementById(hash);
  return section?.closest("[data-doc]")?.dataset.doc || panels[0]?.dataset.doc;
}

window.addEventListener("hashchange", () => showDoc(currentHashDoc()));
showDoc(currentHashDoc());

docLinks.forEach((tab) => {
  tab.addEventListener("click", () => {
    const slug = tab.dataset.docTarget;
    showDoc(slug, true);
  });
});

function setSidebar(open) {
  sidebar?.classList.toggle("open", open);
  sidebarScrim?.classList.toggle("open", open);
  menuButton?.setAttribute("aria-expanded", String(open));
}
function closeSidebar() { setSidebar(false); }
menuButton?.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
sidebarClose?.addEventListener("click", closeSidebar);
sidebarScrim?.addEventListener("click", closeSidebar);

fetch("search-index.json")
  .then((response) => response.json())
  .then((data) => {
    searchIndex = data;
  })
  .catch(() => {
    searchIndex = [];
  });

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  const terms = query.split(/\s+/).filter(Boolean);
  const matches = searchIndex
    .map((doc) => {
      const haystack = [doc.title, doc.subtitle, doc.summary, doc.text].join(" ").toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  searchResults.hidden = false;
  searchResults.innerHTML = matches.length
    ? "<strong>搜索结果</strong>" + matches.map(({ doc }) => `<a class="result-item" href="#${doc.slug}" data-doc-target="${doc.slug}"><strong>${escapeHtml(doc.subtitle || doc.title)}</strong><span>${highlight(doc.summary, terms)}</span></a>`).join("")
    : "<strong>未找到匹配结果</strong><p>可以尝试输入功能名称、页面入口或操作关键词。</p>";
});

document.addEventListener("click", (event) => {
  const imageButton = event.target.closest(".image-button");
  if (imageButton) {
    lightbox.hidden = false;
    lightbox.querySelector("img").src = imageButton.dataset.image;
    lightbox.querySelector("img").alt = imageButton.dataset.alt || "";
    lightbox.querySelector("p").textContent = imageButton.dataset.alt || "";
  }

  if (event.target.closest(".lightbox-close") || event.target === lightbox) {
    lightbox.hidden = true;
    lightbox.querySelector("img").src = "";
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput?.focus();
  }
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
    event.preventDefault();
    searchInput?.focus();
  }
  if (event.key === "Escape" && !lightbox.hidden) {
    lightbox.hidden = true;
    lightbox.querySelector("img").src = "";
  }
});

window.addEventListener("scroll", () => {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  if (readingProgress) readingProgress.style.width = height > 0 ? `${Math.min(100, window.scrollY / height * 100)}%` : "0";
  syncSidebarSection();
}, { passive: true });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function highlight(text, terms) {
  let safe = escapeHtml(text);
  terms.forEach((term) => {
    const escaped = escapeRegex(term);
    safe = safe.replace(new RegExp(escaped, "gi"), (match) => `<mark>${match}</mark>`);
  });
  return safe;
}

function escapeRegex(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}