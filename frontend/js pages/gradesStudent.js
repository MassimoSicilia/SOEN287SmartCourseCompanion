function syncGradeCardHeights() {
    const cards = Array.from(document.querySelectorAll(".course-row-box"));
    if (cards.length === 0) return;

    for (const card of cards) {
        card.style.minHeight = "";
    }

    const referenceHeight = cards[0].offsetHeight;
    for (const card of cards) {
        card.style.minHeight = `${referenceHeight}px`;
    }
}

window.addEventListener("load", syncGradeCardHeights);
window.addEventListener("resize", syncGradeCardHeights);
