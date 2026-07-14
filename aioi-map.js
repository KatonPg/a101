const galleryFrames = [
  { position: "50% 50%", scale: 1 },
  { position: "50% 50%", scale: 1 },
  { position: "50% 50%", scale: 1 },
  { position: "50% 50%", scale: 1 },
];
const cardGalleryControllers = new WeakMap();
let pendingGalleryReset = null;
let activeCardGallery = null;

const clearPendingGalleryReset = () => {
  pendingGalleryReset = null;
};

const deferGalleryReset = (photo) => {
  const controller = cardGalleryControllers.get(photo);
  if (!photo || !controller) return;
  clearPendingGalleryReset();
  if (!photo.matches(":hover")) {
    controller.showFrame(0);
    return;
  }
  pendingGalleryReset = { photo, controller };
};

const getGalleryIndex = (clientX, bounds) => {
  const relativeX = Math.max(0, Math.min(bounds.width - 1, clientX - bounds.left));
  return Math.floor(relativeX / (bounds.width / galleryFrames.length));
};

document.querySelectorAll(".photo").forEach((photo) => {
  const backgroundImage = getComputedStyle(photo).backgroundImage;
  if (!backgroundImage || backgroundImage === "none") return;
  const suppliedImageSources = (photo.dataset.gallery || "")
    .split("|")
    .map((source) => source.trim())
    .filter(Boolean);
  const preloadedImages = suppliedImageSources.map((source) => {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    return image;
  });
  const suppliedImages = suppliedImageSources.map((source) => `url("${source}")`);

  const frame = document.createElement("div");
  frame.className = "gallery-frame";
  frame.style.backgroundImage = backgroundImage;
  photo.prepend(frame);
  photo.style.backgroundImage = "none";

  const pagination = document.createElement("div");
  pagination.className = "dot-icon gallery-pagination";
  pagination.setAttribute("aria-hidden", "true");

  galleryFrames.forEach((_, index) => {
    const dot = document.createElement("i");
    dot.classList.toggle("active", index === 0);
    pagination.append(dot);
  });
  photo.append(pagination);

  let activeIndex = 0;
  let photoBounds = null;
  let pendingIndex = null;
  let galleryFrameRequest = 0;

  const showFrame = (index) => {
    if (index === activeIndex) return;
    activeIndex = index;
    const frameSource = suppliedImages[index] || backgroundImage;
    frame.style.backgroundImage = frameSource;
    frame.style.backgroundPosition = "50% 50%";
    frame.style.transform = "none";
    frame.style.transformOrigin = "center";
    pagination.querySelectorAll("i").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
    });
  };

  const cancelPendingFrame = () => {
    if (galleryFrameRequest) cancelAnimationFrame(galleryFrameRequest);
    galleryFrameRequest = 0;
    pendingIndex = null;
  };

  const resetGallery = () => {
    cancelPendingFrame();
    photoBounds = null;
    showFrame(0);
  };

  const queueFrameAtPointer = (clientX) => {
    photoBounds ||= photo.getBoundingClientRect();
    pendingIndex = getGalleryIndex(clientX, photoBounds);
    if (galleryFrameRequest) return;
    galleryFrameRequest = requestAnimationFrame(() => {
      galleryFrameRequest = 0;
      const nextIndex = pendingIndex;
      pendingIndex = null;
      if (nextIndex !== null) showFrame(nextIndex);
    });
  };

  const controller = { photo, showFrame, resetGallery, preloadedImages };
  cardGalleryControllers.set(photo, controller);

  const activateGallery = () => {
    if (activeCardGallery && activeCardGallery !== controller) {
      activeCardGallery.resetGallery();
    }
    activeCardGallery = controller;
  };

  photo.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    activateGallery();
    photoBounds = photo.getBoundingClientRect();
    queueFrameAtPointer(event.clientX);
  });

  photo.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    activateGallery();
    queueFrameAtPointer(event.clientX);
  });

  const leaveGallery = () => {
    resetGallery();
    if (pendingGalleryReset?.photo === photo) clearPendingGalleryReset();
    if (activeCardGallery === controller) activeCardGallery = null;
  };

  photo.addEventListener("pointerleave", leaveGallery);
  photo.addEventListener("pointercancel", leaveGallery);
});

