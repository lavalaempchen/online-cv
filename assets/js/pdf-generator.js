function print() {
  const printWindow = window.open("/cv/print", "_blank");
  printWindow.onload = function () {
    printWindow.print();
    // Close the print window after a delay
    setTimeout(() => printWindow.close(), 500);
  };
}

const PDF_AVOID_SELECTORS = [
  ".pdf-keep-together",
  ".profile-container",
  ".contact-container",
  ".education-container .item",
  ".languages-container",
  ".interests-container",
  ".experiences-section .item",
  ".projects-section .item",
  ".publications-section .item",
  ".skillset .item",
  ".summary",
  ".intro",
  ".meta",
  ".upper-row",
  "h1", "h2", "h3", "h4", "h5",
  "p",
  "li",
];

const PDF_EXTRA_CSS = `
  ${PDF_AVOID_SELECTORS.join(",\n  ")} {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .section-title, .container-block-title {
    page-break-after: avoid;
    break-after: avoid;
  }
`;

function waitForResources(root) {
  const onLoad = (el) =>
    new Promise((resolve) => {
      el.addEventListener("load", resolve, { once: true });
      el.addEventListener("error", resolve, { once: true });
    });

  const promises = [];

  root.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    if (!link.sheet) promises.push(onLoad(link));
  });

  root.querySelectorAll("img").forEach((img) => {
    if (!img.complete) promises.push(onLoad(img));
  });

  if (document.fonts && document.fonts.ready) {
    promises.push(document.fonts.ready);
  }

  return Promise.all(promises);
}

function keepHeadingsWithContent(root) {
  root.querySelectorAll(".section-title").forEach((title) => {
    const group = document.createElement("div");
    group.className = "pdf-keep-together";
    title.parentNode.insertBefore(group, title);
    group.appendChild(title);

    let next = group.nextElementSibling;
    while (next) {
      const el = next;
      next = next.nextElementSibling;

      if (el.classList.contains("intro") || el.classList.contains("summary")) {
        group.appendChild(el);
        continue;
      }
      if (el.classList.contains("item")) {
        group.appendChild(el);
      }
      break;
    }
  });
}

function generatePDF() {
  // Get the print layout URL
  const printURL = new URL("print", window.location.href).href;

  fetch(printURL)
    .then((response) => response.text())
    .then(async (html) => {
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-10000px";
      wrapper.style.top = "0";
      wrapper.style.width = "794px"; // ≈ A4-Breite bei 96 dpi

      const container = document.createElement("div");
      container.innerHTML = html;
      wrapper.appendChild(container);

      // Buttons etc. nicht mit ins PDF nehmen
      container.querySelectorAll(".d-print-none, script").forEach((el) => el.remove());

      // Zusätzliches CSS für Seitenumbrüche
      const style = document.createElement("style");
      style.textContent = PDF_EXTRA_CSS;
      container.prepend(style);

      keepHeadingsWithContent(container);

      document.body.appendChild(wrapper);
      await waitForResources(container);

      // Get name from the DOM (as defined in data.yml)
      const name = document.querySelector(".name").textContent.trim();
      const filename = `${name.replace(/\s+/g, "_")}_Resume.pdf`;

      const opt = {
        margin: 10,
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        // Seitenumbrüche: CSS-Regeln beachten + gelistete Elemente nie teilen
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: PDF_AVOID_SELECTORS,
        },
      };

      try {
        await html2pdf().set(opt).from(container).save();
      } catch (err) {
        console.error("Error generating PDF:", err);
      } finally {
        wrapper.remove();
      }
    })
    .catch((err) => console.error("Error fetching print layout:", err));
}