window.addEventListener("blur", () => {
  activeCardGallery?.resetGallery();
  activeCardGallery = null;
  pendingGalleryReset?.controller.showFrame(0);
  clearPendingGalleryReset();
});

const projectPinMap = {
  "Дом на Джалиля": ".marker-jalil",
  "Родные кварталы": ".marker-rodnye",
  "Деснаречье": ".marker-desna",
  "Бунинские кварталы": ".marker-bun",
  "Прокшино": ".cluster-two",
  "Испанские кварталы": ".cluster-two",
  "Скандинавия": ".cluster-four",
  "Хольм": ".cluster-four",
  "Южные сады": ".cluster-four",
  "Дзен-кварталы": ".cluster-four",
};

const mapPins = [...document.querySelectorAll(".marker, .cluster")];

const resetPinHighlight = () => {
  mapPins.forEach((pin) => pin.classList.remove("pin-dimmed"));
};

document.querySelectorAll(".card").forEach((card) => {
  const titleNode = card.querySelector("h3")?.childNodes[0];
  const projectName = titleNode?.textContent.replace(/[«»]/g, "").trim();
  const targetSelector = projectPinMap[projectName];

  if (!targetSelector) return;

  const targetPin = document.querySelector(targetSelector);
  if (!targetPin) return;
  card.dataset.pinTarget = targetSelector.slice(1);

  const activatePinHighlight = () => {
    if (card.dataset.pinHighlightActive === "true") return;
    card.dataset.pinHighlightActive = "true";
    mapPins.forEach((pin) => {
      pin.classList.toggle("pin-dimmed", pin !== targetPin);
    });
  };

  card.addEventListener("pointerenter", activatePinHighlight);
  card.addEventListener("pointermove", activatePinHighlight);
  card.addEventListener("pointerleave", () => {
    delete card.dataset.pinHighlightActive;
    resetPinHighlight();
  });
});

document.addEventListener("pointermove", (event) => {
  if (pendingGalleryReset) {
    const { photo, controller } = pendingGalleryReset;
    const bounds = photo.getBoundingClientRect();
    const isOutside = event.clientX < bounds.left
      || event.clientX >= bounds.right
      || event.clientY < bounds.top
      || event.clientY >= bounds.bottom;
    if (isOutside) {
      controller.showFrame(0);
      clearPendingGalleryReset();
    }
  }

  if (activeCardGallery && event.target.closest(".photo") !== activeCardGallery.photo) {
    activeCardGallery.resetGallery();
    activeCardGallery = null;
  }

  if (event.target.closest(".card[data-pin-target]")) return;
  document.querySelectorAll(".card[data-pin-highlight-active]").forEach((card) => {
    delete card.dataset.pinHighlightActive;
  });
  resetPinHighlight();
}, { passive: true });

const expandButton = document.querySelector(".expand");
const mapArea = document.querySelector(".map-area");
const expandTooltipText = expandButton?.querySelector(".expand-tooltip > span");

expandButton?.addEventListener("click", () => {
  const cardsAreHidden = mapArea.classList.toggle("cards-hidden");
  const actionLabel = cardsAreHidden
    ? "Показать карточки проектов"
    : "Скрыть карточки проектов";

  expandButton.setAttribute("aria-expanded", String(!cardsAreHidden));
  expandButton.setAttribute("aria-label", actionLabel);
  expandTooltipText.textContent = actionLabel;
  resetPinHighlight();
});

const detailPanel = document.querySelector(".project-detail");
const detailPhoto = detailPanel?.querySelector(".project-detail-photo");
const detailFrame = detailPanel?.querySelector(".project-detail-frame");
const detailFrames = [...(detailPanel?.querySelectorAll(".project-detail-frame") || [])];
const detailTags = detailPanel?.querySelector(".project-detail-tags");
const detailPagination = detailPanel?.querySelector(".project-detail-pagination");
const detailTitle = detailPanel?.querySelector("#project-detail-title");
const detailMetroIcon = detailPanel?.querySelector(".project-detail-metro-icon");
const detailMetro = detailPanel?.querySelector(".project-detail-metro");
const detailTime = detailPanel?.querySelector(".project-detail-time");
const detailOffers = detailPanel?.querySelector(".project-detail-offers");
const detailApartments = detailPanel?.querySelector(".project-detail-apartments");
const detailClose = detailPanel?.querySelector(".project-detail-close");
const detailGalleryPrev = detailPanel?.querySelector(".project-detail-gallery-prev");
const detailGalleryNext = detailPanel?.querySelector(".project-detail-gallery-next");

const sharedProjectOffers = [
  ["Студия от 36 м²", "от 16,2 млн ₽"],
  ["1-комнатные от 39 м²", "от 19,6 млн ₽"],
  ["2-комнатные от 63 м²", "от 27,2 млн ₽"],
  ["3-комнатные от 58 м²", "от 27,1 млн ₽"],
  ["4 и более комнат от 94 м²", "от 42,1 млн ₽"],
];

const projectDetailData = {
  "Хольм": {
    tags: ["Старт продаж", "1 кв. 2029", "Новый проект"],
    apartmentsLabel: "Смотреть 178 квартир",
    offers: sharedProjectOffers,
  },
};

const extractProjectName = (card) => {
  const titleNode = card?.querySelector("h3")?.childNodes[0];
  return titleNode?.textContent.replace(/[«»]/g, "").trim() || "";
};

let activeDetailSource = null;
let activeDetailOrigin = null;
let detailGallerySources = [];
let detailGalleryIndex = 0;
let detailActiveFrameIndex = 0;
let detailTransitionTimer = 0;
let detailCloneTimer = 0;
let detailClonePhaseTimer = 0;
let detailSourceClone = null;
let detailSwitchTimer = 0;
let pendingDetailCard = null;
let pendingDetailSource = null;
let detailSwitchSequence = 0;

const setDetailOrigin = (source) => {
  if (!detailPanel || !mapArea || !source) return;
  const mapBounds = mapArea.getBoundingClientRect();
  const sourceBounds = source.getBoundingClientRect();
  const sourcePhotoBounds = source.querySelector(".photo")?.getBoundingClientRect();
  const detailPhotoMetrics = sourcePhotoBounds && detailPhoto
    ? {
      width: detailPhoto.offsetWidth,
      height: detailPhoto.offsetHeight,
      left: detailPhoto.offsetLeft,
      top: detailPhoto.offsetTop,
    }
    : null;
  const panelScaleX = sourceBounds.width / 540;
  const panelScaleY = sourceBounds.height / 812;
  const offsetX = sourceBounds.left - mapBounds.left - 16;
  const offsetY = sourceBounds.top - mapBounds.top - 16;
  detailPanel.style.setProperty("--detail-origin-x", `${offsetX}px`);
  detailPanel.style.setProperty("--detail-origin-y", `${offsetY}px`);
  detailPanel.style.setProperty("--detail-origin-scale-x", String(panelScaleX));
  detailPanel.style.setProperty("--detail-origin-scale-y", String(panelScaleY));
  detailPanel.style.setProperty("--detail-origin-radius-x", `${24 / panelScaleX}px`);
  detailPanel.style.setProperty("--detail-origin-radius-y", `${24 / panelScaleY}px`);
  if (sourcePhotoBounds && detailPhoto && detailPhotoMetrics) {
    const photoScaleX = sourcePhotoBounds.width / (detailPhotoMetrics.width * panelScaleX);
    const photoScaleY = sourcePhotoBounds.height / (detailPhotoMetrics.height * panelScaleY);
    const photoOffsetX = (sourcePhotoBounds.left - sourceBounds.left) / panelScaleX
      - detailPhotoMetrics.left;
    const photoOffsetY = (sourcePhotoBounds.top - sourceBounds.top) / panelScaleY
      - detailPhotoMetrics.top;
    detailPhoto.style.setProperty("--detail-photo-origin-x", `${photoOffsetX}px`);
    detailPhoto.style.setProperty("--detail-photo-origin-y", `${photoOffsetY}px`);
    detailPhoto.style.setProperty("--detail-photo-origin-scale-x", String(photoScaleX));
    detailPhoto.style.setProperty("--detail-photo-origin-scale-y", String(photoScaleY));
    detailPhoto.style.setProperty(
      "--detail-photo-origin-radius-x",
      `${16 / (panelScaleX * photoScaleX)}px`,
    );
    detailPhoto.style.setProperty(
      "--detail-photo-origin-radius-y",
      `${16 / (panelScaleY * photoScaleY)}px`,
    );
  }
  activeDetailOrigin = {
    left: sourceBounds.left - mapBounds.left,
    top: sourceBounds.top - mapBounds.top,
    width: sourceBounds.width,
    height: sourceBounds.height,
  };
};

const clearDetailSourceClone = () => {
  window.clearTimeout(detailCloneTimer);
  window.clearTimeout(detailClonePhaseTimer);
  detailCloneTimer = 0;
  detailClonePhaseTimer = 0;
  detailSourceClone?.remove();
  detailSourceClone = null;
};

const createDetailSourceClone = (source, hidden = false) => {
  if (!mapArea || !source || !activeDetailOrigin) return null;
  clearDetailSourceClone();
  const clone = source.cloneNode(true);
  clone.classList.add("detail-source-clone");
  clone.classList.toggle("is-hidden", hidden);
  clone.removeAttribute("id");
  clone.removeAttribute("role");
  clone.removeAttribute("tabindex");
  clone.removeAttribute("aria-label");
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  Object.assign(clone.style, {
    left: `${activeDetailOrigin.left}px`,
    top: `${activeDetailOrigin.top}px`,
    width: `${activeDetailOrigin.width}px`,
    height: `${activeDetailOrigin.height}px`,
  });
  mapArea.append(clone);
  detailSourceClone = clone;
  return clone;
};

const isCardVisible = (card) => {
  const cards = document.querySelector(".cards");
  if (!card || !cards || mapArea.classList.contains("cards-hidden")) return false;
  const cardsStyle = getComputedStyle(cards);
  if (cardsStyle.visibility === "hidden" || Number(cardsStyle.opacity) === 0) return false;
  const cardBounds = card.getBoundingClientRect();
  const cardsBounds = cards.getBoundingClientRect();
  const visibleWidth = Math.min(cardBounds.right, cardsBounds.right)
    - Math.max(cardBounds.left, cardsBounds.left);
  const visibleHeight = Math.min(cardBounds.bottom, cardsBounds.bottom)
    - Math.max(cardBounds.top, cardsBounds.top);
  return visibleWidth > 0 && visibleHeight > 0;
};

const showDetailGalleryFrame = (index, animate = false) => {
  if (!detailFrame || !detailPagination || !detailGallerySources.length) return;
  detailGalleryIndex = Math.max(0, Math.min(index, detailGallerySources.length - 1));
  const source = detailGallerySources[detailGalleryIndex];
  if (animate && detailFrames.length > 1) {
    const previousFrame = detailFrames[detailActiveFrameIndex];
    const nextFrameIndex = detailActiveFrameIndex === 0 ? 1 : 0;
    const nextFrame = detailFrames[nextFrameIndex];
    nextFrame.style.backgroundImage = `url("${source}")`;
    nextFrame.style.backgroundPosition = "50% 50%";
    nextFrame.style.transform = "none";
    nextFrame.classList.add("is-visible");
    previousFrame.classList.remove("is-visible");
    detailActiveFrameIndex = nextFrameIndex;
  } else {
    detailFrames.forEach((frame, frameIndex) => {
      frame.classList.toggle("is-visible", frameIndex === 0);
    });
    detailFrame.style.backgroundImage = `url("${source}")`;
    detailFrame.style.backgroundPosition = "50% 50%";
    detailFrame.style.transform = "none";
    detailActiveFrameIndex = 0;
  }
  detailPagination.querySelectorAll("i").forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === detailGalleryIndex);
  });
};

const populateProjectDetail = (card) => {
  if (!detailPanel || !card) return;
  const projectName = extractProjectName(card);
  const customData = projectDetailData[projectName] || {};
  const photo = card.querySelector(".photo");
  const cardTag = photo?.querySelector(":scope > span")?.textContent.trim();
  const tags = customData.tags || (cardTag ? [cardTag] : []);
  const transitItems = card.querySelectorAll(".transit > span");
  const metroItem = transitItems[0];
  const timeItem = transitItems[1];
  const travelIcon = timeItem?.querySelector("img")?.getAttribute("src") || "";
  const travelMode = travelIcon.includes("car") ? "на машине" : "пешком";

  detailTitle.textContent = `«${projectName}»`;
  detailMetro.textContent = metroItem?.textContent.trim() || "";
  detailTime.textContent = `${timeItem?.textContent.trim() || ""} ${travelMode}`.trim();
  detailMetroIcon.src = metroItem?.querySelector("img")?.getAttribute("src") || "assets/a101-metro-red.svg";
  detailApartments.textContent = customData.apartmentsLabel || "Смотреть квартиры";

  detailTags.replaceChildren(...tags.map((label) => {
    const tag = document.createElement("span");
    tag.className = "project-detail-tag";
    tag.textContent = label;
    return tag;
  }));

  const offers = customData.offers || sharedProjectOffers;
  detailOffers.replaceChildren(...offers.map(([label, price]) => {
    const row = document.createElement("div");
    row.className = "project-detail-offer";
    const labelNode = document.createElement("span");
    const priceNode = document.createElement("span");
    labelNode.textContent = label;
    priceNode.textContent = price;
    row.append(labelNode, priceNode);
    return row;
  }));

  const cardGallerySources = (photo?.dataset.gallery || "")
    .split("|")
    .map((source) => source.trim())
    .filter(Boolean);
  detailGallerySources = galleryFrames.map((_, index) => (
    cardGallerySources[index]
    || cardGallerySources[0]
    || "assets/a101-gallery-placeholder.svg"
  ));
  const cardDots = [...(photo?.querySelectorAll(".gallery-pagination i") || [])];
  const cardActiveIndex = Math.max(0, cardDots.findIndex((dot) => dot.classList.contains("active")));
  detailPagination.replaceChildren(...galleryFrames.map((_, index) => {
    const dot = document.createElement("i");
    dot.classList.toggle("active", index === cardActiveIndex);
    return dot;
  }));
  showDetailGalleryFrame(cardActiveIndex);
};

const switchProjectDetail = (card, source = null) => {
  if (!detailPanel?.classList.contains("is-open") || !card) return;
  const nextProjectName = extractProjectName(card);
  const pendingProjectName = pendingDetailCard ? extractProjectName(pendingDetailCard) : "";
  const currentProjectName = detailTitle?.textContent.replace(/[«»]/g, "").trim() || "";
  if (nextProjectName === pendingProjectName || (!pendingDetailCard && nextProjectName === currentProjectName)) {
    return;
  }
  pendingDetailCard = card;
  pendingDetailSource = source;
  window.clearTimeout(detailSwitchTimer);
  const switchSequence = ++detailSwitchSequence;
  detailPanel.classList.add("is-switching");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  detailSwitchTimer = window.setTimeout(() => {
    const nextCard = pendingDetailCard;
    const nextSource = pendingDetailSource;
    pendingDetailCard = null;
    pendingDetailSource = null;
    detailSwitchTimer = 0;
    if (
      switchSequence !== detailSwitchSequence
      || !nextCard
      || !detailPanel.classList.contains("is-mounted")
    ) return;
    activeDetailSource = nextSource;
    activeDetailOrigin = null;
    if (nextSource) {
      setDetailOrigin(nextSource);
      detailPanel.classList.remove("is-fallback");
    } else {
      detailPanel.classList.add("is-fallback");
    }
    populateProjectDetail(nextCard);
    detailPanel.getBoundingClientRect();
    requestAnimationFrame(() => {
      if (switchSequence === detailSwitchSequence) {
        detailPanel.classList.remove("is-switching");
      }
    });
  }, reducedMotion ? 1 : 150);
};

const openProjectDetail = (card, source) => {
  if (!detailPanel || !card) return;
  if (detailPanel.classList.contains("is-mounted")) {
    if (detailPanel.classList.contains("is-open")) {
      switchProjectDetail(card, source || null);
    }
    return;
  }
  window.clearTimeout(detailTransitionTimer);
  window.clearTimeout(detailSwitchTimer);
  detailSwitchSequence += 1;
  detailSwitchTimer = 0;
  pendingDetailCard = null;
  pendingDetailSource = null;
  detailPanel.classList.remove("is-switching");
  mapArea.classList.remove("detail-closing");
  clearPendingGalleryReset();
  clearDetailSourceClone();
  activeDetailSource = source || null;
  activeDetailOrigin = null;
  populateProjectDetail(card);
  detailPanel.classList.toggle("is-fallback", !source);
  let sourceClone = null;
  if (source) {
    setDetailOrigin(source);
    sourceClone = createDetailSourceClone(source);
    // Commit the new origin while the panel has no transition. Otherwise the
    // browser can interpolate from the origin used by the previous project.
    detailPanel.getBoundingClientRect();
  }
  detailPanel.setAttribute("aria-hidden", "false");
  detailPanel.classList.add("is-mounted");
  detailPanel.getBoundingClientRect();
  resetPinHighlight();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    mapArea.classList.add("detail-active");
    requestAnimationFrame(() => {
      detailPanel.classList.add("is-open");
      if (!sourceClone) return;
      detailClonePhaseTimer = window.setTimeout(() => {
        sourceClone.classList.add("is-leaving");
      }, reducedMotion ? 0 : 45);
      detailCloneTimer = window.setTimeout(clearDetailSourceClone, reducedMotion ? 10 : 250);
    });
  });
};

const closeProjectDetail = () => {
  if (!detailPanel?.classList.contains("is-mounted")) return;
  window.clearTimeout(detailTransitionTimer);
  window.clearTimeout(detailSwitchTimer);
  detailSwitchSequence += 1;
  detailSwitchTimer = 0;
  pendingDetailCard = null;
  pendingDetailSource = null;
  detailPanel.classList.remove("is-switching");
  mapArea.classList.add("detail-closing");
  clearDetailSourceClone();
  const sourcePhoto = activeDetailSource?.querySelector(".photo") || null;
  cardGalleryControllers.get(sourcePhoto)?.showFrame(detailGalleryIndex);
  const sourceClone = activeDetailSource
    ? createDetailSourceClone(activeDetailSource, true)
    : null;
  mapArea.classList.remove("detail-active");
  detailPanel.classList.remove("is-open");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const closeDuration = activeDetailSource ? 540 : 320;
  if (sourceClone) {
    detailClonePhaseTimer = window.setTimeout(() => {
      sourceClone.classList.remove("is-hidden");
    }, reducedMotion ? 0 : 240);
  }
  detailTransitionTimer = window.setTimeout(() => {
    detailPanel.classList.remove("is-mounted");
    detailPanel.classList.remove("is-fallback");
    detailPanel.setAttribute("aria-hidden", "true");
    activeDetailSource?.focus?.({ preventScroll: true });
    activeDetailSource = null;
    activeDetailOrigin = null;
    if (sourcePhoto) deferGalleryReset(sourcePhoto);
    if (sourceClone) {
      window.clearTimeout(detailClonePhaseTimer);
      detailClonePhaseTimer = 0;
    }
    requestAnimationFrame(() => {
      if (sourceClone && detailSourceClone === sourceClone) clearDetailSourceClone();
      mapArea.classList.remove("detail-closing");
    });
  }, reducedMotion ? 20 : closeDuration);
};

const changeDetailGalleryFrame = (direction) => {
  if (!detailPanel?.classList.contains("is-open") || detailPanel.classList.contains("is-switching")) return;
  const nextIndex = (detailGalleryIndex + direction + detailGallerySources.length)
    % detailGallerySources.length;
  showDetailGalleryFrame(nextIndex, true);
};

detailGalleryPrev?.addEventListener("click", (event) => {
  event.stopPropagation();
  changeDetailGalleryFrame(-1);
});

detailGalleryNext?.addEventListener("click", (event) => {
  event.stopPropagation();
  changeDetailGalleryFrame(1);
});

detailClose?.addEventListener("click", closeProjectDetail);

document.querySelectorAll(".card").forEach((card) => {
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Открыть проект ${extractProjectName(card)}`);
  card.addEventListener("click", () => openProjectDetail(card, card));
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openProjectDetail(card, card);
  });
});

Object.entries(projectPinMap).forEach(([projectName, selector]) => {
  if (!selector.startsWith(".marker")) return;
  const pin = document.querySelector(selector);
  const card = [...document.querySelectorAll(".card")]
    .find((item) => extractProjectName(item) === projectName);
  if (!pin || !card) return;
  pin.tabIndex = 0;
  pin.setAttribute("role", "button");
  pin.setAttribute("aria-label", `Открыть проект ${projectName}`);
  pin.addEventListener("click", () => openProjectDetail(card, isCardVisible(card) ? card : null));
  pin.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openProjectDetail(card, isCardVisible(card) ? card : null);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeProjectDetail();
});
